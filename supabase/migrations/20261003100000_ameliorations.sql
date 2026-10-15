-- =====================================================================
--  Améliorations (version 0.5.0)
--   1. Corbeille : un client supprimé est conservé 30 jours, puis effacé.
--   2. Accord du client pour être recontacté (RGPD).
--   3. Lien de questionnaire actif seulement une fois sorti de
--      l'application (messagerie ouverte, message copié) ; une réponse
--      confirme l'envoi si le thérapeute a oublié de le faire.
--   4. Plafond quotidien d'appels Gemini pour toute la plateforme.
--   5. Statistiques personnelles sur une période (3 ou 12 derniers mois).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 et 2. Fiche client : corbeille et accord de relance
-- ---------------------------------------------------------------------
alter table public.clients
  add column supprime_le       timestamptz,
  add column accord_relance_le date;

grant update (supprime_le, accord_relance_le) on public.clients to authenticated;

-- Colonnes ajoutées en fin de vue (seule forme permise par « or replace »).
create or replace view public.clients_resume
with (security_invoker = on) as
select
  c.id,
  c.nom,
  c.prenom,
  c.annee_naissance,
  c.cree_le,
  (select count(*) from public.seances s where s.client_id = c.id)::int as nb_seances,
  (select max(s.date_seance) from public.seances s where s.client_id = c.id) as derniere_seance,
  coalesce(
    (select array_agg(cp.problematique_id order by cp.problematique_id)
       from public.client_problematiques cp where cp.client_id = c.id),
    '{}'
  ) as problematiques,
  c.email,
  c.telephone,
  c.prix_seance,
  c.relances_actives,
  c.relance_reportee_au,
  c.supprime_le,
  c.accord_relance_le
from public.clients c;

-- Efface définitivement les clients du thérapeute connecté passés depuis
-- plus de 30 jours dans la corbeille (appelée à l'ouverture de la liste ;
-- voir README pour une purge quotidienne de toute la plateforme).
create function public.purger_corbeille()
returns int
language sql
volatile
security invoker
set search_path = ''
as $$
  with efface as (
    delete from public.clients
    where therapeute_id = auth.uid() and supprime_le < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from efface;
$$;

-- ---------------------------------------------------------------------
-- 3. Lien actif seulement une fois sorti de l'application
-- ---------------------------------------------------------------------
alter table public.envois add column lien_sorti_le timestamptz;
grant update (lien_sorti_le) on public.envois to authenticated;

create or replace function public.preparer_envoi(
  p_client_id        uuid,
  p_canal            public.canal_envoi,
  p_questionnaire_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_dest      text;
  v_validite  int;
  v_qid       uuid;
  v_entete    jsonb;
  v_questions jsonb;
  v_jeton     text;
  v_expire    timestamptz;
  v_id        uuid;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  -- liens préparés mais jamais sortis de l'application : inutiles
  delete from public.envois
  where therapeute_id = v_uid and envoye_le is null and lien_sorti_le is null
    and cree_le < now() - interval '1 day';

  select case p_canal when 'email' then c.email else c.telephone end
    into v_dest
  from public.clients c
  where c.id = p_client_id and c.therapeute_id = v_uid and c.supprime_le is null;
  if not found then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  if coalesce(trim(v_dest), '') = '' then
    raise exception 'Ce client n''a pas de coordonnées pour ce canal.' using errcode = '22023';
  end if;

  select q.id, jsonb_build_object('titre', q.titre, 'introduction', q.introduction, 'remerciement', q.remerciement)
    into v_qid, v_entete
  from public.questionnaires q
  where q.therapeute_id = v_uid
    and (q.id = p_questionnaire_id or (p_questionnaire_id is null and q.par_defaut));
  if v_qid is null then
    raise exception 'Questionnaire introuvable.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'libelle', q.libelle, 'type', q.type, 'aide', q.aide,
           'obligatoire', q.obligatoire, 'options', q.options, 'minimum', q.minimum,
           'maximum', q.maximum, 'sens', q.sens,
           'libelle_min', q.libelle_min, 'libelle_max', q.libelle_max
         ) order by q.ordre), '[]'::jsonb)
    into v_questions
  from public.questions q
  where q.questionnaire_id = v_qid and q.active;
  if jsonb_array_length(v_questions) = 0 then
    raise exception 'Ce questionnaire ne contient aucune question active.' using errcode = '22023';
  end if;

  select lien_validite_jours into v_validite from public.parametres where therapeute_id = v_uid;
  v_jeton  := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expire := now() + make_interval(days => coalesce(v_validite, 30));

  insert into public.envois
    (therapeute_id, client_id, questionnaire_id, canal, destinataire, jeton_hash, questionnaire, questions, expire_le)
  values (v_uid, p_client_id, v_qid, p_canal, v_dest,
          encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), v_entete, v_questions, v_expire)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'jeton', v_jeton, 'expire_le', v_expire, 'destinataire', v_dest);
end;
$$;

create or replace function public.questionnaire_public(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expire    timestamptz;
  v_repondu   timestamptz;
  v_actif     boolean;
  v_supprime  timestamptz;
  v_entete    jsonb;
  v_questions jsonb;
  v_nom       text;
  v_site      text;
  v_couleur   text;
begin
  select e.expire_le, e.repondu_le, (e.envoye_le is not null or e.lien_sorti_le is not null), c.supprime_le,
         e.questionnaire, e.questions, trim(t.prenom || ' ' || t.nom), p.nom_site, p.couleur
    into v_expire, v_repondu, v_actif, v_supprime, v_entete, v_questions, v_nom, v_site, v_couleur
  from public.envois e
  join public.clients c on c.id = e.client_id
  join public.therapeutes t on t.id = e.therapeute_id
  join public.parametres p on p.therapeute_id = e.therapeute_id
  where e.jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex');

  if not found or v_supprime is not null then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  if v_repondu is not null then
    return jsonb_build_object('valide', false, 'raison', 'deja_repondu', 'nom_site', v_site, 'couleur', v_couleur);
  end if;
  if not v_actif then
    return jsonb_build_object('valide', false, 'raison', 'non_envoye', 'nom_site', v_site, 'couleur', v_couleur);
  end if;
  if v_expire < now() then
    return jsonb_build_object('valide', false, 'raison', 'expire', 'nom_site', v_site, 'couleur', v_couleur);
  end if;
  return jsonb_build_object(
    'valide', true, 'therapeute', v_nom, 'nom_site', v_site, 'couleur', v_couleur,
    'expire_le', v_expire,
    'titre', coalesce(v_entete ->> 'titre', 'Questionnaire de suivi'),
    'introduction', coalesce(v_entete ->> 'introduction', ''),
    'remerciement', coalesce(v_entete ->> 'remerciement', ''),
    'questions', v_questions,
    'emotions', (select jsonb_agg(libelle order by ordre) from public.emotions)
  );
end;
$$;

create or replace function public.repondre_questionnaire(p_jeton text, p_reponses jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_question jsonb;
  v_expire   timestamptz;
  v_repondu  timestamptz;
  v_actif    boolean;
  v_supprime timestamptz;
  q          jsonb;
  v          jsonb;
  t          text;
  n          numeric;
  v_type     text;
  v_oblig    boolean;
  v_options  jsonb;
  v_vide     boolean;
  v_resultat jsonb := '[]'::jsonb;
begin
  select e.id, e.questions, e.expire_le, e.repondu_le, (e.envoye_le is not null or e.lien_sorti_le is not null),
         c.supprime_le
    into v_id, v_question, v_expire, v_repondu, v_actif, v_supprime
  from public.envois e
  join public.clients c on c.id = e.client_id
  where e.jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex')
  for update of e;

  if v_id is null or v_supprime is not null then
    raise exception 'Lien inconnu.' using errcode = 'P0002';
  end if;
  if v_repondu is not null then
    raise exception 'Ce questionnaire a déjà été rempli.' using errcode = '23505';
  end if;
  if not v_actif then
    raise exception 'Ce lien n''est pas encore actif.' using errcode = '22023';
  end if;
  if v_expire < now() then
    raise exception 'Ce lien a expiré.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'object' then
    raise exception 'Réponses illisibles.' using errcode = '22023';
  end if;

  for q in select * from jsonb_array_elements(v_question) loop
    v := p_reponses -> (q ->> 'id');
    t := coalesce(jsonb_typeof(v), 'null');
    v_type := q ->> 'type';
    v_oblig := coalesce((q ->> 'obligatoire')::boolean, true);
    v_options := coalesce(q -> 'options', '[]');

    -- une chaîne vide ou une liste vide valent « pas de réponse »
    if t = 'string' and trim(v #>> '{}') = '' then v := 'null'::jsonb; t := 'null'; end if;
    if t = 'array' and jsonb_array_length(v) = 0 then v := 'null'::jsonb; t := 'null'; end if;
    v_vide := t = 'null';

    if v_vide then
      if v_oblig then
        raise exception 'Réponse manquante : %', q ->> 'libelle' using errcode = '22023';
      end if;
      v := 'null'::jsonb;
    elsif v_type in ('curseur', 'etoiles') then
      if t <> 'number' then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
      n := (v #>> '{}')::numeric;
      if n <> trunc(n)
         or n < coalesce((q ->> 'minimum')::numeric, case when v_type = 'etoiles' then 1 else 0 end)
         or n > coalesce((q ->> 'maximum')::numeric, case when v_type = 'etoiles' then 5 else 10 end) then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
    elsif v_type = 'oui_non' then
      if t <> 'boolean' then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
    elsif v_type = 'choix_unique' then
      if t <> 'string' or not (v_options @> jsonb_build_array(v)) then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
    elsif v_type in ('choix_multiple', 'emotions') then
      if t <> 'array'
         or exists (select 1 from jsonb_array_elements(v) as x(e) where jsonb_typeof(x.e) <> 'string')
         or (select count(distinct x.e) from jsonb_array_elements(v) as x(e)) <> jsonb_array_length(v)
         or (v_type = 'choix_multiple' and not (v_options @> v))
         or (v_type = 'emotions' and exists (
               select 1 from jsonb_array_elements_text(v) as x(e)
               where x.e not in (select libelle from public.emotions))) then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
    else -- texte
      if t <> 'string' or length(v #>> '{}') > 2000 then
        raise exception 'Réponse invalide : %', q ->> 'libelle' using errcode = '22023';
      end if;
    end if;

    v_resultat := v_resultat || jsonb_build_array(jsonb_build_object(
      'question_id', q ->> 'id', 'libelle', q ->> 'libelle', 'type', v_type, 'valeur', v
    ));
  end loop;

  -- Une réponse prouve que le message est parti : l'envoi est confirmé s'il
  -- ne l'était pas encore (le thérapeute a pu oublier de cliquer).
  update public.envois set
    reponses   = v_resultat,
    repondu_le = now(),
    envoye_le  = coalesce(envoye_le, lien_sorti_le)
  where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Plafond quotidien d'appels Gemini pour toute la plateforme
--    (une seule clé partagée). Réglable par l'administrateur :
--    npm run comptes -- quota-ia <nombre>
-- ---------------------------------------------------------------------
create table public.plateforme (
  id                  boolean primary key default true check (id),
  ia_quota_jour_total int not null default 300 check (ia_quota_jour_total >= 0)
);
insert into public.plateforme default values;
alter table public.plateforme enable row level security;
-- aucune politique : invisible pour les thérapeutes, lue par les fonctions
revoke all on public.plateforme from anon, authenticated;

create or replace function public.consommer_quota_ia()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_max   int;
  v_total int;
  v_n     int;
begin
  if v_uid is null then
    return false;
  end if;
  -- sérialise les réservations : le plafond global ne peut pas être dépassé
  perform pg_advisory_xact_lock(hashtext('public.consommer_quota_ia'));
  select ia_quota_jour_total into v_total from public.plateforme;
  if (select coalesce(sum(nombre), 0) from public.usage_ia where jour = current_date) >= coalesce(v_total, 0) then
    return false;
  end if;
  select ia_quota_jour into v_max from public.parametres where therapeute_id = v_uid;
  if coalesce(v_max, 0) <= 0 then
    return false;
  end if;
  insert into public.usage_ia as u (therapeute_id, jour, nombre)
  values (v_uid, current_date, 1)
  on conflict (therapeute_id, jour) do update set nombre = u.nombre + 1
    where u.nombre < v_max
  returning nombre into v_n;
  return v_n is not null;
end;
$$;

create or replace function public.quota_ia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'utilise', coalesce((select nombre from public.usage_ia
                          where therapeute_id = auth.uid() and jour = current_date), 0),
    'max', coalesce((select ia_quota_jour from public.parametres where therapeute_id = auth.uid()), 0),
    'plateforme_epuisee',
      (select coalesce(sum(nombre), 0) from public.usage_ia where jour = current_date)
        >= coalesce((select ia_quota_jour_total from public.plateforme), 0)
  );
$$;

-- ---------------------------------------------------------------------
-- 5. Statistiques : clients de la corbeille exclus ; période facultative
--    pour l'espace personnel. L'espace de groupe porte toujours sur tout
--    l'historique : des fenêtres de dates au choix permettraient, par
--    différence, d'isoler les séances d'un seul client d'un confrère.
-- ---------------------------------------------------------------------
drop function public.statistiques(text, date);

create function public.statistiques(
  p_perimetre text default 'personnel',
  p_reference date default current_date,
  p_periode   text default 'tout'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k_clients     constant int := 5;
  k_therapeutes constant int := 3;
  v_uid         uuid := auth.uid();
  v_groupe      boolean;
  v_depuis      date;
  v_nb_therapeutes int;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_perimetre is null or p_perimetre not in ('personnel', 'groupe') then
    raise exception 'Périmètre inconnu : %', p_perimetre using errcode = '22023';
  end if;
  if p_periode is null or p_periode not in ('tout', '12mois', '3mois') then
    raise exception 'Période inconnue : %', p_periode using errcode = '22023';
  end if;
  v_groupe := p_perimetre = 'groupe';
  -- « 3 mois » = le mois de référence et les 2 précédents (idem pour 12)
  v_depuis := case when v_groupe or p_periode = 'tout' then null
                   else (date_trunc('month', p_reference::timestamp)
                         - make_interval(months => case p_periode when '3mois' then 2 else 11 end))::date end;

  if v_groupe then
    select count(distinct se.therapeute_id) into v_nb_therapeutes
    from public.seances se
    join public.clients c on c.id = se.client_id
    where c.supprime_le is null;
    if v_nb_therapeutes < k_therapeutes then
      return jsonb_build_object(
        'perimetre', p_perimetre,
        'disponible', false,
        'seuils', jsonb_build_object('clients', k_clients, 'therapeutes', k_therapeutes),
        'kpis', jsonb_build_object('nb_therapeutes', v_nb_therapeutes)
      );
    end if;
  end if;

  return (
    with
    -- séances du périmètre, toutes dates (pour la courbe des 12 mois)
    base as (
      select se.id, se.client_id, se.therapeute_id, se.date_seance, c.annee_naissance
      from public.seances se
      join public.clients c on c.id = se.client_id
      where (v_groupe or se.therapeute_id = v_uid) and c.supprime_le is null
    ),
    s as (
      select b.id, b.client_id, b.therapeute_id, b.date_seance, t.id as tranche_id
      from base b
      left join public.tranches_age t
        on extract(year from b.date_seance)::int - b.annee_naissance >= t.age_min
       and (t.age_max is null
            or extract(year from b.date_seance)::int - b.annee_naissance <= t.age_max)
      where v_depuis is null or b.date_seance >= v_depuis
    ),
    par_client as (
      select client_id, count(*) as nb, max(date_seance) - min(date_seance) as duree
      from s group by client_id
    ),
    totaux as (
      select
        (select count(distinct therapeute_id) from s) as nb_therapeutes,
        (select count(*) from par_client)              as nb_clients,
        (select count(*) from s)                       as nb_seances,
        (select avg(duree) from par_client)            as duree_moy,
        (select count(*) filter (where nb >= 4) from par_client) as nb_bilan
    ),
    occ as (
      select sc.seance_id, sc.emotion_id, s.client_id, s.therapeute_id, s.tranche_id
      from public.seance_cases sc
      join s on s.id = sc.seance_id
      where sc.zone in ('present1_haut', 'present1_pile', 'present1_bas', 'present2_haut', 'present2_bas')
    ),
    emo as (
      select
        e.id, e.libelle, e.ordre,
        count(o.seance_id)                                              as occurrences,
        count(distinct o.seance_id)                                     as nb_seances,
        count(distinct o.client_id) filter (where o.therapeute_id <> v_uid) as clients_autres
      from public.emotions e
      left join occ o on o.emotion_id = e.id
      group by e.id
    ),
    tranche as (
      select
        t.id, t.libelle, t.age_min,
        count(s.id)                                                    as nb_seances,
        count(distinct s.client_id)                                    as nb_clients,
        count(distinct s.client_id) filter (where s.therapeute_id <> v_uid) as clients_autres
      from public.tranches_age t
      left join s on s.tranche_id = t.id
      group by t.id
    ),
    tranche_emo as (
      select tr.id as tranche_id, e.id as emotion_id, e.libelle, e.ordre,
             count(distinct o.seance_id) as nb_seances
      from tranche tr
      cross join public.emotions e
      left join occ o on o.tranche_id = tr.id and o.emotion_id = e.id
      group by tr.id, e.id
    ),
    prob as (
      select
        p.id, p.code, p.libelle, p.ordre,
        count(distinct cp.client_id)                                      as nb_clients,
        count(distinct cp.client_id) filter (where cp.therapeute_id <> v_uid) as clients_autres
      from public.problematiques p
      left join public.client_problematiques cp
        on cp.problematique_id = p.id
       and cp.client_id in (select client_id from par_client)
      group by p.id
    )
    select jsonb_build_object(
      'perimetre', p_perimetre,
      'disponible', true,
      'seuils', jsonb_build_object('clients', k_clients, 'therapeutes', k_therapeutes),
      'kpis', (
        select jsonb_build_object(
          'nb_therapeutes', nb_therapeutes,
          'nb_clients', nb_clients,
          'nb_seances', nb_seances,
          'moyenne_seances_par_client', round(nb_seances::numeric / nullif(nb_clients, 0), 2),
          'duree_moyenne_suivi_jours', round(duree_moy::numeric, 1),
          'part_clients_bilan', round(nb_bilan::numeric / nullif(nb_clients, 0), 4)
        ) from totaux
      ),
      'emotions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'emotion_id', emo.id,
          'libelle', emo.libelle,
          'masque', v_groupe and emo.clients_autres < k_clients,
          'occurrences', case when v_groupe and emo.clients_autres < k_clients
                              then null else emo.occurrences end,
          'part_seances', case when v_groupe and emo.clients_autres < k_clients then null
                               else round(emo.nb_seances::numeric / nullif(tot.nb_seances, 0), 4) end,
          'moyenne_par_client', case when v_groupe and emo.clients_autres < k_clients then null
                                     else round(emo.occurrences::numeric / nullif(tot.nb_clients, 0), 2) end
        ) order by emo.ordre), '[]'::jsonb)
        from emo cross join totaux tot
      ),
      'tranches', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'tranche_id', tr.id,
          'libelle', tr.libelle,
          'masque', v_groupe and tr.clients_autres < k_clients,
          'nb_clients', case when v_groupe and tr.clients_autres < k_clients
                             then null else tr.nb_clients end,
          'nb_seances', case when v_groupe and tr.clients_autres < k_clients
                             then null else tr.nb_seances end,
          'emotions', case when v_groupe and tr.clients_autres < k_clients then '[]'::jsonb else (
            select coalesce(jsonb_agg(jsonb_build_object(
              'emotion_id', te.emotion_id,
              'libelle', te.libelle,
              'part_seances', round(te.nb_seances::numeric / nullif(tr.nb_seances, 0), 4)
            ) order by te.nb_seances desc, te.ordre), '[]'::jsonb)
            from tranche_emo te
            where te.tranche_id = tr.id and te.nb_seances > 0
          ) end
        ) order by tr.age_min), '[]'::jsonb)
        from tranche tr
      ),
      'problematiques', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'problematique_id', pr.id,
          'code', pr.code,
          'libelle', pr.libelle,
          'masque', v_groupe and pr.clients_autres < k_clients,
          'nb_clients', case when v_groupe and pr.clients_autres < k_clients
                             then null else pr.nb_clients end,
          'part_clients', case when v_groupe and pr.clients_autres < k_clients then null
                               else round(pr.nb_clients::numeric / nullif(tot.nb_clients, 0), 4) end
        ) order by
            (v_groupe and pr.clients_autres < k_clients),
            case when v_groupe and pr.clients_autres < k_clients then 0 else pr.nb_clients end desc,
            pr.ordre), '[]'::jsonb)
        from prob pr cross join totaux tot
      ),
      'par_mois', (
        select jsonb_agg(jsonb_build_object(
          'mois', to_char(m, 'YYYY-MM'),
          'nb_seances', (select count(*) from base
                         where date_trunc('month', base.date_seance::timestamp) = m)
        ) order by m)
        from generate_series(
          date_trunc('month', p_reference::timestamp) - interval '11 months',
          date_trunc('month', p_reference::timestamp),
          interval '1 month'
        ) as m
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Privilèges des fonctions nouvelles ou recréées
-- ---------------------------------------------------------------------
revoke all on function public.statistiques(text, date, text), public.purger_corbeille()
  from public, anon, authenticated;
grant execute on function public.statistiques(text, date, text) to authenticated;
grant execute on function public.purger_corbeille() to authenticated;

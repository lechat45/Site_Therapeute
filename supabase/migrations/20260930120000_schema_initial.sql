-- =====================================================================
--  Suivi thérapeutique — schéma initial (PostgreSQL / Supabase)
-- ---------------------------------------------------------------------
--  Principe de confidentialité :
--    * chaque ligne clinique porte `therapeute_id` ;
--    * la sécurité au niveau des lignes (RLS) n'autorise que le
--      thérapeute propriétaire, pour toutes les opérations ;
--    * l'espace de groupe ne lit JAMAIS les tables : il passe par la
--      fonction `statistiques('groupe')`, qui ne renvoie que des agrégats
--      soumis à des seuils d'anonymat (k-anonymat).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------
create type public.lignee as enum ('pere', 'mere');

-- Découpage du parcours : 3 séances initiales, 1 bilan, puis des
-- séances supplémentaires ajoutées à l'unité.
create type public.type_seance as enum ('initiale', 'bilan', 'supplementaire');

-- Chaque case de la fiche papier (voir supabase/functions/_shared/fiche.ts).
create type public.zone_fiche as enum (
  'present1_haut', 'present1_pile', 'present1_bas',   -- Émotion temps présent, colonne 1
  'present2_haut', 'present2_bas',                    -- Émotion temps présent, colonne 2
  'naissance', 'conception',                          -- suivi croisé : 1 = Père, 2 = Mère
  'generation_1', 'generation_2', 'generation_3',
  'grille_generation_3', 'grille_generation_2'        -- rangées de 4 cases
);

create type public.source_problematique as enum ('therapeute', 'ia');

-- ---------------------------------------------------------------------
-- 2. Référentiels (lecture seule pour les thérapeutes)
-- ---------------------------------------------------------------------
create table public.emotions (
  id      smallint primary key,
  libelle text     not null unique,
  ordre   smallint not null
);

create table public.problematiques (
  id      smallint primary key,
  code    text     not null unique,  -- identifiant stable, utilisé par l'IA
  libelle text     not null unique,
  ordre   smallint not null
);

create table public.tranches_age (
  id      smallint primary key,
  libelle text     not null,
  age_min smallint not null,
  age_max smallint,                  -- null = sans borne supérieure
  check (age_max is null or age_max >= age_min)
);

-- ---------------------------------------------------------------------
-- 3. Thérapeutes (un profil par compte Supabase Auth)
-- ---------------------------------------------------------------------
create table public.therapeutes (
  id      uuid        primary key references auth.users (id) on delete cascade,
  nom     text        not null default '',
  prenom  text        not null default '',
  cree_le timestamptz not null default now()
);

create function public.creer_profil_therapeute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.therapeutes (id, nom, prenom)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', '')
  );
  return new;
end;
$$;

create trigger apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil_therapeute();

-- ---------------------------------------------------------------------
-- 4. Clients (fiche strictement privée)
-- ---------------------------------------------------------------------
create table public.clients (
  id                 uuid        primary key default gen_random_uuid(),
  therapeute_id      uuid        not null default auth.uid()
                                 references public.therapeutes (id) on delete cascade,
  nom                text        not null check (length(trim(nom)) > 0),
  prenom             text        not null check (length(trim(prenom)) > 0),
  annee_naissance    smallint    not null check (annee_naissance between 1900 and 2100),
  synthese_ia        text,
  synthese_ia_maj_le timestamptz,
  cree_le            timestamptz not null default now(),
  maj_le             timestamptz not null default now(),
  -- cible des clés étrangères composites : une ligne enfant ne peut
  -- désigner qu'un client du MÊME thérapeute.
  unique (id, therapeute_id)
);
create index clients_therapeute_nom on public.clients (therapeute_id, nom, prenom);

-- Problématiques / motifs de consultation retenus pour un client.
-- Les suggestions de l'IA n'y entrent qu'après validation du thérapeute.
create table public.client_problematiques (
  client_id        uuid        not null,
  therapeute_id    uuid        not null default auth.uid(),
  problematique_id smallint    not null references public.problematiques (id),
  source           public.source_problematique not null default 'therapeute',
  ajoute_le        timestamptz not null default now(),
  primary key (client_id, problematique_id),
  foreign key (client_id, therapeute_id)
    references public.clients (id, therapeute_id) on delete cascade
);
create index client_problematiques_therapeute on public.client_problematiques (therapeute_id);

-- ---------------------------------------------------------------------
-- 5. Séances (numérisation de la fiche papier)
-- ---------------------------------------------------------------------
create table public.seances (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null,
  therapeute_id uuid        not null default auth.uid(),
  numero        smallint    not null,               -- attribué par déclencheur
  type          public.type_seance not null,        -- attribué par déclencheur
  date_seance   date        not null default current_date,
  lignee        public.lignee,
  objectif      text        not null default '',
  tim           text        not null default '',    -- champ « T.I.M. » de la fiche
  notes         text        not null default '',
  analyse_ia    jsonb,                              -- dernière analyse Gemini
  analyse_ia_le timestamptz,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  unique (client_id, numero),
  foreign key (client_id, therapeute_id)
    references public.clients (id, therapeute_id) on delete cascade
);
create index seances_therapeute_date on public.seances (therapeute_id, date_seance);

-- Les cases de la fiche : une émotion (menu déroulant) par case remplie.
-- Les cases vides ne sont pas stockées ; une même émotion peut figurer
-- dans plusieurs cases (par exemple plus bas dans l'empilement).
create table public.seance_cases (
  seance_id  uuid     not null references public.seances (id) on delete cascade,
  zone       public.zone_fiche not null,
  position   smallint not null,
  emotion_id smallint not null references public.emotions (id),
  primary key (seance_id, zone, position),
  check (position between 1 and case zone
    when 'present1_pile'       then 9
    when 'present1_bas'        then 1
    when 'present2_bas'        then 1
    when 'grille_generation_3' then 4
    when 'grille_generation_2' then 4
    else 2                              -- en-têtes (2 moitiés) et suivi croisé (Père, Mère)
  end)
);
create index seance_cases_emotion on public.seance_cases (emotion_id);

-- ---------------------------------------------------------------------
-- 6. Déclencheurs métier
-- ---------------------------------------------------------------------
create function public.horodater_maj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger clients_maj before update on public.clients
  for each row execute function public.horodater_maj();
create trigger seances_maj before update on public.seances
  for each row execute function public.horodater_maj();

-- Numérotation automatique du parcours :
--   séances 1 à 3 → initiale, séance 4 → bilan, 5 et au-delà → supplémentaire.
create function public.numeroter_seance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  deja int;
begin
  -- sérialise les créations simultanées pour un même client
  perform pg_advisory_xact_lock(hashtextextended(new.client_id::text, 0));
  select count(*) into deja from public.seances where client_id = new.client_id;
  new.numero := deja + 1;
  new.type := case
    when deja < 3 then 'initiale'
    when deja = 3 then 'bilan'
    else 'supplementaire'
  end::public.type_seance;
  return new;
end;
$$;

create trigger seances_numero before insert on public.seances
  for each row execute function public.numeroter_seance();

-- Seule la dernière séance d'un client peut être supprimée, pour que la
-- numérotation du parcours reste continue. La suppression d'un client
-- (cascade, profondeur > 1) n'est pas concernée.
create function public.proteger_numerotation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 and exists (
    select 1 from public.seances
    where client_id = old.client_id and numero > old.numero
  ) then
    raise exception 'Seule la dernière séance du parcours peut être supprimée.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger seances_suppression before delete on public.seances
  for each row execute function public.proteger_numerotation();

-- ---------------------------------------------------------------------
-- 7. Vue « liste des clients » (hérite de la RLS : security_invoker)
-- ---------------------------------------------------------------------
create view public.clients_resume
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
  ) as problematiques
from public.clients c;

-- ---------------------------------------------------------------------
-- 8. Sécurité au niveau des lignes
-- ---------------------------------------------------------------------
alter table public.emotions                  enable row level security;
alter table public.problematiques            enable row level security;
alter table public.tranches_age              enable row level security;
alter table public.therapeutes               enable row level security;
alter table public.clients                   enable row level security;
alter table public.client_problematiques     enable row level security;
alter table public.seances                   enable row level security;
alter table public.seance_cases              enable row level security;

create policy "référentiel lisible" on public.emotions
  for select to authenticated using (true);
create policy "référentiel lisible" on public.problematiques
  for select to authenticated using (true);
create policy "référentiel lisible" on public.tranches_age
  for select to authenticated using (true);

create policy "profil personnel" on public.therapeutes
  for select to authenticated using (id = (select auth.uid()));
create policy "profil personnel modifiable" on public.therapeutes
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "propriétaire uniquement" on public.clients
  for all to authenticated
  using (therapeute_id = (select auth.uid()))
  with check (therapeute_id = (select auth.uid()));

create policy "propriétaire uniquement" on public.client_problematiques
  for all to authenticated
  using (therapeute_id = (select auth.uid()))
  with check (therapeute_id = (select auth.uid()));

create policy "propriétaire uniquement" on public.seances
  for all to authenticated
  using (therapeute_id = (select auth.uid()))
  with check (therapeute_id = (select auth.uid()));

create policy "propriétaire uniquement" on public.seance_cases
  for all to authenticated
  using (exists (select 1 from public.seances s
                 where s.id = seance_id and s.therapeute_id = (select auth.uid())))
  with check (exists (select 1 from public.seances s
                      where s.id = seance_id and s.therapeute_id = (select auth.uid())));

-- Double authentification : un thérapeute qui l'a activée n'accède aux
-- données cliniques qu'avec une session validée par code (niveau aal2).
create function public.mfa_satisfaite()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

create policy "double authentification" on public.clients as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.client_problematiques as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.seances as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.seance_cases as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));

-- ---------------------------------------------------------------------
-- 9. Privilèges (Supabase accorde tout par défaut : on repart de zéro)
-- ---------------------------------------------------------------------
revoke all on
  public.emotions, public.problematiques, public.tranches_age,
  public.therapeutes, public.clients, public.client_problematiques,
  public.seances, public.seance_cases,
  public.clients_resume
from anon, authenticated;

grant select on public.emotions, public.problematiques, public.tranches_age
  to authenticated;

grant select on public.therapeutes to authenticated;
grant update (nom, prenom) on public.therapeutes to authenticated;

grant select, insert, delete on public.clients to authenticated;
grant update (nom, prenom, annee_naissance, synthese_ia, synthese_ia_maj_le)
  on public.clients to authenticated;

grant select, insert, delete on public.client_problematiques to authenticated;

-- numero, type, client_id et therapeute_id ne sont jamais modifiables
grant select, insert, delete on public.seances to authenticated;
grant update (date_seance, lignee, objectif, tim, notes, analyse_ia, analyse_ia_le)
  on public.seances to authenticated;

grant select, insert, delete on public.seance_cases to authenticated;

grant select on public.clients_resume to authenticated;

-- ---------------------------------------------------------------------
-- 10. Enregistrement atomique d'une fiche de séance
--     (security invoker : la RLS s'applique à chaque instruction)
-- ---------------------------------------------------------------------
create function public.enregistrer_seance(p_seance_id uuid, p_fiche jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.seances set
    date_seance = coalesce((p_fiche ->> 'date_seance')::date, date_seance),
    lignee      = nullif(p_fiche ->> 'lignee', '')::public.lignee,
    objectif    = coalesce(p_fiche ->> 'objectif', ''),
    tim         = coalesce(p_fiche ->> 'tim', ''),
    notes       = coalesce(p_fiche ->> 'notes', '')
  where id = p_seance_id;

  if not found then
    raise exception 'Séance introuvable.' using errcode = 'P0002';
  end if;

  -- Les cases de la feuille sont remplacées en bloc.
  delete from public.seance_cases where seance_id = p_seance_id;
  insert into public.seance_cases (seance_id, zone, position, emotion_id)
  select
    p_seance_id,
    (c ->> 'zone')::public.zone_fiche,
    (c ->> 'position')::smallint,
    (c ->> 'emotion_id')::smallint
  from jsonb_array_elements(coalesce(p_fiche -> 'cases', '[]')) as c
  where c ->> 'emotion_id' is not null;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Statistiques (espace individuel ET espace de groupe)
-- ---------------------------------------------------------------------
--  'personnel' : uniquement les données du thérapeute connecté.
--  'groupe'    : toute la plateforme, anonymisée :
--     * aucune donnée nominative ni texte libre n'est lu ;
--     * l'espace ne s'ouvre qu'à partir de 3 thérapeutes contributeurs ;
--     * une case (émotion, tranche d'âge, problématique) n'est publiée que
--       si au moins 5 clients d'AUTRES thérapeutes y contribuent — le
--       lecteur ne peut donc pas isoler un client d'un confrère en
--       retranchant ses propres chiffres.
--
--  Définitions (reprises à l'identique par le mode démo, src/domaine/statistiques.ts) :
--     apparition         = une case « Émotion temps présent » (zones present*)
--     part_seances       = séances où l'émotion apparaît / séances du périmètre
--     moyenne_par_client = apparitions de l'émotion / clients du périmètre
--     tranche d'âge      = âge au moment de la séance (année séance − année naissance)
--     durée de suivi     = dernière séance − première séance, moyennée sur les clients
--     par_mois           = séances de chacun des 12 mois finissant au mois de p_reference
-- ---------------------------------------------------------------------
create function public.statistiques(
  p_perimetre text default 'personnel',
  p_reference date default current_date
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
  v_nb_therapeutes int;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_perimetre is null or p_perimetre not in ('personnel', 'groupe') then
    raise exception 'Périmètre inconnu : %', p_perimetre using errcode = '22023';
  end if;
  v_groupe := p_perimetre = 'groupe';

  if v_groupe then
    select count(distinct therapeute_id) into v_nb_therapeutes from public.seances;
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
    s as (
      select se.id, se.client_id, se.therapeute_id, se.date_seance, t.id as tranche_id
      from public.seances se
      join public.clients c on c.id = se.client_id
      left join public.tranches_age t
        on extract(year from se.date_seance)::int - c.annee_naissance >= t.age_min
       and (t.age_max is null
            or extract(year from se.date_seance)::int - c.annee_naissance <= t.age_max)
      where v_groupe or se.therapeute_id = v_uid
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
            -- les cases masquées vont en fin de liste, sans que leur
            -- effectif réel influe sur l'ordre
            (v_groupe and pr.clients_autres < k_clients),
            case when v_groupe and pr.clients_autres < k_clients then 0 else pr.nb_clients end desc,
            pr.ordre), '[]'::jsonb)
        from prob pr cross join totaux tot
      ),
      'par_mois', (
        select jsonb_agg(jsonb_build_object(
          'mois', to_char(m, 'YYYY-MM'),
          'nb_seances', (select count(*) from s
                         where date_trunc('month', s.date_seance::timestamp) = m)
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

-- Fonctions : aucune exécution anonyme.
revoke all on function
  public.enregistrer_seance(uuid, jsonb),
  public.statistiques(text, date),
  public.mfa_satisfaite(),
  public.creer_profil_therapeute(),
  public.horodater_maj(),
  public.numeroter_seance(),
  public.proteger_numerotation()
from public, anon, authenticated;

grant execute on function public.enregistrer_seance(uuid, jsonb) to authenticated;
grant execute on function public.statistiques(text, date) to authenticated;
grant execute on function public.mfa_satisfaite() to authenticated;

-- =====================================================================
--  Version 0.8.0
--   1. Reçu envoyé au client par lien personnel (sans compte, à imprimer
--      ou enregistrer en PDF), comme les documents remis.
--   2. Exercice à compléter : les lignes « ? … » d'un document sont des
--      questions ; le client répond depuis son lien, une seule fois.
--   3. Tâches personnelles récurrentes (chaque semaine, chaque mois).
--  (Le récapitulatif annuel des reçus et les créneaux selon les habitudes
--  du client se calculent dans l'application, sans changement de schéma.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Reçu par lien personnel
-- ---------------------------------------------------------------------
alter table public.recus
  add column jeton_hash     text unique,
  add column lien_expire_le timestamptz,
  add column lien_ouvert_le timestamptz;

-- Crée (ou remplace) le lien du reçu ; le jeton n'est renvoyé qu'ici.
create function public.preparer_lien_recu(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  r       public.recus;
  v_jeton text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_exp   timestamptz := now() + interval '90 days';
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into r from public.recus where id = p_id and therapeute_id = v_uid;
  if not found then
    raise exception 'Reçu introuvable.' using errcode = 'P0002';
  end if;
  if r.annule_le is not null then
    raise exception 'Ce reçu est annulé : émettez-en un nouveau.' using errcode = '22023';
  end if;
  if r.client_id is null
     or exists (select 1 from public.clients where id = r.client_id and supprime_le is not null) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  update public.recus
  set jeton_hash = encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), lien_expire_le = v_exp, lien_ouvert_le = null
  where id = r.id;
  return jsonb_build_object('jeton', v_jeton, 'expire_le', v_exp);
end;
$$;

-- Lecture publique du reçu (sans compte) ; note la première ouverture.
create function public.recu_public(p_jeton text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r         public.recus;
  v_suppr   timestamptz;
  v_site    text;
  v_couleur text;
begin
  select * into r from public.recus
  where jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex');
  if not found or r.client_id is null then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  select c.supprime_le, p.nom_site, p.couleur into v_suppr, v_site, v_couleur
  from public.clients c join public.parametres p on p.therapeute_id = r.therapeute_id
  where c.id = r.client_id;
  if v_suppr is not null then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  if r.lien_expire_le < now() then
    return jsonb_build_object('valide', false, 'raison', 'expire', 'nom_site', v_site, 'couleur', v_couleur);
  end if;
  update public.recus set lien_ouvert_le = now() where id = r.id and lien_ouvert_le is null;
  return jsonb_build_object(
    'valide', true, 'nom_site', v_site, 'couleur', v_couleur, 'expire_le', r.lien_expire_le,
    'recu', jsonb_build_object(
      'annee', r.annee, 'numero', r.numero, 'client_nom', r.client_nom, 'date_seance', r.date_seance,
      'date_emission', r.date_emission, 'prestation', r.prestation, 'montant', r.montant,
      'mode_reglement', r.mode_reglement, 'emetteur', r.emetteur, 'annule_le', r.annule_le,
      'motif_annulation', r.motif_annulation
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Exercice à compléter
-- ---------------------------------------------------------------------
alter table public.remises
  add column reponses    jsonb,
  add column repondu_le  timestamptz,
  add column consulte_le timestamptz;
grant update (consulte_le) on public.remises to authenticated;

-- Questions d'un document : lignes commençant par « ? » suivi d'un espace.
-- Miroir exact de questionsDocument() (src/domaine/texte.ts), testé.
create function public.questions_document(p_contenu text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(regexp_replace(l, '^\?\s+', '') order by n), '{}')
  from unnest(string_to_array(regexp_replace(coalesce(p_contenu, ''), E'\r\n?', E'\n', 'g'), E'\n'))
    with ordinality as t(brute, n)
  cross join lateral (select btrim(brute, E' \t') as l) x
  where l ~ '^\?\s'
$$;

-- Réponses du client, par son lien : une seule fois, questions recopiées
-- depuis le document remis (le client n'envoie que ses réponses).
create function public.repondre_document(p_jeton text, p_reponses jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r           public.remises;
  v_questions text[];
  v_reponses  jsonb := '[]'::jsonb;
  v_texte     text;
  v_rempli    boolean := false;
begin
  select * into r from public.remises
  where jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex')
  for update;
  if not found or exists (select 1 from public.clients where id = r.client_id and supprime_le is not null) then
    raise exception 'Lien introuvable.' using errcode = 'P0002';
  end if;
  if r.expire_le < now() then
    raise exception 'Ce lien a expiré.' using errcode = '22023';
  end if;
  if r.repondu_le is not null then
    raise exception 'Vos réponses ont déjà été envoyées.' using errcode = '23505';
  end if;
  v_questions := public.questions_document(r.contenu);
  if cardinality(v_questions) = 0 then
    raise exception 'Ce document n''attend pas de réponse.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'array' or jsonb_array_length(p_reponses) <> cardinality(v_questions) then
    raise exception 'Réponses incomplètes.' using errcode = '22023';
  end if;
  for i in 1 .. cardinality(v_questions) loop
    if jsonb_typeof(p_reponses -> (i - 1)) <> 'string' then
      raise exception 'Réponses incomplètes.' using errcode = '22023';
    end if;
    v_texte := btrim(p_reponses ->> (i - 1), E' \t\r\n');
    if length(v_texte) > 5000 then
      raise exception 'Réponse trop longue (5 000 caractères au plus).' using errcode = '22023';
    end if;
    v_rempli := v_rempli or v_texte <> '';
    v_reponses := v_reponses || jsonb_build_array(jsonb_build_object('question', v_questions[i], 'reponse', v_texte));
  end loop;
  if not v_rempli then
    raise exception 'Répondez à au moins une question.' using errcode = '22023';
  end if;
  update public.remises
  set reponses = v_reponses, repondu_le = now(), ouvert_le = coalesce(ouvert_le, now())
  where id = r.id;
end;
$$;

-- La page du client sait désormais s'il a déjà répondu.
create or replace function public.document_public(p_jeton text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r         public.remises;
  v_suppr   timestamptz;
  v_nom     text;
  v_site    text;
  v_couleur text;
begin
  select * into r from public.remises
  where jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex');
  if not found then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  select c.supprime_le, trim(t.prenom || ' ' || t.nom), p.nom_site, p.couleur
    into v_suppr, v_nom, v_site, v_couleur
  from public.clients c
  join public.therapeutes t on t.id = r.therapeute_id
  join public.parametres p on p.therapeute_id = r.therapeute_id
  where c.id = r.client_id;
  if v_suppr is not null then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  if r.expire_le < now() then
    return jsonb_build_object('valide', false, 'raison', 'expire', 'nom_site', v_site, 'couleur', v_couleur);
  end if;
  update public.remises set ouvert_le = now() where id = r.id and ouvert_le is null;
  return jsonb_build_object(
    'valide', true, 'titre', r.titre, 'contenu', r.contenu, 'therapeute', v_nom,
    'nom_site', v_site, 'couleur', v_couleur, 'expire_le', r.expire_le, 'repondu_le', r.repondu_le
  );
end;
$$;

-- Colonnes ajoutées en fin de vue (seule forme permise par « create or replace »).
create or replace view public.remises_actives with (security_invoker = on) as
select r.id, r.client_id, r.document_id, r.mode, r.titre, r.cree_le, r.expire_le, r.ouvert_le,
       r.reponses, r.repondu_le, r.consulte_le
from public.remises r join public.clients c on c.id = r.client_id where c.supprime_le is null;

-- ---------------------------------------------------------------------
-- 3. Tâches personnelles récurrentes
-- ---------------------------------------------------------------------
alter table public.taches_perso
  add column recurrence text not null default 'aucune' check (recurrence in ('aucune', 'semaine', 'mois')),
  add column precedente uuid,
  add constraint taches_perso_id_therapeute unique (id, therapeute_id),
  add constraint taches_perso_precedente foreign key (precedente, therapeute_id)
    references public.taches_perso (id, therapeute_id) on delete set null (precedente);
grant update (recurrence) on public.taches_perso to authenticated;

-- Prochaine échéance : première date de la série postérieure à « aujourd'hui »
-- (base + n semaines ou n mois, fin de mois respectée : 31 janvier → 28 février
-- → 31 mars). Miroir exact de echeanceSuivante() (src/domaine/taches.ts), testé.
create function public.echeance_suivante(p_echeance date, p_recurrence text, p_aujourdhui date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base date := coalesce(p_echeance, p_aujourdhui);
  v_date date;
  n      int := 0;
begin
  if p_recurrence not in ('semaine', 'mois') then
    return null;
  end if;
  loop
    n := n + 1;
    v_date := case p_recurrence
      when 'semaine' then v_base + 7 * n
      else (v_base + make_interval(months => n))::date
    end;
    exit when v_date > p_aujourdhui;
  end loop;
  return v_date;
end;
$$;

-- Cocher une tâche récurrente crée la suivante ; la décocher retire la
-- suivante tant qu'elle n'est pas faite.
create function public.tache_recurrente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.faite_le is null and new.faite_le is not null and new.recurrence <> 'aucune' then
    insert into public.taches_perso (therapeute_id, client_id, titre, echeance, recurrence, precedente)
    values (new.therapeute_id, new.client_id, new.titre,
            public.echeance_suivante(new.echeance, new.recurrence, (new.faite_le at time zone 'Europe/Paris')::date),
            new.recurrence, new.id);
  elsif old.faite_le is not null and new.faite_le is null then
    delete from public.taches_perso where precedente = new.id and faite_le is null;
  end if;
  return null;
end;
$$;
create trigger taches_perso_recurrence after update of faite_le on public.taches_perso
  for each row execute function public.tache_recurrente();

create or replace view public.mes_taches with (security_invoker = on) as
select t.* from public.taches_perso t left join public.clients c on c.id = t.client_id where c.supprime_le is null;

-- ---------------------------------------------------------------------
-- Privilèges des fonctions
-- ---------------------------------------------------------------------
revoke all on function
  public.preparer_lien_recu(uuid),
  public.recu_public(text),
  public.questions_document(text),
  public.repondre_document(text, jsonb),
  public.echeance_suivante(date, text, date),
  public.tache_recurrente()
from public, anon, authenticated;
grant execute on function public.preparer_lien_recu(uuid) to authenticated;
-- appelée par le déclencheur, sous l'identité du thérapeute (fonction pure)
grant execute on function public.echeance_suivante(date, text, date) to authenticated;
-- ouvertes sans compte : le jeton fait office de clé
grant execute on function public.recu_public(text) to anon, authenticated;
grant execute on function public.repondre_document(text, jsonb) to anon, authenticated;

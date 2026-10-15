-- =====================================================================
--  Relances, questionnaires de suivi, tâches, tarifs, paramètres et
--  personnalisation du compte, quota d'analyses IA.
--
--  Envois « à la main » : l'application prépare un message personnel
--  (e-mail ou SMS) avec un lien unique vers un questionnaire ; le
--  thérapeute l'envoie depuis sa propre messagerie puis confirme.
--  Le client répond sans compte ; ses réponses arrivent sur sa fiche.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fiche client : coordonnées, tarif, relances
-- ---------------------------------------------------------------------
alter table public.clients
  add column email               text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column telephone           text check (telephone is null or telephone ~ '^\+?[0-9 .()-]{6,20}$'),
  add column prix_seance         numeric(8, 2) check (prix_seance >= 0),
  add column relances_actives    boolean not null default true,
  add column relance_reportee_au date;

grant update (email, telephone, prix_seance, relances_actives, relance_reportee_au)
  on public.clients to authenticated;

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
  c.relance_reportee_au
from public.clients c;

-- ---------------------------------------------------------------------
-- 2. Tarif de chaque séance (facultatif)
-- ---------------------------------------------------------------------
alter table public.seances add column prix numeric(8, 2) check (prix >= 0);
grant update (prix) on public.seances to authenticated;

-- ---------------------------------------------------------------------
-- 3. Paramètres et personnalisation de chaque compte
--    (chaque thérapeute règle tout pour lui-même)
-- ---------------------------------------------------------------------
create table public.parametres (
  therapeute_id            uuid primary key default auth.uid()
                           references public.therapeutes (id) on delete cascade,
  -- apparence et affichage
  nom_site                 text not null default 'Suivi thérapeutique'
                           check (length(trim(nom_site)) between 1 and 60),
  couleur                  text not null default '#7436e6' check (couleur ~ '^#[0-9a-f]{6}$'),
  taille_texte             text not null default 'normal' check (taille_texte in ('normal', 'grand', 'tres_grand')),
  densite                  text not null default 'confortable' check (densite in ('confortable', 'compacte')),
  vision                   text not null default 'standard' check (vision in ('standard', 'rouge_vert', 'bleu_jaune')),
  reduire_animations       boolean not null default false,
  page_accueil             text not null default '/' check (page_accueil in ('/', '/clients', '/taches')),
  -- profil
  specialite               text not null default '' check (length(specialite) <= 80),
  telephone_pro            text not null default '' check (length(telephone_pro) <= 30),
  signature                text not null default '' check (length(signature) <= 500),
  photo                    text check (photo is null or (photo like 'data:image/%' and length(photo) <= 300000)),
  -- tarifs
  tarifs_actifs            boolean not null default true,
  prix_defaut              numeric(8, 2) check (prix_defaut >= 0),
  -- relances
  relances_actives         boolean not null default true,
  relance_delai_jours      smallint not null default 15 check (relance_delai_jours between 1 and 365),
  relance_intervalle_jours smallint not null default 30 check (relance_intervalle_jours between 1 and 365),
  relance_max              smallint not null default 3 check (relance_max between 1 and 20),
  lien_validite_jours      smallint not null default 30 check (lien_validite_jours between 1 and 180),
  modele_email_objet       text not null default 'Des nouvelles depuis notre dernière séance'
                           check (length(modele_email_objet) <= 200),
  modele_email             text not null default E'Bonjour {prenom},\n\nNotre dernière séance remonte à quelques semaines et j''aimerais savoir comment vous allez.\n\nSi vous le souhaitez, ce court questionnaire (une minute) me permettra de suivre votre évolution :\n{lien}\n\nCe lien est personnel et valable jusqu''au {expiration}.\n\nAu plaisir d''avoir de vos nouvelles,\n{signature}'
                           check (length(modele_email) <= 5000),
  modele_sms               text not null default 'Bonjour {prenom}, comment allez-vous depuis notre dernière séance ? Un questionnaire d''une minute pour suivre votre évolution : {lien} — {therapeute}'
                           check (length(modele_sms) <= 1000),
  -- sécurité
  deconnexion_minutes      smallint not null default 30 check (deconnexion_minutes between 5 and 480),
  -- intelligence artificielle (une seule clé Gemini pour toute la plateforme)
  ia_taches                boolean not null default true,
  ia_quota_jour            smallint not null default 20 check (ia_quota_jour between 0 and 200),
  maj_le                   timestamptz not null default now()
);

create trigger parametres_maj before update on public.parametres
  for each row execute function public.horodater_maj();

-- ---------------------------------------------------------------------
-- 4. Questionnaires de suivi (plusieurs par thérapeute, un par défaut)
-- ---------------------------------------------------------------------
create table public.questionnaires (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  titre         text not null check (length(trim(titre)) between 1 and 120),
  introduction  text not null default '' check (length(introduction) <= 1000),
  remerciement  text not null default '' check (length(remerciement) <= 500),
  par_defaut    boolean not null default false,
  ordre         smallint not null default 0,
  cree_le       timestamptz not null default now(),
  unique (id, therapeute_id)
);
create unique index questionnaires_un_defaut on public.questionnaires (therapeute_id) where par_defaut;

create type public.type_question as enum (
  'curseur',          -- valeur entière entre minimum et maximum
  'etoiles',          -- note de 1 à maximum (3 à 10 étoiles)
  'texte',            -- réponse libre
  'choix_unique',     -- une option parmi « options »
  'choix_multiple',   -- plusieurs options parmi « options »
  'oui_non',          -- vrai / faux
  'emotions'          -- une ou plusieurs des 14 émotions clés
);

create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  therapeute_id    uuid not null default auth.uid(),
  questionnaire_id uuid not null,
  ordre            smallint not null default 0,
  libelle          text not null check (length(trim(libelle)) between 1 and 300),
  type             public.type_question not null default 'curseur',
  aide             text not null default '' check (length(aide) <= 300),
  obligatoire      boolean not null default true,
  options          jsonb not null default '[]'
                   check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 12),
  minimum          smallint not null default 0 check (minimum between 0 and 100),
  maximum          smallint not null default 10 check (maximum between 1 and 100),
  -- pour les curseurs et les étoiles : une valeur haute est-elle bonne ?
  sens             text not null default 'haut' check (sens in ('haut', 'bas')),
  libelle_min      text not null default '' check (length(libelle_min) <= 40),
  libelle_max      text not null default '' check (length(libelle_max) <= 40),
  active           boolean not null default true,
  check (minimum < maximum),
  check (type <> 'etoiles' or (minimum = 1 and maximum between 3 and 10)),
  check (type not in ('choix_unique', 'choix_multiple') or jsonb_array_length(options) >= 2),
  foreign key (questionnaire_id, therapeute_id)
    references public.questionnaires (id, therapeute_id) on delete cascade
);
create index questions_questionnaire on public.questions (questionnaire_id, ordre);

-- Le questionnaire par défaut ne se supprime pas (il sert aux relances),
-- sauf lors de la suppression du compte (cascade, profondeur > 1).
create function public.proteger_questionnaire_par_defaut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.par_defaut and pg_trigger_depth() = 1 then
    raise exception 'Le questionnaire par défaut ne peut pas être supprimé : choisissez-en d''abord un autre.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger questionnaires_suppression before delete on public.questionnaires
  for each row execute function public.proteger_questionnaire_par_defaut();

-- ---------------------------------------------------------------------
-- 5. Envois (relance + lien vers un questionnaire) et réponses
-- ---------------------------------------------------------------------
create type public.canal_envoi as enum ('email', 'sms');

create table public.envois (
  id               uuid primary key default gen_random_uuid(),
  therapeute_id    uuid not null default auth.uid(),
  client_id        uuid not null,
  questionnaire_id uuid references public.questionnaires (id) on delete set null,
  canal            public.canal_envoi not null,
  destinataire     text not null,
  -- SHA-256 du jeton du lien : le jeton lui-même n'est jamais stocké.
  jeton_hash       text not null unique,
  objet            text not null default '',
  corps            text not null default '',   -- message envoyé, lien masqué
  questionnaire    jsonb not null default '{}',-- titre, introduction, remerciement tels qu'envoyés
  questions        jsonb not null,             -- questions telles qu'envoyées
  cree_le          timestamptz not null default now(),
  expire_le        timestamptz not null,
  envoye_le        timestamptz,
  reponses         jsonb,
  repondu_le       timestamptz,
  consulte_le      timestamptz,
  analyse_ia       jsonb,                      -- lecture IA des réponses (onglet Tâches)
  analyse_ia_le    timestamptz,
  foreign key (client_id, therapeute_id)
    references public.clients (id, therapeute_id) on delete cascade
);
create index envois_client on public.envois (client_id, cree_le);
create index envois_therapeute on public.envois (therapeute_id, cree_le desc);

-- ---------------------------------------------------------------------
-- 6. Journal des connexions (visible par le seul titulaire du compte)
-- ---------------------------------------------------------------------
create table public.journal_connexions (
  id            bigint generated always as identity primary key,
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  le            timestamptz not null default now(),
  appareil      text not null default '' check (length(appareil) <= 200)
);
create index journal_therapeute on public.journal_connexions (therapeute_id, le desc);

-- ---------------------------------------------------------------------
-- 7. Quota quotidien d'analyses IA (une seule clé Gemini partagée)
-- ---------------------------------------------------------------------
create table public.usage_ia (
  therapeute_id uuid not null references public.therapeutes (id) on delete cascade,
  jour          date not null,
  nombre        int not null default 0,
  primary key (therapeute_id, jour)
);

-- Réserve une analyse : vrai si le quota du jour le permet.
create function public.consommer_quota_ia()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max int;
  v_n   int;
begin
  if v_uid is null then
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

create function public.quota_ia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'utilise', coalesce((select nombre from public.usage_ia
                          where therapeute_id = auth.uid() and jour = current_date), 0),
    'max', coalesce((select ia_quota_jour from public.parametres where therapeute_id = auth.uid()), 0)
  );
$$;

-- ---------------------------------------------------------------------
-- 8. Espace initialisé à la création du thérapeute
-- ---------------------------------------------------------------------
create function public.creer_questionnaire_par_defaut(p_therapeute uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.questionnaires (therapeute_id, titre, introduction, remerciement, par_defaut, ordre)
  values (
    p_therapeute,
    'Questionnaire de suivi',
    'Une minute suffit. Vos réponses ne sont transmises qu''à votre thérapeute.',
    'Merci ! Vos réponses ont bien été transmises.',
    true,
    1
  )
  returning id into v_id;

  insert into public.questions
    (therapeute_id, questionnaire_id, ordre, libelle, type, aide, obligatoire, minimum, maximum, sens, libelle_min, libelle_max)
  values
    (p_therapeute, v_id, 1, 'Comment vous sentez-vous globalement depuis notre dernière séance ?', 'curseur', '', true, 0, 10, 'haut', 'Très mal', 'Très bien'),
    (p_therapeute, v_id, 2, 'Quelle est aujourd''hui l''intensité de la difficulté qui vous a amené(e) à consulter ?', 'curseur', '', true, 0, 10, 'bas', 'Disparue', 'Très forte'),
    (p_therapeute, v_id, 3, 'Comment dormez-vous en ce moment ?', 'curseur', '', true, 0, 10, 'haut', 'Très mal', 'Très bien'),
    (p_therapeute, v_id, 4, 'Quelles émotions avez-vous le plus ressenties ces derniers jours ?', 'emotions', 'Plusieurs choix possibles.', false, 0, 10, 'haut', '', ''),
    (p_therapeute, v_id, 5, 'Quelle note donnez-vous à l''aide apportée par les séances ?', 'etoiles', '', false, 1, 5, 'haut', '', ''),
    (p_therapeute, v_id, 6, 'Souhaitez-vous reprendre rendez-vous ?', 'oui_non', '', false, 0, 10, 'haut', '', ''),
    (p_therapeute, v_id, 7, 'Souhaitez-vous ajouter quelque chose ?', 'texte', 'Ce message ne sera lu que par votre thérapeute.', false, 0, 10, 'haut', '', '');
  return v_id;
end;
$$;

create function public.initialiser_espace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.parametres (therapeute_id) values (new.id);
  perform public.creer_questionnaire_par_defaut(new.id);
  return new;
end;
$$;

create trigger apres_creation_therapeute
  after insert on public.therapeutes
  for each row execute function public.initialiser_espace();

-- comptes déjà existants
insert into public.parametres (therapeute_id)
select id from public.therapeutes on conflict do nothing;
select public.creer_questionnaire_par_defaut(t.id)
from public.therapeutes t
where not exists (select 1 from public.questionnaires q where q.therapeute_id = t.id);

-- Tarif proposé à la création d'une séance : celui du client, sinon le
-- tarif par défaut (si le suivi des tarifs est activé).
create function public.tarifer_seance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prix is null then
    select case when p.tarifs_actifs then coalesce(c.prix_seance, p.prix_defaut) end
      into new.prix
    from public.clients c
    left join public.parametres p on p.therapeute_id = c.therapeute_id
    where c.id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger seances_tarif before insert on public.seances
  for each row execute function public.tarifer_seance();

-- La fiche de séance enregistre aussi son tarif.
create or replace function public.enregistrer_seance(p_seance_id uuid, p_fiche jsonb)
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
    notes       = coalesce(p_fiche ->> 'notes', ''),
    prix        = case when p_fiche ? 'prix' then (p_fiche ->> 'prix')::numeric(8, 2) else prix end
  where id = p_seance_id;

  if not found then
    raise exception 'Séance introuvable.' using errcode = 'P0002';
  end if;

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
-- 9. Éditer les questionnaires (atomique, sous RLS)
-- ---------------------------------------------------------------------
-- p_questionnaire : { id?, titre, introduction, remerciement,
--                     questions: [{ id?, libelle, type, aide, obligatoire,
--                                   options, minimum, maximum, sens,
--                                   libelle_min, libelle_max, active }] }
-- Les questions absentes de la liste sont supprimées ; les envois passés
-- gardent leur copie des questions.
create function public.enregistrer_questionnaire(p_questionnaire jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid := nullif(p_questionnaire ->> 'id', '')::uuid;
  v_q     jsonb;
  v_rang  int := 0;
  v_garde uuid[] := '{}';
begin
  if v_id is null then
    insert into public.questionnaires (titre, introduction, remerciement, ordre, par_defaut)
    values (
      p_questionnaire ->> 'titre',
      coalesce(p_questionnaire ->> 'introduction', ''),
      coalesce(p_questionnaire ->> 'remerciement', ''),
      coalesce((select max(ordre) + 1 from public.questionnaires where therapeute_id = auth.uid()), 1),
      not exists (select 1 from public.questionnaires where therapeute_id = auth.uid())
    )
    returning id into v_id;
  else
    update public.questionnaires set
      titre        = p_questionnaire ->> 'titre',
      introduction = coalesce(p_questionnaire ->> 'introduction', ''),
      remerciement = coalesce(p_questionnaire ->> 'remerciement', '')
    where id = v_id;
    if not found then
      raise exception 'Questionnaire introuvable.' using errcode = 'P0002';
    end if;
  end if;

  for v_q in select * from jsonb_array_elements(coalesce(p_questionnaire -> 'questions', '[]')) loop
    v_rang := v_rang + 1;
    if nullif(v_q ->> 'id', '') is not null and exists (
      select 1 from public.questions where id = (v_q ->> 'id')::uuid and questionnaire_id = v_id
    ) then
      update public.questions set
        ordre = v_rang, libelle = v_q ->> 'libelle', type = (v_q ->> 'type')::public.type_question,
        aide = coalesce(v_q ->> 'aide', ''), obligatoire = coalesce((v_q ->> 'obligatoire')::boolean, true),
        options = coalesce(v_q -> 'options', '[]'), minimum = coalesce((v_q ->> 'minimum')::smallint, 0),
        maximum = coalesce((v_q ->> 'maximum')::smallint, 10), sens = coalesce(v_q ->> 'sens', 'haut'),
        libelle_min = coalesce(v_q ->> 'libelle_min', ''), libelle_max = coalesce(v_q ->> 'libelle_max', ''),
        active = coalesce((v_q ->> 'active')::boolean, true)
      where id = (v_q ->> 'id')::uuid;
      v_garde := v_garde || (v_q ->> 'id')::uuid;
    else
      insert into public.questions
        (questionnaire_id, ordre, libelle, type, aide, obligatoire, options, minimum, maximum, sens,
         libelle_min, libelle_max, active)
      values (
        v_id, v_rang, v_q ->> 'libelle', (v_q ->> 'type')::public.type_question,
        coalesce(v_q ->> 'aide', ''), coalesce((v_q ->> 'obligatoire')::boolean, true),
        coalesce(v_q -> 'options', '[]'), coalesce((v_q ->> 'minimum')::smallint, 0),
        coalesce((v_q ->> 'maximum')::smallint, 10), coalesce(v_q ->> 'sens', 'haut'),
        coalesce(v_q ->> 'libelle_min', ''), coalesce(v_q ->> 'libelle_max', ''),
        coalesce((v_q ->> 'active')::boolean, true)
      )
      returning array_append(v_garde, id) into v_garde;
    end if;
  end loop;

  delete from public.questions where questionnaire_id = v_id and not (id = any (v_garde));
  return v_id;
end;
$$;

create function public.definir_questionnaire_par_defaut(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.questionnaires where id = p_id) then
    raise exception 'Questionnaire introuvable.' using errcode = 'P0002';
  end if;
  update public.questionnaires set par_defaut = false where par_defaut and id <> p_id;
  update public.questionnaires set par_defaut = true where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Préparer, confirmer un envoi (thérapeute connecté)
-- ---------------------------------------------------------------------
-- Le jeton (256 bits aléatoires) n'est renvoyé qu'une fois, ici ; la
-- base n'en garde que l'empreinte SHA-256.
create function public.preparer_envoi(
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

  select case p_canal when 'email' then c.email else c.telephone end
    into v_dest
  from public.clients c
  where c.id = p_client_id and c.therapeute_id = v_uid;
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

-- Le thérapeute confirme avoir envoyé le message (historique).
create function public.confirmer_envoi(p_envoi_id uuid, p_objet text, p_corps text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  update public.envois set
    objet     = left(coalesce(p_objet, ''), 300),
    -- filet de sécurité : aucun jeton en clair dans l'historique
    corps     = regexp_replace(left(coalesce(p_corps, ''), 5000), '[0-9a-f]{64}', '[jeton masqué]', 'g'),
    envoye_le = now()
  where id = p_envoi_id and therapeute_id = auth.uid() and envoye_le is null;
  if not found then
    raise exception 'Envoi introuvable ou déjà confirmé.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Questionnaire public (client, sans compte, par son lien)
-- ---------------------------------------------------------------------
-- Ne révèle rien du client : seulement le thérapeute et les questions.
create function public.questionnaire_public(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expire    timestamptz;
  v_repondu   timestamptz;
  v_entete    jsonb;
  v_questions jsonb;
  v_nom       text;
  v_site      text;
  v_couleur   text;
begin
  select e.expire_le, e.repondu_le, e.questionnaire, e.questions,
         trim(t.prenom || ' ' || t.nom), p.nom_site, p.couleur
    into v_expire, v_repondu, v_entete, v_questions, v_nom, v_site, v_couleur
  from public.envois e
  join public.therapeutes t on t.id = e.therapeute_id
  join public.parametres p on p.therapeute_id = e.therapeute_id
  where e.jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex');

  if not found then
    return jsonb_build_object('valide', false, 'raison', 'inconnu');
  end if;
  if v_repondu is not null then
    return jsonb_build_object('valide', false, 'raison', 'deja_repondu', 'nom_site', v_site, 'couleur', v_couleur);
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

-- Réponses : format { "<id de question>": valeur }. Une seule réponse
-- par lien ; chaque valeur est contrôlée selon le type de la question.
create function public.repondre_questionnaire(p_jeton text, p_reponses jsonb)
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
  select e.id, e.questions, e.expire_le, e.repondu_le
    into v_id, v_question, v_expire, v_repondu
  from public.envois e
  where e.jeton_hash = encode(sha256(convert_to(coalesce(p_jeton, ''), 'UTF8')), 'hex')
  for update;

  if v_id is null then
    raise exception 'Lien inconnu.' using errcode = 'P0002';
  end if;
  if v_repondu is not null then
    raise exception 'Ce questionnaire a déjà été rempli.' using errcode = '23505';
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

  update public.envois set reponses = v_resultat, repondu_le = now() where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 12. Sécurité au niveau des lignes et privilèges
-- ---------------------------------------------------------------------
alter table public.parametres         enable row level security;
alter table public.questionnaires     enable row level security;
alter table public.questions          enable row level security;
alter table public.envois             enable row level security;
alter table public.journal_connexions enable row level security;
alter table public.usage_ia           enable row level security;

create policy "propriétaire uniquement" on public.parametres
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.questionnaires
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.questions
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.envois
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.journal_connexions
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
-- usage_ia : aucune politique, donc aucun accès direct (seulement par les fonctions)

create policy "double authentification" on public.envois as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.questionnaires as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.questions as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));

revoke all on public.parametres, public.questionnaires, public.questions, public.envois,
  public.journal_connexions, public.usage_ia
  from anon, authenticated;

grant select on public.parametres to authenticated;
grant update (nom_site, couleur, taille_texte, densite, vision, reduire_animations, page_accueil,
              specialite, telephone_pro, signature, photo,
              tarifs_actifs, prix_defaut, relances_actives, relance_delai_jours,
              relance_intervalle_jours, relance_max, lien_validite_jours, modele_email_objet,
              modele_email, modele_sms, deconnexion_minutes, ia_taches, ia_quota_jour)
  on public.parametres to authenticated;

grant select, insert, delete on public.questionnaires to authenticated;
grant update (titre, introduction, remerciement, par_defaut, ordre) on public.questionnaires to authenticated;
grant select, insert, delete on public.questions to authenticated;
grant update (ordre, libelle, type, aide, obligatoire, options, minimum, maximum, sens,
              libelle_min, libelle_max, active)
  on public.questions to authenticated;

-- Les envois se créent et se confirment par les fonctions ci-dessus.
grant select, delete on public.envois to authenticated;
grant update (consulte_le, analyse_ia, analyse_ia_le) on public.envois to authenticated;

grant select, insert on public.journal_connexions to authenticated;

revoke all on function
  public.creer_questionnaire_par_defaut(uuid),
  public.initialiser_espace(),
  public.tarifer_seance(),
  public.proteger_questionnaire_par_defaut(),
  public.enregistrer_questionnaire(jsonb),
  public.definir_questionnaire_par_defaut(uuid),
  public.preparer_envoi(uuid, public.canal_envoi, uuid),
  public.confirmer_envoi(uuid, text, text),
  public.questionnaire_public(text),
  public.repondre_questionnaire(text, jsonb),
  public.consommer_quota_ia(),
  public.quota_ia()
from public, anon, authenticated;

grant execute on function public.enregistrer_questionnaire(jsonb) to authenticated;
grant execute on function public.definir_questionnaire_par_defaut(uuid) to authenticated;
grant execute on function public.preparer_envoi(uuid, public.canal_envoi, uuid) to authenticated;
grant execute on function public.confirmer_envoi(uuid, text, text) to authenticated;
grant execute on function public.consommer_quota_ia() to authenticated;
grant execute on function public.quota_ia() to authenticated;
-- seules fonctions accessibles sans compte : le jeton fait office de clé
grant execute on function public.questionnaire_public(text) to anon, authenticated;
grant execute on function public.repondre_questionnaire(text, jsonb) to anon, authenticated;

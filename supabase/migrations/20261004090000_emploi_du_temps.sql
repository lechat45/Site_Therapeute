-- =====================================================================
--  Emploi du temps (version 0.6.0)
--   * rendez-vous colorés par catégorie (premier rendez-vous, séance de
--     suivi, bilan, administratif, personnel), avec statut et modalité ;
--   * rappel de rendez-vous préparé à la main (comme les relances) ;
--   * réglages : heures et jours de travail, durée par défaut, couleurs
--     des catégories, modèle du message de rappel.
--  Les couleurs proposées par défaut restent distinctes sous les trois
--  daltonismes ; chaque catégorie a aussi un pictogramme et un motif.
-- =====================================================================

create type public.categorie_rdv as enum ('premier', 'seance', 'bilan', 'administratif', 'personnel');
create type public.statut_rdv as enum ('prevu', 'honore', 'absent', 'annule');
create type public.modalite_rdv as enum ('cabinet', 'visio', 'telephone', 'domicile');

create table public.rendez_vous (
  id               uuid primary key default gen_random_uuid(),
  therapeute_id    uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  client_id        uuid,
  categorie        public.categorie_rdv not null default 'seance',
  statut           public.statut_rdv not null default 'prevu',
  modalite         public.modalite_rdv not null default 'cabinet',
  debut            timestamptz not null,
  fin              timestamptz not null,
  -- intitulé des créneaux sans fiche client (premier contact, administratif, personnel)
  titre            text not null default '' check (length(titre) <= 120),
  note             text not null default '' check (length(note) <= 1000),
  seance_id        uuid references public.seances (id) on delete set null,
  rappel_envoye_le timestamptz,
  cree_le          timestamptz not null default now(),
  check (fin > debut and fin - debut <= interval '12 hours'),
  -- une séance de suivi ou un bilan concerne toujours un client
  check (categorie not in ('seance', 'bilan') or client_id is not null),
  check (client_id is not null or length(trim(titre)) > 0),
  foreign key (client_id, therapeute_id)
    references public.clients (id, therapeute_id) on delete cascade
);
create index rendez_vous_therapeute_debut on public.rendez_vous (therapeute_id, debut);

-- Lecture courante : sans les rendez-vous des clients mis à la corbeille.
create view public.agenda
with (security_invoker = on) as
select r.*
from public.rendez_vous r
left join public.clients c on c.id = r.client_id
where c.supprime_le is null;

alter table public.rendez_vous enable row level security;
create policy "propriétaire uniquement" on public.rendez_vous
  for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "double authentification" on public.rendez_vous as restrictive
  for all to authenticated using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));

revoke all on public.rendez_vous, public.agenda from anon, authenticated;
grant select, insert, delete on public.rendez_vous to authenticated;
grant update (client_id, categorie, statut, modalite, debut, fin, titre, note, seance_id, rappel_envoye_le)
  on public.rendez_vous to authenticated;
grant select on public.agenda to authenticated;

-- ---------------------------------------------------------------------
-- Réglages de l'emploi du temps
-- ---------------------------------------------------------------------
alter table public.parametres
  add column agenda_heure_debut smallint not null default 8 check (agenda_heure_debut between 0 and 23),
  add column agenda_heure_fin   smallint not null default 20 check (agenda_heure_fin between 1 and 24),
  -- jours ouvrés, 1 = lundi … 7 = dimanche
  add column agenda_jours       smallint[] not null default '{1,2,3,4,5}'
                                check (agenda_jours <@ '{1,2,3,4,5,6,7}' and cardinality(agenda_jours) between 1 and 7),
  add column duree_rdv_minutes  smallint not null default 60 check (duree_rdv_minutes between 15 and 240),
  -- couleurs choisies par catégorie ({ "bilan": "#b42318", … }) ; vide = couleurs adaptées à tous
  add column agenda_couleurs    jsonb not null default '{}' check (jsonb_typeof(agenda_couleurs) = 'object'),
  add column modele_rappel      text not null
                                default 'Bonjour {prenom}, je vous rappelle notre rendez-vous du {date} à {heure} ({lieu}). En cas d''empêchement, merci de me prévenir. {signature}'
                                check (length(modele_rappel) <= 1000),
  add constraint parametres_agenda_heures check (agenda_heure_debut < agenda_heure_fin);

alter table public.parametres drop constraint parametres_page_accueil_check;
alter table public.parametres add constraint parametres_page_accueil_check
  check (page_accueil in ('/', '/clients', '/taches', '/emploi-du-temps'));

grant update (agenda_heure_debut, agenda_heure_fin, agenda_jours, duree_rdv_minutes, agenda_couleurs, modele_rappel)
  on public.parametres to authenticated;

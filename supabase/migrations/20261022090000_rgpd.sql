-- =====================================================================
-- RGPD (0.13.0) : consentement du client au traitement de ses données
-- =====================================================================
-- Les notes de séance et les réponses aux questionnaires sont des données de santé
-- (RGPD, article 9). Base légale retenue : le consentement explicite du client,
-- recueilli par le thérapeute (formulaire signé, écrit). La base garde la DATE à
-- laquelle il a été noté ; `null` = pas encore noté (l'application le signale sur la
-- fiche). Voir docs/RGPD.md.
--
-- Les autres droits sont déjà couverts : rectification (fiche modifiable), effacement
-- (corbeille puis suppression définitive, en cascade), accès et portabilité (export
-- JSON assemblé par l'application à partir des lectures existantes, RLS comprise).

alter table public.clients
  add column consentement_le date;

comment on column public.clients.consentement_le is
  'Date à laquelle le consentement du client au traitement de ses données a été noté (RGPD, art. 9) ; null = non noté.';

grant update (consentement_le) on public.clients to authenticated;

-- Colonne ajoutée en fin de vue (seule forme permise par « or replace ») ; le reste est
-- la définition de 20261003100000_ameliorations, inchangée.
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
  c.accord_relance_le,
  c.consentement_le
from public.clients c;

-- ---------------------------------------------------------------------
-- Durée de conservation du journal des connexions : 12 mois
-- (miroir : DUREE_JOURNAL_CONNEXIONS_MOIS, src/config/rgpd.ts ; mode démo : demo.ts)
-- ---------------------------------------------------------------------
-- Appelée par l'application à l'ouverture de la liste des clients, comme purger_corbeille ;
-- le journal n'est pas modifiable par le thérapeute (pas de « delete » accordé), d'où
-- « security definer », limité à ses propres lignes.
create function public.purger_journal_connexions()
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  with efface as (
    delete from public.journal_connexions
    where therapeute_id = auth.uid() and le < now() - interval '12 months'
    returning 1
  )
  select count(*)::int from efface;
$$;

revoke all on function public.purger_journal_connexions() from public, anon, authenticated;
grant execute on function public.purger_journal_connexions() to authenticated;

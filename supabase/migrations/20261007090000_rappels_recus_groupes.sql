-- =====================================================================
--  Version 0.9.0
--   1. Rappel d'un exercice non rendu : après N jours (réglable), une tâche
--      propose de renvoyer un lien au client (préparé, envoyé à la main).
--   2. Reçu groupé : un seul reçu pour plusieurs séances d'un même client.
--      Chaque reçu a désormais ses lignes (une par séance) ; une séance ne
--      figure que sur un seul reçu valide.
--  (Les réponses d'exercice sur la fiche de séance et le livre des recettes
--  se calculent dans l'application, sans changement de schéma.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rappel d'un exercice non rendu
-- ---------------------------------------------------------------------
alter table public.parametres
  add column exercice_rappel_jours smallint not null default 7 check (exercice_rappel_jours between 0 and 60);
grant update (exercice_rappel_jours) on public.parametres to authenticated;

-- questions_document est pure : la colonne calculée doit pouvoir l'évaluer
-- lors de toute mise à jour d'une remise (ex. consulte_le par le thérapeute).
grant execute on function public.questions_document(text) to authenticated;

alter table public.remises
  add column nb_questions int generated always as (cardinality(public.questions_document(contenu))) stored,
  add column rappel_le timestamptz;

create or replace view public.remises_actives with (security_invoker = on) as
select r.id, r.client_id, r.document_id, r.mode, r.titre, r.cree_le, r.expire_le, r.ouvert_le,
       r.reponses, r.repondu_le, r.consulte_le, r.nb_questions, r.rappel_le
from public.remises r join public.clients c on c.id = r.client_id where c.supprime_le is null;

-- Nouveau lien pour un exercice pas encore rendu (l'ancien ne marche plus) ;
-- le jeton n'est renvoyé qu'ici. Le rappel est noté : la tâche disparaît.
create function public.relancer_remise(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  r       public.remises;
  v_jeton text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_exp   timestamptz := now() + interval '90 days';
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into r from public.remises where id = p_id and therapeute_id = v_uid for update;
  if not found then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.clients where id = r.client_id and supprime_le is not null) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  if r.mode <> 'lien' then
    raise exception 'Ce document a été remis sur papier.' using errcode = '22023';
  end if;
  if r.repondu_le is not null then
    raise exception 'Le client a déjà répondu.' using errcode = '22023';
  end if;
  update public.remises
  set jeton_hash = encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), expire_le = v_exp, rappel_le = now()
  where id = r.id;
  return jsonb_build_object('jeton', v_jeton, 'expire_le', v_exp);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Reçus groupés : lignes de reçu
-- ---------------------------------------------------------------------
create table public.recus_lignes (
  id            uuid primary key default gen_random_uuid(),
  recu_id       uuid not null references public.recus (id) on delete cascade,
  therapeute_id uuid not null references public.therapeutes (id) on delete cascade,
  seance_id     uuid references public.seances (id) on delete set null,
  date_seance   date not null,
  prestation    text not null,
  montant       numeric(8, 2) not null check (montant >= 0),
  -- recopie de l'annulation du reçu : permet l'unicité ci-dessous
  annule        boolean not null default false,
  ordre         smallint not null
);
create index recus_lignes_recu on public.recus_lignes (recu_id, ordre);
-- une séance ne figure que sur un seul reçu valide (seul ou groupé)
create unique index recus_lignes_une_par_seance on public.recus_lignes (seance_id) where not annule;

-- les reçus déjà émis reçoivent leur ligne unique
insert into public.recus_lignes (recu_id, therapeute_id, seance_id, date_seance, prestation, montant, annule, ordre)
select id, therapeute_id, seance_id, date_seance, prestation, montant, annule_le is not null, 1 from public.recus;

alter table public.recus_lignes enable row level security;
create policy "propriétaire uniquement" on public.recus_lignes for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "double authentification" on public.recus_lignes as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
revoke all on public.recus_lignes from anon, authenticated;
-- lecture seule : les lignes naissent et s'annulent avec leur reçu
grant select on public.recus_lignes to authenticated;

-- Reçu d'une séance (comme en 0.7.0), avec sa ligne.
create or replace function public.emettre_recu(p_seance uuid, p_mode text, p_date_emission date)
returns public.recus
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  s       public.seances;
  c       public.clients;
  t       public.therapeutes;
  p       public.parametres;
  v_annee smallint := extract(year from p_date_emission)::smallint;
  v_prest text;
  r       public.recus;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into s from public.seances where id = p_seance and therapeute_id = v_uid;
  if not found then
    raise exception 'Séance introuvable.' using errcode = 'P0002';
  end if;
  if s.prix is null then
    raise exception 'Indiquez d''abord le tarif de cette séance.' using errcode = '22023';
  end if;
  if exists (select 1 from public.recus_lignes where seance_id = s.id and not annule) then
    raise exception 'Un reçu a déjà été émis pour cette séance.' using errcode = '23505';
  end if;
  if p_date_emission is null or p_date_emission < s.date_seance or p_date_emission > current_date + 1 then
    raise exception 'La date du reçu doit être comprise entre la séance et aujourd''hui.' using errcode = '22023';
  end if;
  select * into c from public.clients where id = s.client_id;
  if c.supprime_le is not null then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  select * into t from public.therapeutes where id = v_uid;
  select * into p from public.parametres where therapeute_id = v_uid;
  v_prest := 'Séance d''accompagnement comportemental et émotionnel n° ' || s.numero
    || case s.type when 'bilan' then ' (bilan)' else '' end;

  perform pg_advisory_xact_lock(hashtext('recus:' || v_uid::text || ':' || v_annee::text));
  insert into public.recus (therapeute_id, annee, numero, client_id, seance_id, client_nom, date_seance,
                            date_emission, prestation, montant, mode_reglement, emetteur)
  values (
    v_uid, v_annee,
    coalesce((select max(numero) from public.recus where therapeute_id = v_uid and annee = v_annee), 0) + 1,
    c.id, s.id, trim(c.prenom || ' ' || c.nom), s.date_seance, p_date_emission, v_prest, s.prix, p_mode,
    jsonb_build_object(
      'nom', trim(t.prenom || ' ' || t.nom), 'specialite', p.specialite, 'adresse', p.adresse_pro,
      'telephone', p.telephone_pro, 'siret', p.siret, 'mention', p.mention_recu
    )
  )
  returning * into r;
  insert into public.recus_lignes (recu_id, therapeute_id, seance_id, date_seance, prestation, montant, ordre)
  values (r.id, v_uid, s.id, s.date_seance, v_prest, s.prix, 1);
  return r;
end;
$$;

-- Un seul reçu pour plusieurs séances tarifées d'un même client (2 à 31),
-- lignes dans l'ordre des dates ; même numérotation que les autres reçus.
create function public.emettre_recu_groupe(p_seances uuid[], p_mode text, p_date_emission date)
returns public.recus
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_nb      int := cardinality(array(select distinct unnest(p_seances)));
  v_client  uuid;
  v_derniere date;
  v_total   numeric(10, 2);
  c         public.clients;
  t         public.therapeutes;
  p         public.parametres;
  v_annee   smallint := extract(year from p_date_emission)::smallint;
  r         public.recus;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if coalesce(v_nb, 0) < 2 or v_nb > 31 then
    raise exception 'Choisissez de 2 à 31 séances pour un reçu groupé.' using errcode = '22023';
  end if;
  if (select count(*) from public.seances where id = any (p_seances) and therapeute_id = v_uid) <> v_nb then
    raise exception 'Séance introuvable.' using errcode = 'P0002';
  end if;
  if (select count(distinct client_id) from public.seances where id = any (p_seances)) <> 1 then
    raise exception 'Un reçu groupé concerne un seul client.' using errcode = '22023';
  end if;
  if exists (select 1 from public.seances where id = any (p_seances) and prix is null) then
    raise exception 'Indiquez d''abord le tarif de chaque séance.' using errcode = '22023';
  end if;
  if exists (select 1 from public.recus_lignes where seance_id = any (p_seances) and not annule) then
    raise exception 'Un reçu a déjà été émis pour l''une de ces séances.' using errcode = '23505';
  end if;
  select min(client_id::text)::uuid, max(date_seance), sum(prix) into v_client, v_derniere, v_total
  from public.seances where id = any (p_seances);
  if p_date_emission is null or p_date_emission < v_derniere or p_date_emission > current_date + 1 then
    raise exception 'La date du reçu doit être comprise entre la dernière séance et aujourd''hui.'
      using errcode = '22023';
  end if;
  select * into c from public.clients where id = v_client;
  if c.supprime_le is not null then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  select * into t from public.therapeutes where id = v_uid;
  select * into p from public.parametres where therapeute_id = v_uid;

  perform pg_advisory_xact_lock(hashtext('recus:' || v_uid::text || ':' || v_annee::text));
  insert into public.recus (therapeute_id, annee, numero, client_id, seance_id, client_nom, date_seance,
                            date_emission, prestation, montant, mode_reglement, emetteur)
  values (
    v_uid, v_annee,
    coalesce((select max(numero) from public.recus where therapeute_id = v_uid and annee = v_annee), 0) + 1,
    c.id, null, trim(c.prenom || ' ' || c.nom), v_derniere, p_date_emission,
    'Séances d''accompagnement comportemental et émotionnel (' || v_nb || ')', v_total, p_mode,
    jsonb_build_object(
      'nom', trim(t.prenom || ' ' || t.nom), 'specialite', p.specialite, 'adresse', p.adresse_pro,
      'telephone', p.telephone_pro, 'siret', p.siret, 'mention', p.mention_recu
    )
  )
  returning * into r;
  insert into public.recus_lignes (recu_id, therapeute_id, seance_id, date_seance, prestation, montant, ordre)
  select r.id, v_uid, s.id, s.date_seance,
         'Séance d''accompagnement comportemental et émotionnel n° ' || s.numero
           || case s.type when 'bilan' then ' (bilan)' else '' end,
         s.prix, row_number() over (order by s.date_seance, s.numero)
  from public.seances s where s.id = any (p_seances);
  return r;
end;
$$;

-- Annuler un reçu libère aussi ses séances (elles peuvent recevoir un nouveau reçu).
create or replace function public.annuler_recu(p_id uuid, p_motif text)
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
  if coalesce(trim(p_motif), '') = '' then
    raise exception 'Indiquez le motif de l''annulation.' using errcode = '22023';
  end if;
  update public.recus set annule_le = now(), motif_annulation = left(trim(p_motif), 300)
  where id = p_id and therapeute_id = auth.uid() and annule_le is null;
  if not found then
    raise exception 'Reçu introuvable ou déjà annulé.' using errcode = 'P0002';
  end if;
  update public.recus_lignes set annule = true where recu_id = p_id;
end;
$$;

-- La page du client affiche aussi les lignes du reçu.
create or replace function public.recu_public(p_jeton text)
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
      'motif_annulation', r.motif_annulation,
      'lignes', coalesce((
        select jsonb_agg(jsonb_build_object('date_seance', l.date_seance, 'prestation', l.prestation,
                                            'montant', l.montant) order by l.ordre)
        from public.recus_lignes l where l.recu_id = r.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Privilèges des nouvelles fonctions
-- ---------------------------------------------------------------------
revoke all on function
  public.relancer_remise(uuid),
  public.emettre_recu_groupe(uuid[], text, date)
from public, anon, authenticated;
grant execute on function public.relancer_remise(uuid) to authenticated;
grant execute on function public.emettre_recu_groupe(uuid[], text, date) to authenticated;

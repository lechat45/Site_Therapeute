-- =====================================================================
--  Version 0.7.0
--   1. Journal : notes du thérapeute, libres ou liées à un client.
--   2. Exercices et documents : bibliothèque personnelle, remise à un
--      client par lien personnel (lecture seule, sans compte) ou imprimée.
--   3. Reçus (notes d'honoraires) : numérotation continue par année,
--      sans trou ni doublon ; un reçu émis ne se modifie plus, il s'annule.
--   4. Tâches personnelles et « plus tard » sur n'importe quelle tâche.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Journal
-- ---------------------------------------------------------------------
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  client_id     uuid,
  titre         text not null default '' check (length(titre) <= 120),
  contenu       text not null default '' check (length(contenu) <= 20000),
  epinglee      boolean not null default false,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  check (length(trim(titre)) > 0 or length(trim(contenu)) > 0),
  foreign key (client_id, therapeute_id) references public.clients (id, therapeute_id) on delete cascade
);
create index notes_therapeute on public.notes (therapeute_id, maj_le desc);
create trigger notes_maj before update on public.notes for each row execute function public.horodater_maj();

-- ---------------------------------------------------------------------
-- 2. Exercices et documents
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  titre         text not null check (length(trim(titre)) between 1 and 120),
  categorie     text not null default 'exercice' check (categorie in ('exercice', 'fiche', 'lecture', 'autre')),
  resume        text not null default '' check (length(resume) <= 300),
  contenu       text not null default '' check (length(contenu) <= 20000),
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);
create trigger documents_maj before update on public.documents for each row execute function public.horodater_maj();

-- Ce qui a été remis à un client : une COPIE du document (le modifier ensuite
-- ne change pas ce que le client a reçu). Lien : seule l'empreinte du jeton
-- est stockée ; imprimé : pas de lien.
create table public.remises (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid(),
  client_id     uuid not null,
  document_id   uuid references public.documents (id) on delete set null,
  mode          text not null check (mode in ('lien', 'imprime')),
  titre         text not null,
  contenu       text not null,
  jeton_hash    text unique,
  cree_le       timestamptz not null default now(),
  expire_le     timestamptz,
  ouvert_le     timestamptz,
  check ((mode = 'lien') = (jeton_hash is not null)),
  foreign key (client_id, therapeute_id) references public.clients (id, therapeute_id) on delete cascade
);
create index remises_client on public.remises (client_id, cree_le desc);

-- Prépare la remise d'un document à un client ; le jeton n'est renvoyé qu'ici.
create function public.preparer_remise(p_document uuid, p_client uuid, p_mode text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_doc   public.documents;
  v_jeton text;
  v_id    uuid;
  v_exp   timestamptz;
begin
  if v_uid is null or not public.mfa_satisfaite() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if p_mode not in ('lien', 'imprime') then
    raise exception 'Mode de remise inconnu.' using errcode = '22023';
  end if;
  select * into v_doc from public.documents where id = p_document and therapeute_id = v_uid;
  if not found then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.clients where id = p_client and therapeute_id = v_uid and supprime_le is null) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  if p_mode = 'lien' then
    v_jeton := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    v_exp := now() + interval '90 days';
  end if;
  insert into public.remises (therapeute_id, client_id, document_id, mode, titre, contenu, jeton_hash, expire_le)
  values (v_uid, p_client, p_document, p_mode, v_doc.titre, v_doc.contenu,
          case when v_jeton is null then null else encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex') end, v_exp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'jeton', v_jeton, 'expire_le', v_exp);
end;
$$;

-- Lecture publique d'un document remis (sans compte) ; note la première ouverture.
create function public.document_public(p_jeton text)
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
    'nom_site', v_site, 'couleur', v_couleur, 'expire_le', r.expire_le
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Reçus (notes d'honoraires)
-- ---------------------------------------------------------------------
alter table public.parametres
  add column adresse_pro  text not null default '' check (length(adresse_pro) <= 300),
  add column siret        text not null default '' check (siret = '' or siret ~ '^[0-9 ]{9,17}$'),
  add column mention_recu text not null default 'TVA non applicable, article 293 B du CGI.'
                          check (length(mention_recu) <= 300);
grant update (adresse_pro, siret, mention_recu) on public.parametres to authenticated;

create table public.recus (
  id                uuid primary key default gen_random_uuid(),
  therapeute_id     uuid not null references public.therapeutes (id) on delete cascade,
  annee             smallint not null,
  numero            int not null check (numero > 0),
  -- Les reçus sont des pièces comptables : ils survivent à l'effacement du
  -- client (nom conservé dans client_nom), d'où une clé étrangère simple.
  client_id         uuid references public.clients (id) on delete set null,
  seance_id         uuid references public.seances (id) on delete set null,
  client_nom        text not null,
  date_seance       date not null,
  date_emission     date not null,
  prestation        text not null,
  montant           numeric(8, 2) not null check (montant >= 0),
  mode_reglement    text not null check (mode_reglement in ('especes', 'cheque', 'virement', 'carte', 'autre')),
  emetteur          jsonb not null,
  annule_le         timestamptz,
  motif_annulation  text not null default '' check (length(motif_annulation) <= 300),
  cree_le           timestamptz not null default now(),
  unique (therapeute_id, annee, numero)
);
-- un seul reçu valide par séance
create unique index recus_un_par_seance on public.recus (seance_id) where annule_le is null;

-- Émet le reçu d'une séance tarifée. Numéro suivant de l'année, attribué
-- sous verrou : pas de trou, pas de doublon.
create function public.emettre_recu(p_seance uuid, p_mode text, p_date_emission date)
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
  if exists (select 1 from public.recus where seance_id = s.id and annule_le is null) then
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

  perform pg_advisory_xact_lock(hashtext('recus:' || v_uid::text || ':' || v_annee::text));
  insert into public.recus (therapeute_id, annee, numero, client_id, seance_id, client_nom, date_seance,
                            date_emission, prestation, montant, mode_reglement, emetteur)
  values (
    v_uid, v_annee,
    coalesce((select max(numero) from public.recus where therapeute_id = v_uid and annee = v_annee), 0) + 1,
    c.id, s.id, trim(c.prenom || ' ' || c.nom), s.date_seance, p_date_emission,
    'Séance d''accompagnement comportemental et émotionnel n° ' || s.numero
      || case s.type when 'bilan' then ' (bilan)' else '' end,
    s.prix, p_mode,
    jsonb_build_object(
      'nom', trim(t.prenom || ' ' || t.nom), 'specialite', p.specialite, 'adresse', p.adresse_pro,
      'telephone', p.telephone_pro, 'siret', p.siret, 'mention', p.mention_recu
    )
  )
  returning * into r;
  return r;
end;
$$;

-- Un reçu ne s'efface pas : il s'annule, avec un motif, une seule fois.
create function public.annuler_recu(p_id uuid, p_motif text)
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
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Tâches personnelles et reports « plus tard »
-- ---------------------------------------------------------------------
create table public.taches_perso (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  client_id     uuid,
  titre         text not null check (length(trim(titre)) between 1 and 200),
  echeance      date,
  faite_le      timestamptz,
  cree_le       timestamptz not null default now(),
  foreign key (client_id, therapeute_id) references public.clients (id, therapeute_id) on delete cascade
);

-- Une tâche calculée (relance, questionnaire, rappel…) est identifiée par sa
-- clé ; la reporter la masque jusqu'à la date choisie.
create table public.reports_taches (
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  cle           text not null check (length(cle) between 1 and 200),
  jusqua        date not null,
  primary key (therapeute_id, cle)
);

-- ---------------------------------------------------------------------
-- Vues de lecture (sans les clients de la corbeille)
-- ---------------------------------------------------------------------
create view public.journal with (security_invoker = on) as
select n.* from public.notes n left join public.clients c on c.id = n.client_id where c.supprime_le is null;

create view public.mes_taches with (security_invoker = on) as
select t.* from public.taches_perso t left join public.clients c on c.id = t.client_id where c.supprime_le is null;

create view public.remises_actives with (security_invoker = on) as
select r.id, r.client_id, r.document_id, r.mode, r.titre, r.cree_le, r.expire_le, r.ouvert_le
from public.remises r join public.clients c on c.id = r.client_id where c.supprime_le is null;

-- ---------------------------------------------------------------------
-- Sécurité au niveau des lignes et privilèges
-- ---------------------------------------------------------------------
alter table public.notes          enable row level security;
alter table public.documents      enable row level security;
alter table public.remises        enable row level security;
alter table public.recus          enable row level security;
alter table public.taches_perso   enable row level security;
alter table public.reports_taches enable row level security;

create policy "propriétaire uniquement" on public.notes for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.documents for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.remises for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.recus for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.taches_perso for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "propriétaire uniquement" on public.reports_taches for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));

create policy "double authentification" on public.notes as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.documents as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.remises as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.recus as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.taches_perso as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
create policy "double authentification" on public.reports_taches as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));

revoke all on public.notes, public.documents, public.remises, public.recus, public.taches_perso,
  public.reports_taches, public.journal, public.mes_taches, public.remises_actives
  from anon, authenticated;

grant select, insert, delete on public.notes to authenticated;
grant update (client_id, titre, contenu, epinglee) on public.notes to authenticated;
grant select, insert, delete on public.documents to authenticated;
grant update (titre, categorie, resume, contenu) on public.documents to authenticated;
-- remises : créées par preparer_remise ; lecture (sans le contenu complet, par la vue) et suppression
grant select, delete on public.remises to authenticated;
-- reçus : lecture seule ; émission et annulation par fonctions
grant select on public.recus to authenticated;
grant select, insert, delete on public.taches_perso to authenticated;
grant update (client_id, titre, echeance, faite_le) on public.taches_perso to authenticated;
grant select, insert, update, delete on public.reports_taches to authenticated;
grant select on public.journal, public.mes_taches, public.remises_actives to authenticated;

revoke all on function
  public.preparer_remise(uuid, uuid, text),
  public.document_public(text),
  public.emettre_recu(uuid, text, date),
  public.annuler_recu(uuid, text)
from public, anon, authenticated;
grant execute on function public.preparer_remise(uuid, uuid, text) to authenticated;
grant execute on function public.emettre_recu(uuid, text, date) to authenticated;
grant execute on function public.annuler_recu(uuid, text) to authenticated;
-- seule fonction ouverte sans compte : le jeton fait office de clé
grant execute on function public.document_public(text) to anon, authenticated;

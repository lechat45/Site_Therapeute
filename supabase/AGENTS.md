# supabase/ — base de données et fonction IA

Complète `../AGENTS.md`.

## Migrations : ajout seulement

`migrations/` est rejoué dans l'ordre des noms sur toute nouvelle installation et par les tests
(`tests/supabaseLocal.ts`). **Ne jamais modifier une migration livrée** : créer
`AAAAMMJJHHMMSS_description.sql` (horodatage postérieur au dernier fichier).

| Migration | Contenu |
|---|---|
| `20260930120000_schema_initial` | thérapeutes, clients, séances, cases de la fiche, référentiels ; RLS ; `statistiques`, `enregistrer_seance`, numérotation du parcours, `mfa_satisfaite` |
| `20260930120100_referentiels` | 14 émotions, problématiques, tranches d'âge |
| `20261001090000_relances_questionnaires` | `parametres`, questionnaires et questions, `envois` (liens), journal des connexions, quota IA, tarifs |
| `20261003100000_ameliorations` | corbeille (`supprime_le`, `purger_corbeille`, vue `clients_resume`), accord de relance, lien actif une fois sorti, plafond IA commun (`plateforme`), statistiques par période |
| `20261004090000_emploi_du_temps` | `rendez_vous`, vue `agenda`, réglages d'horaires, de couleurs et de rappel |
| `20261005090000_journal_exercices_recus` | `notes`, `documents`, `remises`, `recus`, `taches_perso`, `reports_taches` ; vues `journal`, `mes_taches`, `remises_actives` ; coordonnées des reçus |
| `20261006090000_prolongements` | reçu par lien, réponses aux exercices, tâches récurrentes |
| `20261007090000_rappels_recus_groupes` | rappel d'exercice non rendu, `recus_lignes` et reçus groupés |
| `20261022090000_rgpd` | consentement du client (`clients.consentement_le`, vue `clients_resume`), purge du journal des connexions à 12 mois |

## Où est la version ACTUELLE d'une fonction ou d'une vue

Plusieurs fonctions ont été redéfinies (`create or replace`) : lire la **dernière** définition.

| Fonction / vue | Rôle | Dernière définition |
|---|---|---|
| `statistiques(perimetre, reference, periode)` | tableau de bord personnel / groupe (seuils d'anonymat) | `ameliorations` |
| `enregistrer_seance(id, fiche)` | fiche de séance + cases, atomique | `relances_questionnaires` |
| `numeroter_seance`, `proteger_numerotation`, `tarifer_seance` | déclencheurs du parcours et du tarif | `schema_initial`, `relances_questionnaires` |
| `enregistrer_questionnaire`, `definir_questionnaire_par_defaut` | questionnaires du thérapeute | `relances_questionnaires` |
| `preparer_envoi(client, canal, questionnaire?)` | lien de questionnaire (jeton renvoyé une fois) | `ameliorations` |
| `confirmer_envoi(id, objet, corps)` | historique, jeton masqué | `relances_questionnaires` |
| `questionnaire_public(jeton)` / `repondre_questionnaire(jeton, réponses)` | **sans compte** | `ameliorations` |
| `consommer_quota_ia()` / `quota_ia()` | quota Gemini par thérapeute et commun | `ameliorations` |
| `purger_corbeille()` | efface les clients restés 30 jours dans la corbeille | `ameliorations` |
| `purger_journal_connexions()` | efface ses connexions de plus de 12 mois (RGPD) | `rgpd` |
| `preparer_remise(document, client, mode)` | remise d'un document (copie figée ; lien ou papier) | `journal_exercices_recus` |
| `document_public(jeton)` | **sans compte** : le document remis (+ `repondu_le`) | `prolongements` |
| `questions_document(texte)` | questions « ? » (miroir de `questionsDocument`) | `prolongements` |
| `repondre_document(jeton, réponses)` | **sans compte** : réponses à un exercice, une fois | `prolongements` |
| `relancer_remise(id)` | exercice non rendu : nouveau lien, rappel noté | `rappels_recus_groupes` |
| `emettre_recu(séance, mode, date)` | reçu d'une séance (+ sa ligne) | `rappels_recus_groupes` |
| `emettre_recu_groupe(séances, mode, date)` | reçu pour 2 à 31 séances d'un client | `rappels_recus_groupes` |
| `annuler_recu(id, motif)` | seule « modification » d'un reçu (annule aussi les lignes) | `rappels_recus_groupes` |
| `preparer_lien_recu(id)` | lien vers un reçu (remplace le précédent) | `prolongements` |
| `recu_public(jeton)` | **sans compte** : le reçu et ses lignes | `rappels_recus_groupes` |
| `echeance_suivante(...)`, déclencheur `tache_recurrente` | tâches récurrentes (miroir de `echeanceSuivante`) | `prolongements` |
| `mfa_satisfaite()` | vrai si la session a fourni le code (ou si la 2FA n'est pas activée) | `schema_initial` |
| vues `clients_resume`, `agenda`, `journal`, `mes_taches`, `remises_actives` | lectures sans les clients de la corbeille | `rgpd` (clients_resume), `emploi_du_temps`, `journal_exercices_recus`, `prolongements`, `rappels_recus_groupes` |

Pour retrouver une définition : `grep -n "function public.nom" supabase/migrations/*.sql`
(la dernière ligne trouvée est la bonne).

## Conventions (toute nouvelle table ou fonction)

```sql
create table public.ma_table (
  id            uuid primary key default gen_random_uuid(),
  therapeute_id uuid not null default auth.uid() references public.therapeutes (id) on delete cascade,
  client_id     uuid,                                     -- facultatif
  -- … colonnes avec des check() explicites …
  foreign key (client_id, therapeute_id) references public.clients (id, therapeute_id) on delete cascade
);
alter table public.ma_table enable row level security;
create policy "propriétaire uniquement" on public.ma_table for all to authenticated
  using (therapeute_id = (select auth.uid())) with check (therapeute_id = (select auth.uid()));
create policy "double authentification" on public.ma_table as restrictive for all to authenticated
  using ((select public.mfa_satisfaite())) with check ((select public.mfa_satisfaite()));
revoke all on public.ma_table from anon, authenticated;
grant select, insert, delete on public.ma_table to authenticated;
grant update (colonne1, colonne2) on public.ma_table to authenticated;   -- au plus juste
```

- Clé étrangère **composite** `(client_id, therapeute_id)` : impossible de rattacher une ligne au
  client d'un confrère, même en forgeant une requête.
- Fonctions `security definer` : `set search_path = ''`, noms qualifiés (`public.table`),
  vérifier `auth.uid()` et `public.mfa_satisfaite()` au début, puis
  `revoke all on function … from public, anon, authenticated` et `grant execute` ciblé.
- Messages d'erreur **en français** (`raise exception '…' using errcode = …`) : ils s'affichent
  tels quels à l'écran. Le miroir de `src/donnees/demo.ts` doit lever le même message.
- Vue de lecture : `with (security_invoker = on)`, sans les clients de la corbeille ; une vue
  redéfinie ne peut qu'**ajouter des colonnes à la fin**.
- Liens publics : jeton aléatoire renvoyé une seule fois, `jeton_hash` =
  `encode(sha256(convert_to(jeton, 'UTF8')), 'hex')`, durée de vie limitée, client à la corbeille
  → `raison: 'inconnu'`.
- L'espace de groupe n'accepte volontairement aucune période : des fenêtres de dates au choix
  permettraient d'isoler un client par différence.

## Code partagé (`functions/_shared/`)

Importé par l'application (Vite), la fonction Edge (Deno) et les tests : **aucune dépendance**,
imports relatifs avec extension `.ts`.

- `questionnaire.ts` → `validerReponses`, miroir exact de `repondre_questionnaire` (test de
  parité cas par cas) ; `lectureLocale` (lecture sans IA).
- `analyse.ts` → séance : pseudonymisation, requête Gemini (schéma JSON imposé), validation
  stricte de la réponse, repli `analyseSimulee`.
- `fiche.ts` → zones et cases de la fiche papier (même liste que la contrainte SQL).
- `cors.ts` → origines autorisées de la fonction Edge.

## Fonction Edge `assistant-ia`

- `POST { type: 'seance' | 'questionnaire', id }` avec le jeton de l'utilisateur.
- Lit les données **sous l'identité de l'utilisateur** (RLS appliquée), réserve une unité de
  quota, appelle Gemini ; sans clé, quota épuisé ou erreur : répond avec l'analyse locale. Elle
  ne renvoie jamais d'erreur à cause de Gemini.
- Secrets : `GEMINI_API_KEY`, `GEMINI_MODEL` (facultatif), `ORIGINE_AUTORISEE` (adresses du
  site, séparées par des virgules ; sans lui, seul le développement local est accepté).

## Tests

`tests/supabaseLocal.ts` monte un PostgreSQL (PGlite) habillé comme Supabase : rôles `anon` /
`authenticated`, `auth.uid()`, niveau `aal`. `commeUtilisateur(db, uid, tx => …, 'aal1' | 'aal2')`
exécute comme PostgREST le ferait. Toute règle de sécurité mérite un test « un autre
thérapeute ne peut pas… » et « un anonyme ne peut pas… ». Voir `tests/AGENTS.md`.

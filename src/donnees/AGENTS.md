# src/donnees/ — accès aux données

Complète `../../AGENTS.md` et `../AGENTS.md`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `source.ts` | **le contrat** `SourceDonnees` (toutes les opérations, groupées par domaine) et `ErreurDonnees` |
| `index.ts` | `donnees` : Supabase si `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont définies, sinon démo (chargement à la demande) |
| `supabase.ts` | production : requêtes supabase-js sur les tables et **vues**, `rpc()` vers les fonctions SQL |
| `demo.ts` | mode démo : tout dans `localStorage`, **miroir** des règles SQL (mêmes contrôles, mêmes messages) |
| `jeuDemo.ts` | jeu de données fictif et déterministe (graine) + `VERSION_JEU_DEMO` |
| `cleDemo.ts` | ce que les écrans peuvent lire du mode démo (identifiants, clé Gemini de démo) |
| `memoireSession.ts` | où garder la session (onglet, ou 8 h si « rester connecté ») |

## Ajouter une opération

1. Signature et commentaire dans `source.ts` (dans la bonne section).
2. `supabase.ts` : lire une **vue** quand elle existe (elles écartent la corbeille :
   `clients_resume`, `agenda`, `journal`, `mes_taches`, `remises_actives`), écrire dans la table,
   ou appeler une fonction SQL par `rpc` pour toute règle (numérotation, liens, quotas…). Les
   colonnes lues sont des constantes `COLONNES_*` en **une seule chaîne littérale** (typage
   supabase-js). `verifier(...)` transforme une erreur en `ErreurDonnees` au message français.
3. `demo.ts` : même règle, mêmes messages d'erreur, mêmes filtres (thérapeute courant via
   `this.moi()`, corbeille via `this.supprimes()` / `this.clientActif()`), puis `this.sauver()`.
   Les objets renvoyés passent par `this.sans()` (retire `therapeute_id`) ; ne jamais renvoyer
   `jeton_hash`.
4. Si le jeu de démo change de forme (nouveau champ stocké) : le générer dans `jeuDemo.ts` et
   incrémenter `VERSION_JEU_DEMO`.
5. Tests : SQL dans `tests/sql*.test.ts` ; le mode démo est couvert par les tests e2e.

## Sections de `demo.ts` / `source.ts`

Compte et sécurité · paramètres et questionnaires · clients · problématiques · séances ·
journal · exercices et documents · reçus · tâches personnelles et « plus tard » · emploi du
temps · relances et questionnaires · IA · statistiques. Chercher `// ---` dans `demo.ts`.

## Particularités

- `emettreRecu` / `emettreRecuGroupe` (Supabase) relisent le reçu après l'appel SQL pour
  obtenir ses lignes (`recus_lignes`).
- `documentPublic`, `repondreDocument`, `recuPublic`, `questionnairePublic`,
  `repondreQuestionnaire` sont appelées **sans compte** (pages publiques) ; en démo, elles
  relisent `localStorage` (le lien peut être ouvert dans un autre onglet).
- Les statistiques de la démo (`calculerStatistiques`) doivent rester égales à `statistiques()`
  en SQL : un test charge le jeu de démo dans PostgreSQL et compare.

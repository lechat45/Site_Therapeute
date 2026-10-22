# tests/ — Vitest (logique pure et SQL réel)

Complète `../AGENTS.md`. Lancer : `npm test` (tout), `npm run test:sql` (fichiers `sql*`),
`npx vitest run tests/outils` (un fichier). Configuration : `vite.config.ts` (`test.include`
= `tests/**/*.test.ts`, délais longs pour PGlite). Aucun réseau nécessaire.

## Fichiers

| Fichier | Ce qu'il couvre |
|---|---|
| `logique.test.ts` | socle sans base : relances, rentabilité, messages, date du jour, validation des réponses, lecture locale, sécurité (TOTP, jetons), CORS, période des statistiques, session et inactivité, couleurs daltoniennes, calculs d'agenda |
| `rgpd.test.ts` | 0.13 : export d'une fiche (cloisonné, lisible), export complet, fiches à revoir (5 ans) |
| `sqlRgpd.test.ts` | 0.13 : consentement (écriture, vue, RLS), effacement en cascade, purge du journal des connexions |
| `presentation.test.ts` | 0.12 : présentation du site — diapositives complètes, chemins internes, parties masquées absentes |
| `comparaison.test.ts` | 0.11 : espace de groupe — repères (jamais une case masquée), « vous et le groupe » (± 10 %, arrondis) |
| `analyse.test.ts` | assistant IA des séances (`_shared/analyse.ts`) : pseudonymisation, requête et réponse Gemini, repli local |
| `outils.test.ts` | 0.7 : texte des documents, créneaux libres, statistiques de l'agenda, tâches personnelles, « plus tard », récapitulatif de la semaine |
| `prolongements.test.ts` | 0.8 : récapitulatif et CSV des reçus, exercices à compléter, tâches récurrentes, habitudes du client |
| `rappelsRecus.test.ts` | 0.9 : rappel d'exercice, exercices rendus sur la fiche de séance, livre des recettes, totaux trimestriels |
| `sql.test.ts` | socle SQL : référentiels, RLS, parcours, statistiques (égalité SQL = démo), paramètres par défaut (SQL = TS), questionnaires, liens, corbeille, quota IA, emploi du temps, tarifs, double authentification |
| `sqlOutils.test.ts` | 0.7 : journal, documents remis, reçus, tâches personnelles, reports |
| `sqlProlongements.test.ts` | 0.8 : **parités** `questions_document` = `questionsDocument` et `echeance_suivante` = `echeanceSuivante`, reçu par lien, réponses aux exercices, tâches récurrentes |
| `sqlRappelsRecus.test.ts` | 0.9 : rappel d'exercice, lignes de reçu, reçus groupés |
| `supabaseLocal.ts` | outil (pas un test) : PostgreSQL PGlite habillé comme Supabase |

## Tests SQL : comment faire

```ts
import { baseSupabase, commeUtilisateur, creerCompte } from './supabaseLocal';

const db = await baseSupabase();          // base migrée (copie d'un modèle construit une fois)
await creerCompte(db, A);                 // crée le thérapeute (+ paramètres, questionnaire)
const r = await commeUtilisateur(db, A, (tx) => tx.query(`select …`));          // session aal1
await commeUtilisateur(db, A, (tx) => tx.query(`select …`), 'aal2');           // code 2FA fourni
await commeUtilisateur(db, null, (tx) => tx.query(`select public.document_public($1)`, [jeton])); // anonyme
await db.query(`update …`);               // en super-utilisateur (préparer un cas : expiration…)
```

- Chaque fichier définit ses petites aides (`creerClient`, `une(db, uid, sql, params)` qui
  renvoie la première ligne, `corbeille(...)`).
- Pour toute règle : le cas permis, le cas refusé (message vérifié par une expression
  régulière en français), « un autre thérapeute ne peut pas », « un anonyme ne peut pas »
  (`/permission denied/`).
- Une règle présente en SQL ET en TypeScript ⇒ un test de **parité** qui boucle sur des cas et
  compare les deux résultats.

## Tests de logique pure

- Construire les objets avec de petites fabriques (`client(...)`, `envoi(...)`, `rdv(...)`,
  `recu(...)`) qui remplissent tous les champs du type, puis surcharger ce qui compte.
- Les dates « aujourd'hui » et « maintenant » sont passées en paramètre : jamais `new Date()`
  dans une assertion. Pour une heure locale, utiliser `horodatage(jour, 'HH:MM')`.
- Les tests tournent dans le fuseau de la machine ; ceux qui touchent l'heure locale passent
  par `horodatage` pour rester justes partout.

# e2e/ — tests de bout en bout (Playwright)

Complète `../AGENTS.md`. Lancer : `npm run test:e2e` ; un fichier :
`npx playwright test e2e/outils.spec.ts` ; un test : `npx playwright test -g "reçu groupé"`.

## Fonctionnement

- `playwright.config.ts` démarre Vite sur le port **5191**, toujours en **mode démo** (variables
  Supabase vidées). Fuseau `Europe/Paris`, langue `fr-FR`.
- Deux projets : `ordinateur` (tous les tests) et `telephone` (Pixel 7, seulement les tests
  dont le titre contient `@telephone`).
- Chaque test part d'un navigateur vierge : le jeu de démo est régénéré (données fictives
  identiques à chaque fois, dates relatives à aujourd'hui).
- En cas d'échec : `test-results/<test>/trace.zip` → `npx playwright show-trace <fichier>`.

## Fichiers

| Fichier | Parcours |
|---|---|
| `aides.ts` | `seConnecter(page)` (attend le titre « Bonjour … » de l'accueil), `creerClient(page, prénom, nom)`, `aujourdhui()` |
| `parcours.spec.ts` | connexion, séance enregistrée automatiquement, relance et réponse du client, corbeille, mode daltonien, emploi du temps, questionnaires, créneau libre en un clic, espace de groupe |
| `outils.spec.ts` | 0.7 : tâches (perso, « plus tard », filtres), journal, exercice remis par lien, reçu (émettre, annuler), activité |
| `prolongements.spec.ts` | 0.8 : exercice à compléter, reçu par lien + export CSV, tâche récurrente |
| `rappelsRecus.spec.ts` | 0.9 : rappel d'exercice, exercices rendus sur la séance, reçu groupé + livre des recettes |

## Conventions

- **Fiche client en onglets** : pour agir sur une partie de la fiche, ouvrir d'abord son onglet
  (`getByRole('tab', { name: 'Notes' })`, `'Relances et questionnaires'`, `'Séances'`).

- **Parties masquées** (`src/config/fonctions.ts`) : un test d'une partie masquée commence par
  `test.skip(!EXERCICES_VISIBLES, '…')` ou `test.skip(!ARGENT_VISIBLE, '…')`. Il redevient
  actif tout seul quand la partie est rallumée. Le test « parties masquées »
  (`outils.spec.ts`) vérifie qu'elles n'apparaissent nulle part.

- Sélecteurs **accessibles** et en français : `getByRole('button', { name: '…' })`,
  `getByLabel('…')`, `getByRole('heading', …)`. Pas de sélecteur CSS sauf pour une zone sans rôle
  (`.liste-miennes`, `.tableau-recu`). Changer un libellé de l'interface ⇒ chercher ce libellé
  ici.
- Viser une carte : `page.locator('article', { has: page.getByRole('heading', { name: '…' }) })`
  ou `page.locator('section', { has: … })`, puis chercher dedans (évite les doublons).
- Les filtres de l'onglet Tâches sont dans `getByRole('group', { name: 'Afficher' })`.
- Page ouverte par le client (lien `/q`, `/d`, `/r`) : en démo, le bouton « Tester » /
  « Voir comme le client » ouvre un nouvel onglet → `context.waitForEvent('page')`.
- Téléchargement : `page.waitForEvent('download')` puis `readFileSync(await d.path())`.

## Ce que les tests supposent du jeu de démo (`src/donnees/jeuDemo.ts`)

- au moins une tâche calculée qui n'est pas personnelle (rendez-vous passé à compléter, rappel…) ;
- un exercice « Journal des émotions » (avec questions `?`) parmi les documents ;
- un exercice remis par lien il y a 10 jours, sans réponse, à un client joignable (tâche
  « Rappeler l'exercice ») ;
- des reçus valides dont au moins un client actif (bouton « Envoyer ») ;
- plus de 8 séances tarifées sans reçu, dont au moins deux pour un même client (reçu groupé).

Modifier le jeu de démo peut casser ces tests sans bogue réel : adapter le test ou le jeu.

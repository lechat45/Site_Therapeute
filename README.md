# Suivi thérapeutique

SaaS de suivi pour thérapeutes comportementalistes émotionnels :

- fiches clients numérisées et privées, au format de la fiche papier ;
- parcours « 3 séances + bilan + séances à l'unité » ;
- statistiques personnelles et de groupe anonymisées ;
- catégorisation et synthèse évolutive par l'IA (Gemini), **facultative** ;
- relances avec questionnaires de suivi personnalisables (et créneaux libres proposés),
  onglet Tâches avec lecture automatique des réponses, tâches personnelles, « plus tard »,
  filtres et récapitulatif de la semaine ;
- **emploi du temps** (semaine ou jour) : rendez-vous colorés par type, lisibles par les
  personnes daltoniennes (pictogramme, nom et motif en plus de la couleur), rappels de
  rendez-vous préparés à la main, séance démarrée depuis le rendez-vous ;
- **journal** de notes privées, libres ou liées à un client ;
> **Version actuelle** : les exercices et documents sont **masqués** dans l'interface
> (`src/config/fonctions.ts`) ; ils restent décrits ci-dessous car ils se rallument d'une
> ligne. Rentabilité et reçus : par Paramètres › Tarifs.

- **exercices et documents** à remettre aux clients (lien personnel sans compte ou papier),
  dont des **exercices à compléter** dont les réponses reviennent dans les Tâches et en tête
  de la séance suivante, avec rappel proposé si le client n'a pas répondu ;
- **activité** : heures de consultation, absences, annulations, créneaux les plus demandés ;
- tarifs, rentabilité et **reçus** numérotés (seuls ou groupés pour plusieurs séances) à
  imprimer en PDF ou à envoyer par lien, récapitulatif annuel et trimestriel, livre des
  recettes pour le tableur (facultatifs, sans paiement en ligne) ;
- fiche de séance enregistrée automatiquement, corbeille des clients (30 jours), accord
  de relance du client (RGPD) ;
- double authentification, comptes gérés par l'administrateur (pas d'inscription
  libre, pas de « mot de passe oublié »), option « rester connecté 8 h » ;
- profil, couleurs, nom du site, taille du texte, **mode daltonien** ;
- utilisable sur ordinateur, tablette et téléphone.

Documentation :

- **[AGENTS.md](AGENTS.md)** — reprendre le code (Codex, Claude ou humain) : commandes,
  « terminé » veut dire…, index fonctionnalité → fichiers, règles, lexique, recettes, pièges.
  Chaque dossier important a aussi son `AGENTS.md` (`src/`, `src/domaine/`, `src/donnees/`,
  `supabase/`, `tests/`, `e2e/`) ;
- **[docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)** — demande d'origine, ce
  qu'elle est devenue, décisions prises et questions ouvertes ;
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — architecture, données, sécurité,
  conformité ;
- **[CHANGELOG.md](CHANGELOG.md)** — versions ; **[docs/IDEES.md](docs/IDEES.md)** — pistes.

## Essayer la maquette (aucun serveur requis)

```bash
npm install
```
```bash
npm run dev
```

Ouvrir <http://localhost:5190>. L'application démarre en **mode démonstration** :
identifiants pré-remplis `demo@exemple.fr` / `demo`, avec 8 thérapeutes et environ
150 clients **fictifs**, conservés dans le navigateur. On peut les réinitialiser depuis
*Paramètres > Confidentialité* (ou depuis l'écran du code de double authentification).

À essayer :

- *Tâches* : filtres, « Plus tard », « Mes tâches », récapitulatif « Votre semaine ».
- *Exercices et documents* : « Remettre à un client » (« Journal des émotions » est à
  compléter), puis « Voir comme le client » et répondre ; la réponse arrive dans *Tâches*.
- *Reçus* : « Émettre un reçu », cocher plusieurs séances d'un client pour un reçu groupé,
  « Envoyer », récapitulatif, livre des recettes ; *Activité* : un an d'historique fictif.
- *Tâches > Exercices* : « Rappeler l'exercice » (exercice sans réponse depuis 10 jours).
- *Tâches > Mes tâches* : « Répéter chaque mois » ; une fiche client : « Questionnaire par
  e-mail » puis « Proposer des créneaux libres » (habitudes du client d'abord).
- *Emploi du temps* : trois semaines de rendez-vous fictifs autour d'aujourd'hui. Cliquez sur
  un créneau libre pour planifier, sur un rendez-vous pour le modifier ou commencer la
  séance. *Paramètres > Emploi du temps* : couleurs vérifiées et aperçu « comme le voit une
  personne daltonienne ».
- *Fiche client* : « Questionnaire par e-mail ». Le bouton « Tester le questionnaire »
  ouvre la page que verrait le client. Ses réponses arrivent dans *Tâches*, lues
  automatiquement (tendance, priorité, suggestion), et sur la fiche (courbes).
- *Paramètres* : profil et signature, affichage (mode daltonien, taille du texte),
  questionnaires (7 types de questions, bibliothèque, aperçu), relances, tarifs,
  double authentification, assistant IA.

Sans clé, l'assistant IA fonctionne en **lecture locale** (repérage par mots-clés,
comparaison des réponses). Pour essayer Gemini sur les données fictives, collez une clé
dans *Paramètres > Assistant IA* ; elle n'est gardée que dans l'onglet.

## Vérifier

```bash
npm run verifier
```

Vérification du code (oxlint), mise en forme (Prettier : `npm run format` pour corriger),
contrôle des types, tests, puis version de production. Les parcours principaux se testent
aussi dans un vrai navigateur :

```bash
npm run test:e2e
```

(Chrome ou Edge déjà installé est utilisé ; sinon `npx playwright install chromium`.) À
chaque envoi de code sur GitHub, `.github/workflows/verifier.yml` lance le tout.

Les tests unitaires (`npm test`) exécutent
les migrations dans un vrai PostgreSQL (PGlite, sans installation) habillé comme
Supabase : rôles `anon` / `authenticated`, `auth.uid()`, niveau de double
authentification. Ils vérifient notamment :

- le cloisonnement entre thérapeutes (fiches, séances, questionnaires, envois) et
  l'absence de tout accès anonyme ;
- que la base accepte exactement les cases de la fiche papier ;
- la numérotation du parcours et la protection de la dernière séance ;
- l'égalité exacte entre les statistiques SQL et celles du mode démo, et les seuils
  d'anonymat de l'espace de groupe ;
- les liens de questionnaire (256 bits, empreinte seule, réponse unique, expiration) ;
- les documents remis (copie figée, lien sans compte, corbeille), les reçus (numérotation
  sans trou ni doublon, annulation avec motif, aucune modification possible), le journal
  et les tâches personnelles (tests/sqlOutils.test.ts) ; le reçu par lien, les réponses aux
  exercices et les tâches récurrentes, avec parité SQL ↔ TypeScript (tests/sqlProlongements.test.ts) ;
  le rappel d'exercice et les reçus groupés (tests/sqlRappelsRecus.test.ts) ;
- que le serveur et le navigateur valident les réponses **exactement** de la même façon ;
- le questionnaire par défaut, l'édition des questionnaires, le quota d'appels IA ;
- la double authentification : sans code, aucune fiche n'est lisible ;
- les relances, la lecture locale des questionnaires, la rentabilité, les codes TOTP
  (RFC 6238), la pseudonymisation et la validation des réponses de Gemini.

## Brancher Supabase (production)

1. Créer un projet Supabase en région UE (voir *Conformité* dans l'architecture, en
   particulier la question HDS).
2. Appliquer le schéma et déployer la fonction IA :
   ```bash
   npx supabase link --project-ref <réf-du-projet>
   ```
   ```bash
   npx supabase db push
   ```
   ```bash
   npx supabase functions deploy assistant-ia
   ```
   ```bash
   npx supabase secrets set GEMINI_API_KEY=<clé> ORIGINE_AUTORISEE=https://<votre-domaine>
   ```
   `ORIGINE_AUTORISEE` est **obligatoire** : sans lui, la fonction IA n'accepte que le
   développement local (plusieurs adresses possibles, séparées par des virgules). Sans
   `GEMINI_API_KEY`, tout fonctionne avec l'analyse locale. Plafond commun d'appels Gemini
   (300 par jour par défaut) : `npm run comptes -- quota-ia <nombre>`.
3. Copier `.env.example` vers `.env.local` et renseigner `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_PUBLISHABLE_KEY`. L'application passe alors en mode Supabase.
4. Dans *Authentication* :
   - **désactiver les inscriptions** (« Allow new users to sign up » : non) ;
   - n'ajouter **aucune** adresse de redirection : l'application n'accepte pas les
     liens de récupération reçus par courriel ;
   - imposer au moins 10 caractères de mot de passe ;
   - laisser activée la MFA « TOTP ».
5. Créer les comptes des thérapeutes (voir ci-dessous).
6. Facultatif mais conseillé : effacer chaque nuit les clients restés plus de 30 jours dans
   la corbeille, même si leur thérapeute ne se connecte plus (extension `pg_cron`, dans
   l'éditeur SQL de Supabase) :
   ```sql
   select cron.schedule('purge-corbeille', '0 3 * * *',
     $$delete from public.clients where supprime_le < now() - interval '30 days'$$);
   ```
   Sinon, la corbeille de chacun est purgée à l'ouverture de sa liste de clients.
7. Héberger le contenu de `dist/` : le fichier `_headers` fournit les en-têtes de
   sécurité (Netlify, Cloudflare Pages ; à reporter ailleurs). Toutes les adresses
   doivent renvoyer vers `index.html`, y compris `/q/…` (questionnaire), `/d/…` (document
   remis au client) et `/r/…` (reçu envoyé au client).

### GitHub Pages (démonstration)

Le workflow `.github/workflows/github-pages.yml` publie le site à chaque envoi sur `main`,
à l'adresse `https://<compte>.github.io/<dépôt>/`. À activer une fois dans le dépôt :
*Settings → Pages → Source : « GitHub Actions »*. Sans variables `VITE_SUPABASE_*`, le site
publié est en **mode démo** (données fictives). Pages n'envoie pas les en-têtes de `_headers`.
Pour construire soi-même dans un sous-dossier : `CHEMIN_BASE=/mon-dossier/ npm run build`.

La clé Gemini et la clé « service_role » ne doivent **jamais** figurer dans `.env` ou
`.env.local` : tout ce qui commence par `VITE_` est public.

## Comptes des thérapeutes

Ni inscription, ni « mot de passe oublié » dans l'application : l'administrateur gère
les comptes avec la clé « service_role » (fichier `.env.admin`, voir
`.env.admin.example`, jamais commité).

```bash
npm run comptes -- creer camille.laurent@exemple.fr Camille Laurent
```
```bash
npm run comptes -- mot-de-passe camille.laurent@exemple.fr
```
```bash
npm run comptes -- retirer-2fa camille.laurent@exemple.fr
```

Le mot de passe provisoire s'affiche une seule fois ; le thérapeute le change dans
*Paramètres > Sécurité*. `npm run comptes -- aide` liste toutes les commandes.

## Remplacer la liste des 14 émotions

1. Modifier `EMOTIONS` dans `src/config/referentiels.ts`, en gardant les identifiants
   1 à 14.
2. Ajouter une **nouvelle** migration `update public.emotions set libelle = … where id = …`.
   Ne pas modifier les migrations déjà appliquées : les nouvelles installations les
   rejouent toutes, dans l'ordre.
3. `npm test` : le test des référentiels échoue tant que le code et la base divergent.

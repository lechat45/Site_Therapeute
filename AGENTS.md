# AGENTS.md — reprendre le projet (Codex, Claude, humains)

Lisez ce fichier en entier avant de modifier le code. Chaque dossier important a aussi son
`AGENTS.md` (`src/`, `src/domaine/`, `src/donnees/`, `src/styles/`, `supabase/`, `tests/`,
`e2e/`) : le plus proche du fichier modifié s'applique **en plus** de celui-ci.

Tout ce qu'il faut savoir est **dans le dépôt** : les documents extérieurs (système de design
de l'utilisateur, réglages GitHub) y sont transcrits (`docs/DESIGN.md`, `docs/DEPLOIEMENT.md`).
Les choix faits avec l'utilisateur sont dans `docs/CAHIER_DES_CHARGES.md` : ne pas les défaire
sans lui.

## 1. Le projet en une minute

- **Quoi** : application web (SaaS) de suivi pour **thérapeutes comportementalistes
  émotionnels**. Chaque thérapeute a ses clients, leurs fiches de séance (copie numérique
  d'une fiche papier), un tableau de bord, des tâches, un emploi du temps, etc. Un espace de
  groupe partage des statistiques **anonymisées**.
- **Pour qui** : des thérapeutes non techniciens, sur ordinateur, tablette ou téléphone.
  Interface **100 % en français**.
- **Pile** : React 19 + Vite 8 + TypeScript 7 (strict), react-router 7, CSS maison (aucune
  bibliothèque d'interface), Supabase (PostgreSQL + RLS + fonctions SQL + une fonction Edge
  Deno pour l'IA Gemini). Tests : Vitest + PGlite (vrai PostgreSQL en mémoire) et Playwright.
- **Deux modes, choisis tout seuls** : sans variables `VITE_SUPABASE_*` → **mode démo**
  (données fictives dans le navigateur, aucun serveur, identifiants pré-remplis) ; avec →
  **Supabase** (production).
- **Données de santé, RGPD** : ce qui est fait et ce qu'il reste à faire : `docs/RGPD.md`.
- **Version** : `package.json` ; historique dans `CHANGELOG.md` ; demande d'origine de
  l'utilisateur et décisions : `docs/CAHIER_DES_CHARGES.md` ; pistes : `docs/IDEES.md` ;
  architecture détaillée : `docs/ARCHITECTURE.md` ; **style** (design Flow en violet) :
  `docs/DESIGN.md` ; **mise en ligne** (GitHub Pages) : `docs/DEPLOIEMENT.md`.
- **En ligne** : démonstration (mode démo) sur <https://lechat45.github.io/Site_Therapeute/>,
  publiée automatiquement à chaque envoi sur `main` du dépôt `lechat45/Site_Therapeute`.

### État actuel (version 0.13.1, 22 octobre 2026)

- **Affiché** : tableau de bord (bandeau d'accueil), clients (fiche en onglets), séances,
  emploi du temps (rendez-vous guidé), tâches (sans planning des rendez-vous), journal,
  activité, espace de groupe (repères, « vous et le groupe »), budget (tarifs ; rentabilité et
  reçus par Paramètres › Tarifs), assistant IA facultatif, présentation du site, RGPD.
- **Masqué** (code gardé) : exercices et documents (`src/config/fonctions.ts`).
- **Hors menu** : Rentabilité et Reçus (décision de l'utilisateur, 0.9.3).
- **À faire hors du code avant de vraies données** : `docs/RGPD.md` section 3 (hébergeur HDS,
  contrats, analyse d'impact, éditeur à renseigner dans `src/config/rgpd.ts`).
- Ce qui a changé et pourquoi : `CHANGELOG.md` ; choix de l'utilisateur à respecter :
  `docs/CAHIER_DES_CHARGES.md` (« Décisions »).

## 2. Démarrer et vérifier

| Action | Commande |
|---|---|
| Installer | `npm install` (Node ≥ 24, voir `.nvmrc`) |
| Lancer (mode démo) | `npm run dev` → <http://localhost:5190>, bouton « Se connecter » (`demo@exemple.fr` / `demo`) |
| Types | `npm run typecheck` |
| Lint / mise en forme | `npm run lint` (oxlint) · `npm run format` (Prettier, corrige) |
| Tests unitaires + SQL | `npm test` (~1 min ; le 1er lancement migre une base PGlite) |
| Seulement les tests SQL | `npm run test:sql` |
| Un seul fichier de test | `npx vitest run tests/outils` (filtre sur le nom de fichier) |
| Tests de bout en bout | `npm run test:e2e` (Playwright, port 5191, 1 à 4 min) |
| **Avant de livrer** | `npm run verifier` (lint + format + types + tests + build) |
| **Tout, d'un coup** | `npm run verifier:complet` (`verifier` puis `test:e2e`) |
| Comptes (admin) | `npm run comptes -- aide` |

- Aucun réseau n'est nécessaire pour `npm test` (PostgreSQL tourne en WebAssembly).
- `test:e2e` utilise Chrome ou Edge s'il est installé ; sinon `npx playwright install chromium`
  (l'intégration continue fait `npx playwright install --with-deps chromium`). Si aucun
  navigateur n'est disponible, lancez au moins `npm run verifier` et dites-le.
- L'intégration continue (`.github/workflows/verifier.yml`) lance `verifier` puis `test:e2e`.
- `.github/workflows/github-pages.yml` publie le site sur GitHub Pages (`CHEMIN_BASE`, voir
  `docs/DEPLOIEMENT.md`). Construction locale identique :
  `MSYS_NO_PATHCONV=1 CHEMIN_BASE=/Site_Therapeute/ npm run build` (Git Bash).

## 3. « Terminé » veut dire

- [ ] `npm run verifier` passe (zéro erreur oxlint ; les avertissements sont des choix assumés).
- [ ] `npm run test:e2e` passe (ou vous expliquez pourquoi il n'a pas pu tourner).
- [ ] Une règle de données existe à l'identique en SQL (nouvelle migration), dans
      `src/donnees/supabase.ts` **et** dans `src/donnees/demo.ts` (miroir du mode démo).
- [ ] Des tests couvrent le changement : logique pure (`tests/*.test.ts`), SQL
      (`tests/sql*.test.ts`), parcours utilisateur (`e2e/*.spec.ts`) selon le cas.
- [ ] `version` de `package.json` (et les deux premières de `package-lock.json`) + entrée en
      tête de `CHANGELOG.md`.
- [ ] Documentation à jour : ce fichier ou l'`AGENTS.md` du dossier, `docs/ARCHITECTURE.md`,
      `README.md` si l'usage change ; idée réalisée retirée de `docs/IDEES.md`.
- [ ] Forme du jeu de démo changée → `VERSION_JEU_DEMO` incrémentée (`src/donnees/jeuDemo.ts`).
- [ ] Textes en français ; aucun état signalé par la seule couleur.
- [ ] Nouvelle donnée sur un client : présente dans `exportClient` (`domaine/rgpd.ts`) et effacée
      avec la fiche ; durée annoncée dans la politique = durée appliquée (`docs/RGPD.md`).
- [ ] Une partie du site change : sa diapositive est à jour (`config/presentation.ts`).
- [ ] Changement visuel : conforme à `docs/DESIGN.md` (variables, un seul accent violet par
      zone, pas de dégradés) et regardé sur ordinateur **et** téléphone.

## 4. Carte du code

```
src/
  App.tsx, main.tsx     routes (publiques par jeton : /q /d /r) et point d'entrée
  domaine/              logique PURE et testée (types, tâches, agenda, reçus, statistiques…)
  config/               référentiels et valeurs par défaut (miroirs des migrations) ;
                        fonctions.ts = parties de l'interface masquées ou non (exercices : masqués) ;
                        presentation.ts = contenu de la présentation du site
  donnees/              accès aux données : source.ts (contrat) → demo.ts | supabase.ts
  etat/                 contextes React : session, réglages, tâches ; hooks
  composants/           composants réutilisables (cartes, boîtes de dialogue, graphiques…)
  pages/                un fichier par écran ; pages/parametres/ = un onglet par fichier
  styles/               CSS par zone ; index.css fixe l'ordre de la cascade — voir styles/AGENTS.md
supabase/
  migrations/           schéma, RLS, fonctions SQL — AJOUT SEULEMENT, dans l'ordre des noms
  functions/_shared/    code partagé app + fonction Edge + tests (sans dépendance)
  functions/assistant-ia/  fonction Edge (Deno) : seule détentrice de la clé Gemini
tests/                  Vitest : logique pure et SQL réel (PGlite) — voir tests/AGENTS.md
e2e/                    Playwright sur le mode démo — voir e2e/AGENTS.md
scripts/comptes.mjs     administration des comptes (clé service_role, hors application)
.github/workflows/      verifier.yml (tests) et github-pages.yml (publication de la démo)
vite.config.ts          Vite + Vitest ; `base` = CHEMIN_BASE (sous-dossier de GitHub Pages)
docs/                   ARCHITECTURE, CAHIER_DES_CHARGES (demande + décisions), IDEES,
                        DESIGN (design Flow en violet), DEPLOIEMENT (GitHub Pages), RGPD
```

Dépendances autorisées : `pages → composants → etat → donnees → domaine/config → _shared`.
Jamais l'inverse : `domaine/` n'importe ni React, ni `donnees/`, ni le navigateur.

## 5. Où est quoi : fonctionnalité → fichiers

| Fonctionnalité | Base de données (migration) | Logique (`src/domaine`, `config`) | Écrans et composants | Tests |
|---|---|---|---|---|
| Comptes, connexion, double authentification, inactivité | `schema_initial` (`mfa_satisfaite`), `relances_questionnaires` (journal des connexions) | `securite.ts` (TOTP, mots de passe) | `Connexion`, `parametres/OngletSecurite`, `etat/session`, `etat/inactivite`, `scripts/comptes.mjs` | `logique` (sécurité, session), `sql` (2FA) |
| Clients, corbeille (30 j) | `schema_initial`, `ameliorations` (`supprime_le`, `purger_corbeille`, vue `clients_resume`) | — | `Clients`, `FicheClient` | `sql` (RLS, corbeille), e2e `parcours` |
| Séances (fiche papier), parcours 3 + bilan + unité | `schema_initial` (`numeroter_seance`, `enregistrer_seance`, `seance_cases`) | `_shared/fiche.ts`, `config/referentiels.ts` | `FicheSeance`, `FeuilleSeance`, `ExercicesRendus` | `sql` (parcours, cases), e2e `parcours` |
| Statistiques perso et groupe anonyme | `statistiques()` (`ameliorations`) | `statistiques.ts` (miroir démo), `comparaison.ts` (repères du groupe, « vous et le groupe ») | `Statistiques` (accueil + groupe), `Graphiques` | `sql` (égalité SQL = démo, seuils), `comparaison` |
| Assistant IA (facultatif) | `usage_ia`, `plateforme`, `consommer_quota_ia` | `contexteAnalyse.ts`, `_shared/analyse.ts`, `_shared/questionnaire.ts` | `FicheSeance` (Analyser), `parametres/OngletIA`, `functions/assistant-ia` | `analyse`, `sql` (quota) |
| Questionnaires et relances | `relances_questionnaires` (`preparer_envoi`, `questionnaire_public`, `repondre_questionnaire`…) | `taches.ts` (`prochaineRelance`), `messages.ts`, `_shared/questionnaire.ts` | `DialogueEnvoi`, `CarteSuiviClient`, `QuestionnairePublic`, `parametres/OngletQuestionnaires`, `OngletRelances` | `logique`, `sql` (liens, réponses), e2e `parcours` |
| Tâches (calculées, perso, « plus tard », récurrence, semaine) | `journal_exercices_recus` (`taches_perso`, `reports_taches`), `prolongements` (`tache_recurrente`) | `taches.ts`, `config/taches.ts` | `pages/Taches` (sans planning des rendez-vous : décision de l'utilisateur), `CartesTaches`, `MesTaches`, `RecapSemaine`, `etat/tachesContexte`, `styles/taches.css` (`.liste-taches`) | `outils`, `prolongements`, `rappelsRecus`, `sqlOutils`, `sqlProlongements`, e2e |
| Emploi du temps (couleurs daltoniennes) | `emploi_du_temps` (`rendez_vous`, vue `agenda`) | `agenda.ts`, `couleurs.ts`, `config/agenda.ts` | `EmploiDuTemps`, `Agenda`, `DialogueRendezVous`, `DialogueRappel`, `RendezVousClient`, `parametres/OngletEmploiDuTemps` | `logique` (agenda, couleurs), `sql`, e2e |
| Activité (statistiques de l'agenda) | — | `activite.ts` | `Activite` | `outils`, e2e `outils` |
| Journal (notes) | `journal_exercices_recus` (`notes`, vue `journal`) | — | `Journal`, `DialogueNote`, `OutilsClient` (fiche client) | `sqlOutils`, e2e `outils` |
| Exercices et documents remis, à compléter, rappel (**masqué**) | `journal_exercices_recus` (`documents`, `remises`, `preparer_remise`, `document_public`), `prolongements` (`repondre_document`, `questions_document`), `rappels_recus_groupes` (`relancer_remise`) | `texte.ts`, `exercices.ts`, `config/ressources.ts` | `Exercices`, `DocumentPublic`, `DialogueRemise`, `DialogueRappelExercice`, `ReponsesExercice`, `DocumentTexte` | `outils`, `prolongements`, `rappelsRecus`, `sqlOutils`, `sqlProlongements`, `sqlRappelsRecus`, e2e |
| Parties masquées (interrupteurs) | — | `config/fonctions.ts` (`EXERCICES_VISIBLES = false`, `ARGENT_VISIBLE = true`) | menu, routes (`App.tsx`), fiche client, fiche de séance, Paramètres, `etat/tachesContexte` | e2e `outils` (« parties masquées ») ; tests des parties masquées en `test.skip` |
| Tarifs et rentabilité (accès : Paramètres › Tarifs) | `relances_questionnaires` (`tarifer_seance`) | `rentabilite.ts` | `Rentabilite`, `parametres/OngletTarifs` | `logique`, `sql` (tarifs) |
| Reçus : émission, annulation, lien, groupés, export, livre des recettes (accès : Paramètres › Tarifs) | `journal_exercices_recus` (`recus`, `emettre_recu`, `annuler_recu`), `prolongements` (`preparer_lien_recu`, `recu_public`), `rappels_recus_groupes` (`recus_lignes`, `emettre_recu_groupe`) | `recus.ts`, `texte.ts` (`numeroRecu`), `config/ressources.ts` | `Recus` (+ impression), `RecuPublic`, `FeuilleRecu`, `DialogueLienRecu` | `prolongements`, `rappelsRecus`, `sqlOutils`, `sqlProlongements`, `sqlRappelsRecus`, e2e |
| Réglages, affichage, daltonisme | `parametres` (toutes migrations) | `config/parametresDefaut.ts` | `Parametres`, `pages/parametres/*`, `etat/reglages`, `styles/accessibilite.css` | `sql` (défauts SQL = TS), e2e `parcours` |
| Style (design Flow en violet) | — | — | `styles/base.css` (variables), `structure.css` (menu), `composants.css`, `Icone` ; règles : `docs/DESIGN.md` | e2e (ordinateur + téléphone) |
| RGPD (consentement, export, conservation, politique) | `rgpd` (`consentement_le`, `purger_journal_connexions`) | `domaine/rgpd.ts` (`exportClient`, `exportComplet`, `fichesARevoir`), `config/rgpd.ts` (durées, éditeur) | `DonneesPersonnelles` (fiche), `parametres/SectionRgpd`, `pages/Confidentialite` (`/confidentialite`), `PiedPublic` ; guide : `docs/RGPD.md` | `rgpd`, `sqlRgpd`, e2e `outils` |
| Présentation du site (diapositives) | — | `config/presentation.ts` (contenu, une diapositive par partie) | `composants/Presentation.tsx` ; boutons dans `Connexion` et `Structure` (menu) | `presentation`, e2e `parcours` |
| Menu de navigation | — | — | `composants/Structure.tsx` (sans Rentabilité ni Reçus : décision de l'utilisateur) | e2e `parcours` |
| Publication (GitHub Pages, sous-dossier) | — | `domaine/messages.ts` (`racineSite`, liens clients) | `vite.config.ts` (`base`), `App.tsx` (`basename`), `.github/workflows/github-pages.yml` ; `docs/DEPLOIEMENT.md` | `outils`, `prolongements` (liens) |

Les migrations sont désignées par la fin de leur nom (`supabase/migrations/AAAAMMJJHHMMSS_nom.sql`).

## 6. Règles du projet (et pourquoi)

1. **Pas d'inscription, pas de « mot de passe oublié ».** Comptes créés et réinitialisés par
   l'administrateur (`scripts/comptes.mjs`). Ne pas réintroduire `signUp`,
   `resetPasswordForEmail` ni page publique de création de compte. *Pourquoi : données de
   santé, plateforme fermée.*
2. **Un contrat, deux sources.** Toute méthode de `src/donnees/source.ts` existe dans
   `demo.ts` ET `supabase.ts`, avec les mêmes règles et les mêmes messages d'erreur.
3. **Le SQL fait foi.** Les règles critiques vivent dans la base (RLS, fonctions
   `security definer`). Quand une règle existe aussi en TypeScript, un **test de parité**
   compare les deux (statistiques, validation des réponses, valeurs par défaut, questions
   d'un document, prochaine échéance) : le garder vert.
4. **Confidentialité.** Une fiche n'est lisible que par son thérapeute (RLS « propriétaire
   uniquement » + RLS restrictive « double authentification »). L'espace de groupe ne reçoit
   que des agrégats soumis aux seuils d'anonymat. Rien de personnel dans `localStorage`
   (sauf le mode démo, fictif).
5. **IA sobre et facultative.** Une seule clé Gemini, dans la fonction Edge (jamais dans une
   variable `VITE_*`, publique). Appels uniquement sur clic, quota par thérapeute et plafond
   commun, noms retirés avant envoi (`pseudonymiser`), et **tout marche sans Gemini** (repli
   `analyseSimulee` / `lectureLocale`).
6. **Rien ne part tout seul.** L'application prépare les messages ; le thérapeute les envoie
   depuis SA messagerie (`mailto:` / `sms:` / copier). *Choix de l'utilisateur : pas de
   service d'envoi tiers qui verrait les clients.*
7. **Liens publics par jeton.** Seules fonctions ouvertes sans compte : `questionnaire_public`,
   `repondre_questionnaire`, `document_public`, `repondre_document`, `recu_public`. Jeton
   aléatoire renvoyé une seule fois, **seule son empreinte SHA-256 est stockée**, durée de vie
   limitée, contenu copié au moment de l'envoi (modifier l'original ne change pas ce que le
   client a reçu). Un lien de questionnaire n'est actif qu'une fois sorti de l'application.
8. **Corbeille.** Un client supprimé garde `supprime_le` 30 jours : toute requête nouvelle
   doit l'exclure (listes, tâches, statistiques, liens publics, vues `agenda`, `journal`,
   `mes_taches`, `remises_actives`).
9. **Reçus = pièces comptables.** Numéro attribué seulement par `emettre_recu` /
   `emettre_recu_groupe` (année + numéro continu, sous verrou), coordonnées recopiées à
   l'émission, **jamais modifiés ni effacés** (aucun `grant update/delete`) : on les annule
   avec un motif. Une séance ne figure que sur un seul reçu valide (`recus_lignes`). Ils
   survivent à l'effacement du client. Aucun paiement en ligne.
10. **Accessibilité.** Jamais la couleur seule (pictogramme + libellé, motifs dans l'agenda) ;
    mode daltonien (`styles/accessibilite.css`) ; cibles tactiles ≥ 40 px ; clavier partout ;
    toute nouvelle couleur vérifiée par `domaine/couleurs.ts` et un test.
11. **Dates.** « Aujourd'hui » = `dateDuJour()` (date locale). Jamais
    `new Date().toISOString().slice(0, 10)` (date UTC : fausse la nuit en France). Jours
    locaux `AAAA-MM-JJ` + `horodatage(jour, 'HH:MM')` pour l'agenda (heure d'été comprise).
12. **Migrations : ajout seulement.** Ne jamais modifier une migration livrée : nouveau fichier
    (voir `supabase/AGENTS.md`). Une fonction redéfinie (`create or replace`) l'est en entier.
13. **Français.** Interface, messages d'erreur (ils remontent tels quels du SQL à l'écran),
    commentaires ; noms de code métier en français **sans accents** (`seance`, `therapeute`).
14. **Design Flow, en violet.** Tout changement visuel suit `docs/DESIGN.md` : variables de
    `styles/base.css` uniquement, un seul accent (le violet, jamais le corail ni l'orange de
    Flow), un seul bouton principal par zone, un seul bandeau fort par écran, pas de
    dégradés, icônes `Icone` au trait (jamais d'emojis). *Pourquoi : design commun à tous les
    sites de l'utilisateur, qui a choisi d'y garder son violet.*
15. **Le site peut vivre dans un sous-dossier** (`/Site_Therapeute/` sur GitHub Pages).
    Naviguer avec le routeur (`Link`, `useNavigate`, `Navigate`), jamais `<a href="/…">` ni
    `location.href = '/…'` ; liens envoyés aux clients avec `lienQuestionnaire`,
    `lienDocument`, `lienRecu`. *Pourquoi : sinon page blanche ou liens morts en ligne.*
16. **Parties masquables : n'y toucher que sur demande de l'utilisateur.**
    `src/config/fonctions.ts` affiche ou masque des parties entières. Aujourd'hui : les
    **exercices et documents sont masqués** (`EXERCICES_VISIBLES = false`, depuis 0.10.3) ;
    **l'argent est affiché** (`ARGENT_VISIBLE = true` : masqué en 0.10.3, remis en 0.11.0). Tout
    nouvel affichage qui relève d'une de ces parties est conditionné par sa constante ; leur
    code, leurs tables et leurs tests restent en état de marche. *Pourquoi : choix de
    l'utilisateur, réversible.*
17. **Espace de groupe : rien de personnel.** Il n'affiche que les agrégats de
    `statistiques('groupe')` (seuils d'anonymat appliqués en SQL ; une case `masque` n'est
    jamais exploitée, même pour un « repère »). Les comparaisons avec vos propres chiffres se
    font sur votre écran (`domaine/comparaison.ts`) : aucune donnée personnelle n'est envoyée
    au groupe. Une nouvelle information de groupe = un nouvel agrégat en SQL, avec seuil et test.
18. **RGPD (données de santé).** Toute nouvelle donnée sur un client entre dans `exportClient`
    (et son test) et s'efface avec la fiche ; toute durée de conservation annoncée dans la
    politique est réellement appliquée (purge SQL + miroir démo + test) ; tout nouveau service
    tiers est déclaré dans `pages/Confidentialite.tsx` et `docs/RGPD.md` avant d'être branché.
    *Pourquoi : la politique affichée aux clients doit dire vrai.*

## 7. Lexique (français → anglais)

| Terme (code) | Sens | Où |
|---|---|---|
| `therapeute` | therapist (utilisateur connecté) | `therapeutes`, `useTherapeute()` |
| `client` | client / patient du thérapeute | `clients`, `ClientResume` |
| `seance` | session (une rencontre) ; `numero`, `type` : `initiale`, `bilan`, `supplementaire` | `seances` |
| `parcours` | course : 3 séances initiales, un bilan (4e), puis séances à l'unité | `numeroter_seance` |
| `fiche` de séance | session sheet (copie de la fiche papier) ; `cases` = émotions placées | `FeuilleSeance`, `_shared/fiche.ts` |
| `emotion`, `problematique` | emotion (14 fixes), presenting problem | `config/referentiels.ts` |
| `synthese` | evolving AI summary of a client | `clients.synthese_ia` |
| `relance` | follow-up message after the last session | `prochaineRelance` |
| `envoi` | a sent questionnaire link (and its answers) | `envois` |
| `questionnaire`, `question` | follow-up questionnaire, editable | `questionnaires`, `questions` |
| `jeton` / `empreinte` | token / its SHA-256 hash | liens publics |
| `tache` | task (computed from data), `tache perso` = personal to-do | `domaine/taches.ts` |
| `plus tard`, `report` | snooze a task until a date | `reports_taches` |
| `recurrence` | repeating personal task (`semaine`, `mois`) | `tache_recurrente` |
| `rendez-vous` (`rdv`) | appointment ; `categorie`, `statut`, `modalite` | `rendez_vous`, `agenda` |
| `rappel` | appointment reminder message ; `rappel_le` = reminder sent | `DialogueRappel` |
| `cloture` | marking a past appointment (done, absent, cancelled) | `taches.ts` |
| `note` / `journal` | therapist's private notes | `notes` |
| `document` / `ressource` | handout in the therapist's library (UI: « Exercices et documents ») | `documents`, `Ressource` |
| `remise` | a handout given to a client (frozen copy, link or paper) | `remises` |
| `exercice à compléter` | handout with `? questions` the client answers via the link | `repondre_document` |
| `recu` | receipt (« note d'honoraires »), `ligne` = one session on it | `recus`, `recus_lignes` |
| `livre des recettes` | income ledger (French bookkeeping) | `csvLivreRecettes` |
| `tarif`, `prix` | price of a session | `tarifer_seance` |
| `rentabilite` | revenue dashboard | `rentabilite.ts` |
| `corbeille` | trash (30-day soft delete) | `supprime_le` |
| `espace de groupe` | shared anonymised statistics | `statistiques('groupe')` |
| `parametres`, `reglages` | settings (per therapist) | `parametres`, `useReglages()` |
| `donnees` | data layer singleton | `src/donnees/index.ts` |
| `demo` / `jeu de démo` | demo mode / fictional dataset | `demo.ts`, `jeuDemo.ts` |
| `verifier` | check / verify (npm script) | `package.json` |

## 8. Recettes

- **Nouvelle méthode de données** : signature dans `source.ts` → requête ou `rpc` dans
  `supabase.ts` → miroir dans `demo.ts` (mêmes contrôles, mêmes messages) → fonction SQL
  dans une nouvelle migration si une règle est en jeu → tests SQL (`tests/sql*.test.ts`) et,
  si la règle existe aussi en TS, test de parité.
- **Nouveau réglage** : colonne + `grant update (colonne)` (migration), champ de `Parametres`
  (`domaine/types.ts`), valeur dans `PARAMETRES_PAR_DEFAUT`, contrôle dans
  `verifierParametres` (`demo.ts`), colonne dans `COLONNES_PARAMETRES` (`supabase.ts`),
  écran dans `pages/parametres/`. Le test « sont créés avec le compte » compare SQL et TS.
- **Nouvel écran** : `src/pages/`, route dans `src/App.tsx` (`lazy` s'il est lourd ou rare),
  lien dans `src/composants/Structure.tsx`, styles dans `src/styles/` (fichier importé par
  `index.css`).
- **Nouvelle tâche** : cas dans `calculerTaches` avec une `cle` stable (préfixe unique : elle
  sert au « plus tard »), famille dans `familleTache`, intitulé dans `titreTache`, phrase dans
  `resumeDuJour`, carte dans `composants/CartesTaches.tsx` (avec `plusTard`), branchement dans
  `pages/Taches.tsx`, tests dans `tests/`.
- **Nouveau type de question** : `type_question` (SQL) + `TypeQuestion` et `validerReponses`
  (`_shared/questionnaire.ts`) + `repondre_questionnaire` (SQL) + `QuestionPublique` +
  `TYPES_QUESTION` (éditeur) + un cas dans le test de parité des réponses.
- **Nouveau type de rendez-vous** : valeur SQL (migration), `CategorieRdv`, entrée de
  `CATEGORIES` (couleur, pictogramme, nom) et motif dans `styles/agenda.css` ; le test des
  couleurs sous les trois daltonismes doit rester vert.
- **Nouveau modèle d'exercice** : `MODELES_RESSOURCES` (`config/ressources.ts`). Texte simple :
  `# intertitre`, `- liste`, `? question`, ligne vide = paragraphe. Jamais de HTML.
- **Remplacer les 14 émotions** : README, section dédiée.
- **Une partie du site change** (nouvel écran, fonction ajoutée ou retirée) : mettre à jour sa
  diapositive dans `config/presentation.ts` (titre, résumé, points, `ecran`) ; une partie
  masquable porte `partie: 'exercices' | 'argent'`. La présentation est lue par des
  thérapeutes : phrases courtes, concrètes, au vouvoiement.
- **Ajouter ou retirer un lien du menu** : `composants/Structure.tsx` (composant `Lien`,
  groupé sous un `nav-titre`). Retirer un lien ne supprime pas l'écran : la route reste dans
  `App.tsx`. Vérifier les tests e2e qui cliquent sur ce lien (`getByRole('link', …)`).
- **Nouveau composant visuel** : réutiliser les classes de `styles/composants.css` ; sinon,
  nouvelles règles dans le fichier CSS de la zone, avec les variables (`src/styles/AGENTS.md`).

## 9. Pièges connus

- **Fins de ligne** : sous Windows, un script qui réécrit un fichier peut le passer en CRLF ;
  Prettier refuse alors `package.json`. Écrire en `\n` (Python : `newline='\n'`).
- **Mode démo** : les données sont dans `localStorage` sous la clé
  `suivi-therapeutique:demo:v<VERSION_JEU_DEMO>` ; changer la forme du jeu sans incrémenter
  la version fait planter les écrans chez qui a déjà un jeu.
- **Serveur de développement** : après une réécriture massive (Prettier), Vite peut servir un
  module périmé (« does not provide an export named … ») : le relancer.
- **supabase-js** : les colonnes d'un `select` doivent être UNE chaîne littérale (une
  concaténation casse le typage). `jeton_hash` n'est jamais sélectionné.
- **Vues SQL** : `create or replace view` ne peut qu'ajouter des colonnes **à la fin**.
- **Colonne calculée** `remises.nb_questions` : elle appelle `questions_document`, d'où le
  `grant execute` à `authenticated` (sinon toute mise à jour d'une remise échoue).
- **Tests e2e** : ils s'appuient sur le jeu de démo (noms, nombre de séances…) ; le modifier
  peut casser un test sans bogue réel (voir `e2e/AGENTS.md`).
- **Git Bash (Windows)** : il convertit tout argument ou variable commençant par `/` en chemin
  Windows (`/Site_Therapeute/` devient `C:/Program Files/Git/Site_Therapeute/`). Préfixer de
  `MSYS_NO_PATHCONV=1`, ou utiliser PowerShell.
- **Node.js introuvable** : Node 24 est dans `C:\Program Files\nodejs` ; une application ouverte
  avant son installation ne le voit pas tant qu'elle n'est pas relancée.
- **Taille du texte** : la base des `rem` est 15 px (`html`) et le texte courant 14 px
  (`0.9333rem`). Ne pas passer la base à 14 px : les petits textes deviendraient illisibles.
- **Variables CSS composées** : `--courbes` utilise `--courbe` ; elle est calculée là où elle est
  déclarée, d'où sa déclaration sur les bandeaux et non sur `:root` (`styles/AGENTS.md`).
- **Tâches** : la clé d'une relance contient son rang (`r-<client>-<rang>`) ; reporter une
  relance ne masque pas la suivante.

## 10. Comptes (administrateur)

```bash
cp .env.admin.example .env.admin   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (secrets)
npm run comptes -- creer prenom.nom@exemple.fr Prénom Nom
npm run comptes -- mot-de-passe prenom.nom@exemple.fr
npm run comptes -- retirer-2fa prenom.nom@exemple.fr
npm run comptes -- lister
npm run comptes -- quota-ia 300      # plafond Gemini commun, par jour
```

`.env.admin` contient la clé « service_role » : jamais dans le dépôt, jamais dans l'application.

## 11. Style

- TypeScript strict, composants fonctionnels, pas de bibliothèque d'interface.
- Prettier (`.prettierrc.json` : guillemets simples, 120 colonnes, virgules finales).
- Chaque fichier commence par un commentaire qui dit son rôle ; commentaires brefs, en
  français, qui disent *pourquoi*.
- Composants maison réutilisés plutôt que réinventés : `Dialogue`, `Confirmation`, `Erreur`,
  `Chargement`, `useNotifier` (`composants/Commun.tsx`), `Icone` (pictogrammes SVG).

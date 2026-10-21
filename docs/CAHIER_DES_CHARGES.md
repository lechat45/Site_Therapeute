# Cahier des charges : la demande d'origine et ce qu'elle est devenue

La demande initiale de l'utilisateur est dans `Idéé_du_site.txt` (racine du projet, texte
brut, gardé tel quel). Ce document la relie au code, liste les **décisions** prises depuis avec
l'utilisateur, et ce qui reste **à confirmer**. À lire avant de changer un comportement
« étrange » : il est souvent voulu.

## Demande d'origine → réalisation

| Demande | Où c'est | État |
|---|---|---|
| Ébauche de site pour thérapeutes, partagé entre plusieurs personnes | comptes par thérapeute, espace de groupe | fait |
| Page d'accueil personnelle, puis page de groupe différente | `/` (tableau de bord personnel), `/groupe` (statistiques anonymisées) | fait |
| Une fiche par client, uniquement pour son propriétaire | `FicheClient`, RLS « propriétaire uniquement » | fait |
| Leur émotion problématique | 14 émotions (`config/referentiels.ts`), problématiques, cases de la fiche de séance | fait (liste provisoire) |
| Nombre de séances : parcours de 3 séances, puis bilan, puis séances en plus | `numeroter_seance` (SQL), `FicheClient` (parcours) | fait |
| Âge, prénom, nom, date de naissance, genre | prénom, nom, année de naissance (âge calculé) | partiel : date complète et genre non faits (`docs/IDEES.md`) |
| Design violet, logo ou titre | système de design Flow (`styles/base.css`) avec `--marque` violette comme accent, nom du site réglable | fait |
| Système de comptes | comptes créés par l'administrateur (`scripts/comptes.mjs`), double authentification | fait |
| Uniquement français | toute l'interface | fait |
| Pas de vente, pas de limite d'utilisation | aucun paiement en ligne ; tarifs seulement indicatifs | fait |
| Emploi du temps (« optionnel, pas pour l'instant ») | `EmploiDuTemps` (ajouté plus tard à la demande) | fait |
| Tablette et tactile | mise en page adaptée, cibles ≥ 40 px (`styles/tactile.css`) | fait |
| Graphiques | tableau de bord, évolution du client, rentabilité, activité | fait |
| Mail de relance 15 jours après, avec lien vers un questionnaire simple (notes, curseurs) qui met à jour la fiche et avertit le thérapeute | relances (`taches.ts`), questionnaires (`/q/:jeton`), réponses dans Tâches et sur la fiche | fait |
| « Voir des mails envoyés automatiquement, pas seulement des modèles » | messages préparés, **envoyés à la main** (voir décisions) ; historique des envois | adapté |
| Le thérapeute change les questions du questionnaire | Paramètres > Questionnaires (plusieurs questionnaires, 7 types) | fait |
| Onglet Tâches qui dit quand envoyer le mail ou le SMS ; fréquence réglable | `pages/Taches.tsx`, Paramètres > Relances | fait |
| Onglet Paramètres pour régler tout le système | `pages/parametres/` | fait |
| Sécurité, meilleurs comptes | RLS, 2FA, inactivité, journal des connexions | fait |
| Statistique de rentabilité, prix par fiche client et prix par défaut | Rentabilité, tarifs (défaut → client → séance) | fait |
| Modifier les couleurs et le site | Paramètres > Affichage | fait |

Tout ce qui a été ajouté ensuite (journal, exercices, reçus, activité, tâches…) est dans
`CHANGELOG.md`, version par version.

## Décisions prises avec l'utilisateur (à ne pas défaire sans lui)

- **Pas d'inscription libre ni de « mot de passe oublié »** : l'administrateur crée et
  réinitialise les comptes.
- **Envois à la main** : l'application rédige l'e-mail ou le SMS, le thérapeute l'envoie depuis
  sa messagerie (aucun service tiers ne voit les clients). Un envoi par serveur SMTP du cabinet
  est une piste facultative (`docs/IDEES.md`).
- **Relance après la DERNIÈRE séance** (15 jours, puis tous les 30 jours, 3 fois au plus,
  réglable).
- **Une seule clé Gemini pour toute la plateforme** : IA uniquement sur clic, quotas, et tout
  fonctionne sans elle.
- **Chacun règle tout pour lui seul** (paramètres par thérapeute).
- **Accessible aux personnes daltoniennes partout** : jamais la couleur seule.
- **Tarifs facultatifs**, reçus sans paiement en ligne.
- **Style : système de design Flow, en violet** (octobre 2026). Flow est le design commun à
  tous les sites de l'utilisateur ; il a demandé de tout en reprendre **sauf le corail/orange**
  : l'accent reste le violet. Règles complètes : `docs/DESIGN.md`.
- **Menu sans « Rentabilité » ni « Reçus »** (version 0.9.3) : l'utilisateur les a fait retirer
  de la liste du menu, sans supprimer les écrans : ils restent accessibles par leur adresse
  (`/rentabilite`, `/recus`) et les tests e2e les ouvrent ainsi.
- **Démonstration publique sur GitHub Pages** (`lechat45/Site_Therapeute`, mode démo
  seulement, jamais de vraies données) : `docs/DEPLOIEMENT.md`.
- **Pas de polices téléchargées** (Google Fonts) : la politique de sécurité du site
  n'autorise que ses propres fichiers ; Segoe UI ou police système.
- Écartées pour l'instant (gardées dans `docs/IDEES.md`) : numéros d'urgence affichés au
  client, changement obligatoire du mot de passe provisoire, double authentification
  obligatoire.

## À confirmer avec l'utilisateur

- La **liste officielle des 14 émotions** (liste actuelle provisoire, identifiants 1 à 14 à
  conserver) ;
- le sens de **« T.I.M. »** sur la fiche papier (aujourd'hui texte libre) ;
- le sens des **deux moitiés** de la barre « Émotion Temps Présent » ;
- le rôle des cases **« Séance 1 / Séance 2 »** du papier.

Les autres hypothèses (seuils d'anonymat, tranches d'âge, délais…) sont listées dans
`docs/ARCHITECTURE.md`, section 7.

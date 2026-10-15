# Idées pour la suite

Classées par intérêt pour les thérapeutes et par effort estimé (S = petit, M = moyen,
L = gros). Rien n'est commencé ; chaque idée respecte les règles de `AGENTS.md`
(confidentialité, IA facultative, rien n'est envoyé automatiquement). Ce qui a déjà été
réalisé est dans `CHANGELOG.md`.

## Sécurité, proposés puis mis de côté (à reprendre sur décision)

| Idée | Pourquoi | Effort |
|---|---|---|
| **Numéros d'urgence (3114, 15, 112) affichés au client** si son questionnaire contient des mots de détresse | le thérapeute lit parfois la réponse plusieurs jours après | S |
| **Changement obligatoire du mot de passe provisoire** à la première connexion | le mot de passe donné par l'administrateur peut rester en place | S |
| **Double authentification obligatoire** (réglage de l'administrateur) | données de santé ; aujourd'hui facultative | S |

## Prolongements de la version 0.9.0

| Idée | Pourquoi | Effort |
|---|---|---|
| **Reçu groupé envoyé automatiquement en fin de mois** au client qui le souhaite (préparé, envoyé à la main) | mutuelles qui demandent un relevé mensuel | S |
| **Note de séance à partir des réponses** d'un exercice (bouton « Reprendre dans mes notes ») | gagner du temps en séance | S |
| **Modèles d'exercices partagés** entre thérapeutes de l'espace de groupe (sans données client) | enrichir la bibliothèque | M |

## Pour le suivi des clients

| Idée | Pourquoi | Effort |
|---|---|---|
| **Export PDF d'une fiche client** (synthèse, séances, courbes) | à remettre au client ou à archiver ; base : la feuille d'impression déjà en place | M |
| **Objectifs du client** avec avancement (0–10) revu à chaque séance | rendre visibles les progrès, en lien avec le bilan | M |
| **Genre et date de naissance complète** (facultatifs) | demandés dans le cahier des charges initial ; statistiques par genre | S |
| **Recherche plein texte** dans les notes de séance (sous RLS) | retrouver « le client qui parlait de… » | M |
| **Modèles de séance** (texte d'objectif ou de T.I.M. préremplis) | gain de temps à la saisie | S |
| **Archivage des clients** terminés (masqués de la liste, conservés) | liste plus courte sans rien supprimer | S |
| **Durée légale de conservation** : alerte pour les dossiers inactifs depuis N ans | conformité RGPD | S |

## Pour les relances et questionnaires

| Idée | Pourquoi | Effort |
|---|---|---|
| **Questions conditionnelles** (afficher Q5 si Q4 = « oui ») | questionnaires plus courts et plus fins | M |
| **Questionnaire avant la première séance** (même lien, autre modèle) | arriver à la séance 1 avec le contexte | S |
| **Envoi par une adresse d'expédition** (SMTP du cabinet), en option | pour qui ne veut pas passer par sa messagerie | L |
| **Statistiques des questionnaires** : taux de réponse, délai moyen | savoir si les relances fonctionnent | S |

## Pour l'assistant IA (toujours facultatif, à la demande)

| Idée | Pourquoi | Effort |
|---|---|---|
| **Préparation de séance** : 3 points à aborder, tirés de la synthèse et du dernier questionnaire | gain de temps avant la séance | S |
| **Brouillon de message personnalisé** pour une relance prioritaire | ton adapté, relu avant envoi | S |
| **Dictée vocale** des notes de séance (reconnaissance du navigateur) | saisie sur tablette | M |

## Pour le groupe

| Idée | Pourquoi | Effort |
|---|---|---|
| **Comparaison anonyme** « moi / groupe » sur les émotions | situer sa pratique sans rien révéler | S |
| **Fiches pratiques partagées** (textes, exercices) entre thérapeutes | entraide, sans aucune donnée client | M |
| **Rôle d'administrateur dans l'appli** (créer les comptes sans script) | moins technique que `scripts/comptes.mjs` | M |

## Technique et confort

| Idée | Pourquoi | Effort |
|---|---|---|
| **Mode sombre** (les couleurs sont déjà des variables) | confort le soir | M |
| **Application installable (PWA)** et consultation hors ligne de la liste des clients | tablette au cabinet sans réseau fiable | M |
| **Sauvegarde / export de toutes ses données** (JSON + CSV) | portabilité RGPD, sérénité | S |
| **Hébergement de données de santé (HDS)** : choix d'un hébergeur certifié | obligation probable en France, voir `docs/ARCHITECTURE.md` | L |

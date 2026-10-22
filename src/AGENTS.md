# src/ — application React

Complète `../AGENTS.md`. Guides plus précis : `domaine/AGENTS.md`, `donnees/AGENTS.md`.

## Couches et sens des dépendances

| Dossier | Rôle | Peut importer |
|---|---|---|
| `domaine/` | logique pure : types, calculs, formats (testée dans `tests/`) | `config/`, `supabase/functions/_shared/` |
| `config/` | référentiels, libellés, valeurs par défaut (miroirs des migrations) | `domaine/types` |
| `donnees/` | `SourceDonnees` : `demo.ts` (navigateur) et `supabase.ts` (production) | `domaine`, `config` |
| `etat/` | contextes et hooks React | `donnees`, `domaine`, `config` |
| `composants/` | briques d'interface réutilisables | tout ce qui précède |
| `pages/` | un écran par fichier ; `pages/parametres/Onglet*.tsx` | tout |

Mettre la logique dans `domaine/` (testable sans navigateur) plutôt que dans un composant.

## Accès aux données

- Toujours passer par `donnees` (`import { donnees } from '../donnees'`). Ne jamais importer
  `donnees/demo.ts`, `jeuDemo.ts` ou `supabase.ts` depuis un écran (ils sortiraient du bon
  paquet). Ce qui sert à l'écran en mode démo est dans `donnees/cleDemo.ts` ou une méthode
  facultative du contrat (`donnees.reinitialiserDemo?.()`), et `donnees.mode` dit le mode.
- Chargement : `useChargement(() => donnees.x(), [deps], cle?)` →
  `{ donnees, erreur, chargement, recharger, remplacer }`. La `cle` réaffiche tout de suite les
  dernières données connues (mémoire seulement) : pour les écrans de consultation, jamais pour
  un formulaire.
- Contextes : `useTherapeute()` / `useSession()` (`etat/session.tsx`), `useReglages()` →
  `{ parametres, enregistrer(champs) }` (`etat/reglages.tsx`, applique aussi thème et
  affichage), `useTaches()` → `{ taches, reportees, semaine, clients, envois, rendezVous,
  tachesPerso, remises, recharger… }` (`etat/tachesContexte.tsx`, rechargé à chaque page).

## Écrans (`pages/`) et leurs composants

| Écran (route) | Fichier | Composants principaux |
|---|---|---|
| Tableau de bord `/` : bandeau d'accueil (`BandeauAccueil`), puis statistiques ; espace de groupe `/groupe` : repères (`ReperesGroupe`) et « Vous et le groupe » (`ComparaisonGroupe`) | `Statistiques.tsx` | `Graphiques.tsx` ; logique : `domaine/comparaison.ts` |
| Mes clients `/clients` (chiffres clés, liste, corbeille, « Nouveau client » avec consentement) | `Clients.tsx` | — |
| Fiche client `/clients/:id` : bandeau fort + onglets `?vue=apercu|seances|suivi|notes` | `FicheClient.tsx` | aperçu : `RendezVousClient`, `DonneesPersonnelles` (RGPD), synthèse, problématiques ; séances : `EvolutionClient` ; suivi : `CarteSuiviClient` ; notes : `OutilsClient` (`NotesClient`) |
| Séance `/clients/:id/seances/:id` | `FicheSeance.tsx` | `FeuilleSeance` (fiche papier), `ExercicesRendus` (masqué avec les exercices) |
| Tâches `/taches` (sans planning des rendez-vous : décision de l'utilisateur) | `Taches.tsx` | `CartesTaches`, `MesTaches`, `RecapSemaine`, `LectureQuestionnaire`, `DialogueEnvoi`, `DialogueRappel`, `DialogueRappelExercice`, `ReponsesExercice`, `StatutEnvoi` |
| Emploi du temps `/emploi-du-temps` | `EmploiDuTemps.tsx` | `Agenda` (semaine, jour, légende), `DialogueRendezVous` (« Avec qui ? Quand ? Où ? », créneaux libres) |
| Activité `/activite` | `Activite.tsx` | `Graphiques` (`Colonnes`, `BarresHorizontales`, `couleurThermique`) |
| Journal `/journal` | `Journal.tsx` | `DialogueNote` |
| Exercices `/exercices`, impression `/exercices/:id/imprimer` — **masqués** (`EXERCICES_VISIBLES`) | `Exercices.tsx` | `DocumentTexte`, `DialogueRemise`, `ReponsesExercice` |
| Rentabilité `/rentabilite` (hors menu ; accès : Paramètres › Tarifs) | `Rentabilite.tsx` | `Graphiques` |
| Reçus `/recus`, impression `/recus/:id` (hors menu ; accès : Paramètres › Tarifs) | `Recus.tsx` | `FeuilleRecu`, `DialogueLienRecu` |
| Paramètres `/parametres?onglet=…` | `Parametres.tsx` + `parametres/*.tsx` | voir le tableau suivant |
| Connexion `/connexion` (« Découvrir le site », lien vers la politique) | `Connexion.tsx` | `Presentation` |
| **Publiques** (sans compte) `/q/:jeton`, `/d/:jeton`, `/r/:jeton` | `QuestionnairePublic.tsx`, `DocumentPublic.tsx`, `RecuPublic.tsx` | `DocumentTexte`, `FeuilleRecu`, `PiedPublic` (lien vers la politique) |
| **Publique** : politique de confidentialité `/confidentialite` (RGPD) | `Confidentialite.tsx` | textes de `config/rgpd.ts` |

Routes : `App.tsx` (les parties masquées n'ont pas de route) ; menu : `composants/Structure.tsx`
(sans Rentabilité, Reçus ni Exercices ; « Présentation du site » ouvre `Presentation`).

### Onglets des Paramètres (`pages/parametres/`)

| Onglet (`?onglet=`) | Fichier | Contenu |
|---|---|---|
| `profil` | `OngletProfil.tsx` | nom, photo, spécialité, téléphone, signature ; coordonnées des reçus (si `ARGENT_VISIBLE`) |
| `affichage` | `OngletAffichage.tsx` | nom et couleur du site, vision des couleurs, taille du texte, densité, page d'ouverture, animations |
| `securite` | `OngletSecurite.tsx` | mot de passe, double authentification, délai de déconnexion automatique, journal des connexions |
| `tarifs` (si `ARGENT_VISIBLE`) | `OngletTarifs.tsx` | tarifs ; boutons « Voir la rentabilité » et « Mes reçus » |
| `agenda` | `OngletEmploiDuTemps.tsx` | heures et jours de travail, couleurs (vérifiées pour les daltonismes), durée, rappels |
| `relances` | `OngletRelances.tsx` | relances, validité des liens, modèles de messages ; rappel d'exercice (si exercices visibles) |
| `questionnaires` | `OngletQuestionnaires.tsx` | éditeur de questionnaires (7 types de questions, bibliothèque) |
| `ia` | `OngletIA.tsx` | assistant IA, quota, information sur le transfert hors UE |
| `confidentialite` | `Parametres.tsx` (`OngletConfidentialite`) + `SectionRgpd.tsx` | engagements de confidentialité ; RGPD : export complet, fiches à revoir (5 ans) |

### Composants (`composants/`)

| Fichier | Rôle |
|---|---|
| `Commun.tsx` | `Dialogue` (prop `classe` pour un grand format), `Confirmation`, `Erreur`, `Chargement`, `useNotifier`, `telecharger` (fichier créé dans le navigateur), `PiedPublic` |
| `Structure.tsx` | menu latéral, barre mobile, déconnexion après inactivité, présentation du site |
| `Icone.tsx`, `Avatar.tsx` | pictogrammes au trait (1,6 px), avatar du thérapeute |
| `Presentation.tsx` | présentation du site en diapositives (contenu : `config/presentation.ts`) |
| `DonneesPersonnelles.tsx` | fiche client : consentement (RGPD), export des données du client |
| `DialogueRendezVous.tsx`, `Agenda.tsx`, `RendezVousClient.tsx`, `DialogueRappel.tsx` | emploi du temps et rendez-vous |
| `CartesTaches.tsx`, `MesTaches.tsx`, `RecapSemaine.tsx` | onglet Tâches |
| `CarteSuiviClient.tsx`, `DialogueEnvoi.tsx`, `StatutEnvoi.tsx`, `LectureQuestionnaire.tsx`, `ReponsesQuestionnaire.tsx` | relances, questionnaires envoyés, état d'un envoi, lecture et réponses (lues sur la COPIE des questions) |
| `EvolutionClient.tsx`, `Graphiques.tsx` | courbes et graphiques (sans bibliothèque) |
| `FeuilleSeance.tsx` | la fiche papier numérique |
| `OutilsClient.tsx` (`NotesClient`, `DocumentsClient`), `DialogueNote.tsx` | notes du journal ; documents remis (masqués) |
| `DialogueRemise.tsx`, `DialogueRappelExercice.tsx`, `ReponsesExercice.tsx`, `ExercicesRendus.tsx`, `DocumentTexte.tsx` | exercices et documents (masqués avec `EXERCICES_VISIBLES`) |
| `FeuilleRecu.tsx`, `DialogueLienRecu.tsx` | reçus |

### Configuration (`config/`)

| Fichier | Contenu | Miroir / test |
|---|---|---|
| `referentiels.ts` | 14 émotions, problématiques, tranches d'âge, zones de la fiche, seuils d'anonymat | migration `referentiels`, `sql` |
| `parametresDefaut.ts` | réglages par défaut d'un nouveau thérapeute | migration `relances_questionnaires`, `sql` |
| `agenda.ts` | catégories de rendez-vous (couleur, pictogramme, motif), modalités, statuts, jours | `logique` (couleurs) |
| `taches.ts` | libellés des récurrences | — |
| `ressources.ts` | modèles d'exercices et de documents | — |
| `fonctions.ts` | **interrupteurs** des parties affichées : `EXERCICES_VISIBLES = false`, `ARGENT_VISIBLE = true` | e2e (`test.skip`) |
| `presentation.ts` | contenu de la présentation du site (une diapositive par partie) | `presentation` |
| `rgpd.ts` | durées de conservation (fiche 5 ans, journal 12 mois), éditeur (« [à compléter] »), date de la politique | `rgpd`, `sqlRgpd` |

## Interface

- Briques communes (`composants/Commun.tsx`) : `Dialogue` (modale `<dialog>` native ; Échap
  appelle `fermer()` et c'est le parent qui décide ; `classe` pour un grand format),
  `Confirmation`, `Erreur`, `Chargement`, `useNotifier()` (message éphémère), `telecharger`
  (fichier créé dans le navigateur : exports CSV et JSON), `PiedPublic`. Pictogrammes : `Icone`.
- Onglets : la fiche client utilise de vrais onglets ARIA (`role="tablist"`, `tab`,
  `tabpanel`, flèches gauche/droite) et garde l'onglet dans l'adresse (`?vue=`).
- Classes CSS principales : `carte`, `carte-entete`, `carte-corps`, `bouton` (`-principal`,
  `-doux`, `-danger`, `-petit`, `-icone`), `champ`, `puce` (`-succes`, `-alerte`, `-danger`,
  `-neutre`, `-ia`), `alerte`, `segments`/`segment`, `actions`, `grille-2`, `feuille`
  (version à imprimer), `ne-pas-imprimer`.
- Style : système de design **Flow** (voir l'en-tête de `styles/base.css`) avec le violet
  comme seul accent : fond beige `--fond`, cartes blanches, un seul bouton `bouton-principal`
  par zone, un seul bandeau fort (`--bandeau`, `--courbes`) par écran, pas de dégradés.
- Couleurs : toujours des variables (`--accent`, `--succes`, `--danger`…). `--marque` est
  réglable ; les couleurs d'état changent avec le mode daltonien
  (`styles/accessibilite.css`, attribut `data-vision` sur `<html>`). Un état = pictogramme +
  texte. Préférences d'affichage : `data-taille`, `data-densite`, `data-vision`,
  `data-animations` (posés par `etat/reglages.tsx`).
- Formulaires longs : protéger la saisie (`useBlocker` + `beforeunload`, voir
  `pages/FicheSeance.tsx`) ; la fiche de séance s'enregistre aussi automatiquement.
- Une modale qui contient un formulaire se monte seulement quand elle est ouverte
  (`{ouvert && <DialogueX …/>}`), sinon l'ancienne saisie réapparaît.
- Libellés accessibles : `<label htmlFor>` + `id` sur chaque champ (les tests e2e les
  utilisent avec `getByLabel`).

## Pièges

- Date du jour : `dateDuJour()` (locale), jamais `toISOString().slice(0, 10)`.
- Les questions envoyées sont une **copie** (`envois.questions`, `remises.contenu`) : lire
  la copie, pas le questionnaire ou le document actuel.
- `Recu.lignes` : un reçu groupé a plusieurs lignes ; `recu.date_seance` est alors celle de la
  dernière séance.

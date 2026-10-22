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
| Tableau de bord `/` (bandeau d'accueil `BandeauAccueil`, puis statistiques), espace de groupe `/groupe` | `Statistiques.tsx` | `Graphiques.tsx` |
| Mes clients `/clients` | `Clients.tsx` | `Avatar` |
| Fiche client `/clients/:id` (bandeau + onglets `?vue=apercu|seances|suivi|notes`) | `FicheClient.tsx` | `CarteSuiviClient`, `EvolutionClient`, `RendezVousClient`, `OutilsClient` (notes, exercices remis) |
| Séance `/clients/:id/seances/:id` | `FicheSeance.tsx` | `FeuilleSeance` (fiche papier), `ExercicesRendus` |
| Tâches `/taches` | `Taches.tsx` | `CartesTaches`, `MesTaches`, `RecapSemaine`, `LectureQuestionnaire`, `DialogueEnvoi`, `DialogueRappel`, `DialogueRappelExercice`, `ReponsesExercice` |
| Emploi du temps `/emploi-du-temps` | `EmploiDuTemps.tsx` | `Agenda` (semaine, jour, légende), `DialogueRendezVous` |
| Activité `/activite` | `Activite.tsx` | `Graphiques` (`Colonnes`, `BarresHorizontales`, `couleurThermique`) |
| Journal `/journal` | `Journal.tsx` | `DialogueNote` |
| Exercices `/exercices`, impression `/exercices/:id/imprimer` | `Exercices.tsx` | `DocumentTexte`, `DialogueRemise`, `ReponsesExercice` |
| Rentabilité `/rentabilite` | `Rentabilite.tsx` | `Graphiques` |
| Reçus `/recus`, impression `/recus/:id` | `Recus.tsx` | `FeuilleRecu`, `DialogueLienRecu` |
| Paramètres `/parametres?onglet=…` | `Parametres.tsx` + `parametres/Onglet*.tsx` | — |
| Connexion `/connexion` | `Connexion.tsx` | — |
| Publiques (sans compte) `/q/:jeton`, `/d/:jeton`, `/r/:jeton` | `QuestionnairePublic.tsx`, `DocumentPublic.tsx`, `RecuPublic.tsx` | `DocumentTexte`, `FeuilleRecu` |

Routes : `App.tsx` ; menu : `composants/Structure.tsx`.

## Interface

- Briques communes (`composants/Commun.tsx`) : `Dialogue` (modale `<dialog>` native ; Échap
  appelle `fermer()` et c'est le parent qui décide), `Confirmation`, `Erreur`, `Chargement`,
  `useNotifier()` (message éphémère). Pictogrammes : `Icone` (`composants/Icone.tsx`).
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

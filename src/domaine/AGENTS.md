# src/domaine/ — logique pure

Complète `../../AGENTS.md` et `../AGENTS.md`.

## Règles

- **Aucun effet de bord** : pas de React, pas de `donnees/`, pas de `fetch`, pas de
  `localStorage`. Entrées → sorties. « Maintenant » et « aujourd'hui » se passent en paramètre
  (`maintenant`, `aujourdhui`) pour que les tests soient déterministes.
- Imports permis : `./types`, les autres fichiers de `domaine/`, `../config/*`,
  `../../supabase/functions/_shared/*`.
- Une règle qui existe aussi en SQL doit donner **exactement** le même résultat : un test de
  parité la compare à la fonction SQL (voir la colonne « Miroir SQL »).
- Jours locaux au format `AAAA-MM-JJ` (chaînes comparables) ; horodatages ISO pour les
  instants. Jamais de calcul de jours en millisecondes sur des dates locales (heure d'été).

- **RGPD** : une nouvelle donnée sur un client doit être ajoutée à `exportClient` (et à son
  test) ; voir `docs/RGPD.md`.

## Fichiers

| Fichier | Contenu | Miroir SQL | Tests |
|---|---|---|---|
| `types.ts` | tous les types partagés (données, paramètres, statistiques…) | colonnes des tables | — |
| `format.ts` | `dateDuJour` (locale !), dates et nombres en français, `messageErreur` | — | `logique` |
| `agenda.ts` | semaines, `horodatage`, `disposer` (chevauchements), `conflits`, `creneauxLibres`, `habitudesClient`, `texteCreneaux` | — | `logique`, `outils`, `prolongements` |
| `couleurs.ts` | simulation des daltonismes (Machado 2009), écart OKLab, `confusions` | — | `logique` |
| `taches.ts` | `calculerTaches` (toutes les tâches calculées, ordre d'affichage), `prochaineRelance`, `separerReportees`, `recapSemaine`, `resumeDuJour`, `echeanceSuivante`, `familleTache`, `titreTache` | `echeance_suivante` | `logique`, `outils`, `prolongements`, `rappelsRecus`, `sqlProlongements` |
| `texte.ts` | texte simple des documents → blocs (`# - ?`), `questionsDocument`, `validerReponsesDocument`, `numeroRecu` | `questions_document`, `repondre_document` | `outils`, `prolongements`, `sqlProlongements` |
| `exercices.ts` | `exercicesRendus` (exercices à afficher sur une fiche de séance) | — | `rappelsRecus` |
| `recus.ts` | `recapAnnuel`, `totauxTrimestres`, `csvRecus`, `csvLivreRecettes` (CSV à la française, cellules protégées) | — | `prolongements`, `rappelsRecus` |
| `activite.ts` | `statistiquesAgenda` (heures, absences, annulations, créneaux) | — | `outils` |
| `statistiques.ts` | `calculerStatistiques` (mode démo) | `statistiques()` | `sql` (égalité SQL = démo) |
| `rentabilite.ts` | `calculerRentabilite`, `euros` | — | `logique` |
| `messages.ts` | modèles de messages (`remplirModele`), liens `mailto:` / `sms:`, liens publics `/q` `/d` `/r`, `masquerLien`, `insererAvantSignature` | `confirmer_envoi` (masquage) | `logique`, `outils` |
| `securite.ts` | TOTP (RFC 6238), jetons et empreintes SHA-256, règles des mots de passe | empreintes des jetons | `logique` |
| `contexteAnalyse.ts` | contexte d'une séance pour l'IA | — | `analyse` |
| `comparaison.ts` | espace de groupe : `reperesGroupe` (jamais une case `masque`), `comparerIndicateurs`, `comparerEmotions`, `position` (± 10 %), `phrasePosition` | — (lit les agrégats de `statistiques()`) | `comparaison` |
| `rgpd.ts` | `exportClient` (toutes les données d'UN client, en clair, sans jeton ni identifiant interne), `exportComplet` (tout le thérapeute), `fichesARevoir` (durée de conservation), `nomFichierExport` | durées : `purger_journal_connexions` | `rgpd`, `sqlRgpd` |

Code partagé avec la fonction Edge et les tests : `supabase/functions/_shared/` (`analyse.ts`,
`questionnaire.ts` — validation des réponses, miroir de `repondre_questionnaire`, `fiche.ts`,
`cors.ts`).

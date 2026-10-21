# src/styles/ — feuilles de style

Complète `../AGENTS.md` et `../../AGENTS.md`. Le style suit le **système de design Flow en
version violette** : règles complètes dans `docs/DESIGN.md` (le PDF d'origine n'est pas dans
le dépôt). CSS maison, aucune bibliothèque d'interface, aucun préprocesseur.

## Fichiers, dans l'ordre de la cascade (`index.css`)

Un fichier suivant peut surcharger les précédents : garder cet ordre.

| Fichier | Contenu |
|---|---|
| `base.css` | **variables** (couleurs, arrondis, ombres, polices), courbes des bandeaux forts, remise à zéro, titres |
| `composants.css` | cartes, boutons, champs, puces, alertes, tableaux, boîtes de dialogue, notifications, sélecteurs |
| `structure.css` | menu latéral, zone de contenu, barre mobile, badges du menu, bandeau des tâches |
| `connexion.css` | écran de connexion (bandeau fort à gauche) |
| `tableaux-de-bord.css` | indicateurs (dont l'indicateur vedette = bandeau fort), graphiques |
| `clients.css`, `seance.css`, `taches.css`, `questionnaire.css`, `parametres.css`, `agenda.css`, `outils.css` | un écran ou une famille d'écrans chacun |
| `tactile.css` | écrans tactiles : cibles de 44 px, texte de 16 px dans les champs (pas de zoom iOS) |
| `accessibilite.css` | **en dernier** : mode daltonien, taille du texte, densité, animations, impression |

## Règles

- **Jamais une couleur en dur** : utiliser les variables de `base.css` (`--fond`, `--surface`,
  `--encre…`, `--accent…`, `--violet-50…950`, `--succes`, `--alerte`, `--danger`, `--bandeau`).
  Exceptions admises : `#fff` pour un texte sur fond d'accent ou sur bandeau, et les feuilles
  imprimables (`.feuille`, impression : noir sur blanc).
- **Le violet dérive de `--marque`**, que le thérapeute peut changer (Paramètres ›
  Affichage, posé par `etat/reglages.tsx` sur `<html>`). Une nouvelle nuance s'écrit
  `color-mix(in oklab, var(--marque) N%, white|black)`, jamais une valeur fixe.
- **Les couleurs d'état sont redéfinies par le mode daltonien** (`accessibilite.css`,
  attribut `data-vision`) : ne pas les surcharger ailleurs. Toute nouvelle couleur d'état ou
  d'agenda se vérifie avec `domaine/couleurs.ts` et un test.
- **Tailles en `rem`, base 15 px** (texte courant = `0.9333rem` = 14 px). La taille du texte
  réglable change seulement `html` (`data-taille`).
- **Un seul bouton `.bouton-principal` par zone**, un seul bandeau fort par écran, pas de
  dégradés (sauf les courbes des bandeaux forts), ombres brun chaud (`--ombre…`).
- **Nouveau bandeau fort** : `background: var(--courbes), var(--bandeau);` +
  `background-repeat: no-repeat;` (sinon les courbes réapparaissent dans la bordure de 1 px),
  et ajouter son sélecteur à la règle qui définit `--courbes` dans `base.css`. Une variable
  CSS qui en utilise une autre est calculée là où elle est déclarée : c'est pourquoi
  `--courbes` est déclarée sur les bandeaux et pas sur `:root`.
- **Tactile** : toute nouvelle cible cliquable de moins de 44 px sur ordinateur reçoit sa
  version de 44 px dans `tactile.css` (`@media (pointer: coarse)`).
- **Préférences d'affichage** (attributs sur `<html>`) : `data-taille`, `data-densite`,
  `data-vision`, `data-animations`. Un nouvel élément dense doit avoir sa variante
  `data-densite='compacte'` si besoin.
- **Sélecteurs utilisés par les tests e2e** : `e2e/*.spec.ts` s'appuie surtout sur les rôles
  et libellés, mais aussi sur quelques classes (`.tableau-recu`, `.liste-a-emettre`, `.liste-miennes`) :
  vérifier avec `grep` avant de renommer une classe.
- Chaque fichier commence par un commentaire d'une ligne qui dit son rôle ; sections
  séparées par des bandeaux `/* --- */` comme dans les fichiers existants.

## Vérifier un changement visuel

`npm run dev`, puis regarder l'écran sur ordinateur **et** en largeur téléphone (390 px), en
mode daltonien et en grand texte (Paramètres › Affichage). `npm run test:e2e` couvre aussi la
largeur téléphone (projet Playwright « telephone »).

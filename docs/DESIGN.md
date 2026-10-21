# Système de design — Flow, version violette

Le style du site suit le **système de design Flow** (version 4.0, octobre 2026), créé par
l'utilisateur pour tous ses sites. Le document d'origine est un PDF **hors du dépôt**
(`flow.github.io/Flow-Systeme-de-design.pdf`, sur le poste de l'utilisateur) : ce fichier en
est la transcription complète, adaptée à ce projet. **C'est la référence** pour tout
changement visuel.

**Une seule différence avec Flow, demandée par l'utilisateur : l'accent est le VIOLET, pas le
corail.** Partout où Flow dit « corail », lire « violet » (`--accent`, dérivé de `--marque`).
Ne jamais réintroduire l'orange ou le corail.

Mise en œuvre : `src/styles/base.css` (variables), `structure.css` (menu, zone de contenu),
`composants.css` (boutons, champs, puces, tableaux, boîtes de dialogue), `connexion.css` et
`tableaux-de-bord.css` (bandeaux forts). Guide des styles : `src/styles/AGENTS.md`.

## 1. L'esprit : calme, net, chaleureux

Flow s'inspire de **Windows 11** (matière « Mica », coins arrondis, typographie Segoe) et y
ajoute **une seule couleur forte**. Le résultat doit paraître sérieux pour un client, sans
être froid.

1. **Une seule couleur d'accent.** Le violet sert aux actions principales, à l'élément actif
   et aux points d'attention. Tout le reste est neutre et chaud. Si tout est coloré, plus rien
   ne ressort.
2. **Des surfaces plutôt que des ombres.** La hiérarchie vient de trois couches : le fond
   beige, la zone de contenu translucide, puis les cartes blanches. Les ombres restent très
   légères, juste un souffle.
3. **Des icônes dessinées, jamais d'emojis.** Traits fins de 1,6 px, bouts arrondis, grille de
   24 px, couleur du texte (`currentColor`). Composant : `src/composants/Icone.tsx`.
4. **Lisible avant tout.** Texte de 14 px, contrastes suffisants (le gris le plus clair sur
   fond clair est `--encre-4` = `#707070`), zones cliquables d'au moins 36 px de haut sur
   ordinateur (44 px sur écran tactile, règle du projet : `styles/tactile.css`).
5. **Des moments forts, rares.** Les grands bandeaux sombres sont réservés à l'information la
   plus importante d'un écran. **Un seul par page.**
6. **Deux thèmes, mêmes règles.** Flow prévoit un thème clair (par défaut) et un thème sombre
   qui reprend exactement les mêmes variables avec d'autres valeurs : on ne code **jamais**
   une couleur en dur. *Ici, seul le thème clair est fait* (thème sombre : `docs/IDEES.md`).

## 2. Couleurs

On utilise toujours le **nom** de la variable, jamais la valeur. Correspondance entre les
noms de Flow et ceux du projet (noms français, déjà utilisés dans tous les fichiers CSS) :

| Flow | Projet | Valeur (clair) | Rôle |
|---|---|---|---|
| `--coral` | `--accent` (= `--violet-700`) | dérivé de `--marque` (`#7436e6` par défaut) | boutons principaux, élément actif, liens |
| `--coral-deep` | `--accent-survol` (= `--violet-800`) | dérivé | survol des boutons principaux |
| `--coral-soft` | `--violet-800` | dérivé | texte d'accent sur fond clair (puces) |
| `--coral-tint` | `--accent-doux` (= `--violet-100`), `--violet-50` | dérivé | fonds d'icônes, puces, sélection, alertes d'information |
| `--bg-0` | `--fond` | `#f3efec` | fond de l'application (beige chaud) |
| `--surface-1` | `--surface` | `#ffffff` | cartes, fenêtres |
| `--surface-3` | `--surface-2` | `#f6f3f1` | survol, en-têtes, pieds de boîte de dialogue |
| — | `--zone-contenu` | blanc à 55 % | couche translucide sous les cartes |
| `--rubis-bg` / `--dark-band` | `--bandeau` | `#2b211d` teinté de 14 % de violet | bandeaux forts |
| `--ink` | `--encre` | `#1a1a1a` | texte principal |
| `--ink-2` | `--encre-2` | `#3d3d3d` | texte courant atténué |
| `--ink-3` | `--encre-3` | `#5c5c5c` | texte secondaire |
| `--ink-4` | `--encre-4` | `#707070` | gris le plus clair autorisé sur fond clair |
| `--border` | `--bordure` | noir à 7 % | contours fins |
| `--border-hi` | `--bordure-forte` | noir à 14 % | contours des boutons et champs |
| — | `--bordure-bas` | noir à 22 % | bord bas des boutons et champs (effet Windows) |
| `--sage` | `--succes` | `#177245` | terminé, validé, payé |
| `--peach` | `--alerte` | `#9a5b00` | échéance proche, pause |
| `--danger` | `--danger` | `#b42318` | retard, suppression |
| `--sky` | — | (`#2b6cb0` dans Flow) | en attente ; non utilisé ici |
| `--plum` | — | (`#7a4cc2` dans Flow) | catégories, graphiques ; ici les graphiques sont en violet |

- Toutes les nuances `--violet-50` à `--violet-950` **dérivent de `--marque`**, que chaque
  thérapeute peut changer (Paramètres › Affichage). Ne jamais écrire un violet en dur.
- Les couleurs d'état (`--succes`, `--alerte`, `--danger`, et leurs `-doux`) gardent les
  valeurs du projet, proches de Flow, parce qu'elles sont **vérifiées pour les trois formes
  de daltonisme** et redéfinies par le mode daltonien (`styles/accessibilite.css`). Les
  changer impose de refaire cette vérification (`domaine/couleurs.ts` et son test).
- Les couleurs des types de rendez-vous de l'agenda (`config/agenda.ts`) ne font pas partie
  de Flow : elles sont choisies pour rester distinctes sous les trois daltonismes.
- Thème sombre de Flow, pour mémoire : `--bg-0 #1f1b19`, `--surface-1 #2b2725`,
  `--surface-3 #37322f`, `--ink #f5f2f0`, `--ink-3` blanc à 64 %, `--border` blanc à 8 %,
  accent plus clair qu'en clair.

## 3. Typographie

Police : **Segoe UI Variable** (celle de Windows 11), **Geist** en secours (Mac, Android),
**DM Mono** pour le code et les chiffres techniques (`--police`, `--police-mono`).
Les polices ne sont **pas téléchargées** (pas de Google Fonts) : la politique de sécurité du
site (`public/_headers`) n'autorise que ses propres fichiers. Les appareils sans Segoe UI
utilisent leur police système.

| Usage | Flow | Projet |
|---|---|---|
| Titre de page | 28 px, semi-gras | `h1` (1,8667 rem) |
| Grand titre de bandeau | 32 à 46 px, gras | `.connexion-visuel h1` |
| Titre de carte | 16 px, semi-gras | `h2` (1,0667 rem) |
| Texte courant | 14 px, normal, interligne 1,5 | `body` (0,9333 rem) |
| Libellé de champ | 13 px, semi-gras | `.champ > label`, `.etiquette` |
| Texte secondaire | 12 px, `--ink-3` | `.aide`, `.indication`, `.meta`… |
| Sur-titre | 12 px, MAJUSCULES, +4 % d'espacement | `th` des tableaux |
| Code | DM Mono 13 px | `code`, `kbd`, `.chiffres-techniques` |

**Unités** : tout est en `rem`, et la base reste à **15 px** (`html`) pour que la taille du
texte réglable (`data-taille` : 17 ou 19 px) agrandisse tout. Le texte courant à 14 px
s'écrit donc `0.9333rem`. Ne pas passer la base à 14 px : une centaine de petits textes
tomberaient sous 11 px.

## 4. Formes, espaces, ombres

- **Arrondis** : 6 px boutons et champs (`--rayon-petit`) · 8 px menus, alertes, liens du menu
  (`--rayon-menu`) · 12 px cartes et fenêtres (`--rayon`) · 18 à 20 px bandeaux
  (`--rayon-bandeau`) · rond pour avatars et pastilles. Logo : carré arrondi à 22 %.
- **Espacements** : multiples de 4 (4, 8, 12, 16, 20, 32 px). Cartes : 20 px de marge
  intérieure ; 20 px entre deux cartes.
- **Ombres**, toujours brun chaud (`rgb(60 30 20 / …)`), jamais noires : `--ombre` (cartes au
  repos), `--ombre-survol` (survol), `--ombre-haute` (menus et fenêtres).

## 5. Composants

| Composant | Règle Flow | Classe |
|---|---|---|
| Bouton principal | Fond d'accent, texte blanc semi-gras, ombre intérieure basse. **Un seul par zone.** | `.bouton.bouton-principal` |
| Bouton « fantôme » | Fond blanc, contour fin, **bord bas un peu plus foncé** (Windows). Hauteur 34 px, petit 30 px. | `.bouton`, `.bouton-petit` |
| Bouton de suppression | Fond rouge très clair, texte rouge | `.bouton-danger` |
| Champ | Libellé **toujours au-dessus**, jamais seulement dans le champ. Au clic, **seul le bord bas devient violet (2 px)** | `input`, `select`, `textarea`, `.champ` |
| Puce de statut | Fond à 10–12 % de la couleur, texte dans la couleur pleine, 22 px de haut, coins totalement arrondis | `.puce`, `.puce-succes`, `.puce-alerte`, `.puce-danger`, `.puce-neutre` |
| Progression | Barres de 4 à 6 px, toujours arrondies ; vert = terminé, accent = en cours, gris = à venir | barres de `tableaux-de-bord.css`, parcours de `clients.css` |
| Carte | Fond blanc, 1 px de contour, 12 px d'arrondi ; titre + icône + information à droite ; lignes séparées par un filet | `.carte`, `.carte-entete`, `.carte-corps` |
| Sélecteur | Pastille blanche en relief sur fond gris (Windows 11) | `.segments`, `.segment` |
| Liste dans une carte | Une ligne par élément, séparées par un filet ; action principale de ligne en violet léger | `.liste-taches` (Tâches), tableaux |
| Pastille d'initiales | Rond teinté d'accent, initiales en accent foncé | `.avatar-client` (liste des clients) |
| Élément de menu actif | **Fond gris léger, texte gras, petite barre d'accent de 3 px à gauche** | `.nav-lien.active` |
| Pastille de compteur | Rond d'accent, chiffre blanc | `.badge-nav` |

## 6. Mise en page

- **Ordinateur** : le menu (264 px) est posé **directement sur le fond beige**. La zone de
  contenu est une couche blanche translucide avec **un seul coin arrondi, en haut à gauche**
  (comme les Paramètres de Windows 11). Les cartes blanches sont posées dessus.
- **Téléphone (< 900 px)** : barre du haut de 52 px sur fond beige, menu en tiroir.
  *Flow prévoit une barre d'onglets en bas sur mobile : pas encore fait (`docs/IDEES.md`).*
- Flow a une barre du haut de 52 px aussi sur ordinateur (recherche, avatar) ; ce site n'en a
  pas besoin pour l'instant.

## 7. Le bandeau fort

Fond brun très sombre (`--bandeau`), texte blanc, **courbes décoratives d'accent**
(`--courbes` : deux anneaux violets dans le coin bas-droit, taille réglée par `--courbe`),
petites tuiles translucides si besoin. **Un seul par écran**, pour l'information
principale. Utilisé ici pour : l'écran de connexion (`.connexion-visuel`), l'indicateur
vedette des tableaux de bord (`.indicateur-vedette`) et l'en-tête de la fiche client
(`.bandeau-client` : barre de progression du parcours, tuiles « Séances » et « Dernière
séance »). Un nouveau bandeau doit être ajouté à
la liste des sélecteurs qui définissent `--courbes` dans `base.css`.

## 8. À faire / à éviter

**À faire**
- Une seule action d'accent par zone ; le reste en boutons blancs.
- Des icônes en traits fins, de la même famille partout (`Icone`).
- Des textes courts, au vouvoiement côté client.
- Grouper l'information dans des cartes blanches sur fond beige.
- Tester chaque écran sur ordinateur et sur téléphone (et en clair et sombre le jour où le
  thème sombre existe).

**À éviter**
- Les emojis dans l'interface (remplacés par des icônes).
- Les couleurs écrites en dur au lieu des variables.
- Plusieurs bandeaux sombres sur le même écran.
- Les ombres noires et lourdes, **les dégradés partout**.
- Du texte gris plus clair que `--encre-4` sur fond clair.
- L'orange / le corail de Flow : ce site est **violet**.

Règles du projet qui s'ajoutent à Flow : jamais un état signalé par la seule couleur
(pictogramme + libellé), mode daltonien, cibles tactiles de 44 px (`AGENTS.md`, règle 10).

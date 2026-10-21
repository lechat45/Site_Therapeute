# Journal des versions

Format : une entrée par livraison, la plus récente en haut. Numéro de version dans
`package.json`.

## 0.10.2 — 2026-10-21

### Modifié
- **Tâches : seulement les tâches.** Le planning « Aujourd'hui » (rendez-vous du jour) et la
  colonne « Rendez-vous » de « Votre semaine » sont retirés : ils sont dans l'emploi du temps.
  Les tâches liées aux rendez-vous (rappel à envoyer, rendez-vous passé à compléter) restent,
  avec leur filtre.
- **Tâches, design Flow** : « À faire » devient une seule carte (filtres en tête, une ligne
  par tâche séparée par un filet, petite barre de couleur à gauche pour les rendez-vous, les
  urgences et les retards) ; l'action principale de chaque ligne est en violet léger (un seul
  violet plein par zone) ; l'historique des envois montre 8 lignes avant « Tout afficher ».
- **Mes clients** : quatre chiffres clés en tête (clients, parcours initial, bilan réalisé,
  sans séance), initiales du client en pastille, parcours en barrettes (le bilan garde son
  losange).
- **Fiche client** : l'en-tête devient le bandeau fort de Flow (nom, coordonnées, barre de
  progression du parcours avec son étape écrite, tuiles « Séances » et « Dernière séance »).

### Corrigé
- Liste des clients : le lien vers une fiche passe par le routeur (il gardait l'adresse sans
  le sous-dossier de GitHub Pages à l'ouverture dans un nouvel onglet).

## 0.10.1 — 2026-10-21

Projet compréhensible sans rien d'autre que ses fichiers (Codex, Claude, humains).

### Documentation
- `docs/DESIGN.md` : transcription complète du système de design Flow (dont le PDF n'est pas
  dans le dépôt), adaptée au violet : principes, correspondance des variables Flow → projet,
  typographie, formes, composants et classes, mise en page, bandeau fort, à faire / à éviter.
- `docs/DEPLOIEMENT.md` : publication sur GitHub Pages (dépôt, réglage Pages, `CHEMIN_BASE`,
  `404.html`, conséquences pour le code), production Supabase, poste Windows.
- `src/styles/AGENTS.md` : ordre de la cascade, règles des variables, bandeaux forts,
  tactile, classes utilisées par les tests.
- `AGENTS.md` : liens vers ces documents, règles 14 (design Flow en violet) et 15 (sous-dossier),
  lignes « Style », « Menu » et « Publication » dans l'index des fonctionnalités, recettes
  (menu, composant visuel), pièges (Git Bash, Node, taille du texte, variables CSS composées).
- `docs/CAHIER_DES_CHARGES.md` : décisions (design Flow en violet, menu sans Rentabilité ni
  Reçus, démonstration GitHub Pages, pas de polices téléchargées) ; `docs/IDEES.md` : thème
  sombre et barre d'onglets mobile de Flow, polices hébergées.
- Commentaires : en-tête de `vite.config.ts`, raison du menu dans `Structure.tsx`.

### Modifié
- Icônes au trait de 1,6 px (au lieu de 2 px), comme le demande Flow.

## 0.10.0 — 2026-10-21

Nouveau style : système de design **Flow** (calme, net, chaleureux, inspiré de Windows 11),
avec le **violet** comme seule couleur d'accent à la place du corail.

### Modifié
- Couleurs : fond beige chaud, cartes blanches, encre neutre, contours fins translucides,
  ombres brun chaud très légères. Le violet (réglable dans Paramètres > Affichage) reste la
  couleur d'accent ; les couleurs d'état et le mode daltonien sont inchangés.
- Typographie : Segoe UI Variable (Geist en secours), texte courant de 14 px, titres de page
  de 28 px semi-gras ; la taille du texte réglable agrandit tout comme avant.
- Formes : arrondis de 6 px (boutons, champs), 8 px (menus), 12 px (cartes, fenêtres).
- Menu posé sur le fond beige ; page active : fond gris léger, texte gras et petite barre
  violette à gauche. Contenu dans une zone blanche translucide arrondie en haut à gauche.
- Boutons « fantômes » blancs au bord bas plus foncé ; un seul bouton violet par zone.
  Champs : seul le bord bas devient violet au clic. Puces de 22 px pleinement arrondies.
- Bandeaux forts (connexion, indicateur vedette des tableaux de bord) : fond très sombre et
  courbes violettes ; dégradés retirés ailleurs.
- Sur ordinateur, boutons et champs de 34 px ; sur écran tactile, les cibles restent de
  44 px.

## 0.9.3 — 2026-10-21

### Modifié
- Menu : « Rentabilité » et « Reçus » n'y figurent plus. Les écrans restent accessibles
  par leur adresse (`/rentabilite`, `/recus`).

## 0.9.2 — 2026-10-21

Publication possible sur GitHub Pages (page blanche corrigée).

### Ajouté
- `.github/workflows/github-pages.yml` : construit le site et le publie sur GitHub Pages à
  chaque envoi sur `main` (mode démo), avec `404.html` pour que toutes les adresses
  (`/clients`, `/q/…`…) ouvrent l'application.

### Modifié
- L'application peut vivre dans un sous-dossier (`https://<compte>.github.io/<dépôt>/`) :
  variable `CHEMIN_BASE` au moment de la construction (`base` de Vite, `basename` du routeur).
  Les liens envoyés aux clients (questionnaire, document, reçu) incluent ce sous-dossier.

## 0.9.1 — 2026-10-04

Projet plus facile à reprendre par un agent (Codex, Claude) ou un humain ; aucun changement
de comportement.

### Documentation
- `AGENTS.md` réécrit : le projet en une minute, commandes, ce que « terminé » veut dire
  (check-list), carte du code, **index fonctionnalité → fichiers** (base, logique, écrans,
  tests), règles numérotées avec leur raison, **lexique français → anglais** des termes du code,
  recettes, pièges connus.
- Nouveaux guides par dossier : `src/domaine/AGENTS.md` (fichier par fichier, miroirs SQL et
  tests), `src/donnees/AGENTS.md` (contrat, miroir démo, ajouter une opération),
  `tests/AGENTS.md`, `e2e/AGENTS.md` (conventions, ce que les tests supposent du jeu de démo).
- `src/AGENTS.md` réorganisé (écrans → fichiers → composants) ; `supabase/AGENTS.md` : table
  des migrations et **migration qui contient la version actuelle de chaque fonction**, modèle
  de nouvelle table.
- `docs/CAHIER_DES_CHARGES.md` : demande d'origine reliée au code, décisions prises avec
  l'utilisateur, questions ouvertes.
- Un commentaire d'en-tête (rôle du fichier) dans chaque fichier source et de test ; sommaire
  en tête de `demo.ts` et `jeuDemo.ts`.

### Modifié
- `pages/Taches.tsx` (1 180 lignes) découpé : cartes dans `composants/CartesTaches.tsx`,
  « Mes tâches » dans `composants/MesTaches.tsx`, lecture d'un questionnaire dans
  `composants/LectureQuestionnaire.tsx`, libellés de récurrence dans `config/taches.ts`.
- Nouveaux scripts : `npm run verifier:complet` (vérification + tests de bout en bout) et
  `npm run test:sql`.

## 0.9.0 — 2026-10-04

Les quatre prolongements de la 0.8.0 (docs/IDEES.md).

### Ajouté
- **Rappel d'un exercice non rendu** : un exercice à compléter remis par lien, toujours sans
  réponse après 7 jours (réglable dans Paramètres > Relances, 0 pour jamais), fait apparaître
  la tâche « Rappeler l'exercice à … » (filtre « Exercices »). « Préparer le rappel » crée un
  nouveau lien (l'ancien ne marche plus) et un message prêt à envoyer depuis la messagerie ;
  le rappel est noté, la tâche disparaît.
- **Exercices rendus sur la fiche de séance** : en tête de la séance, les exercices rendus
  par le client depuis la séance précédente, questions et réponses, pour les reprendre
  ensemble (ils comptent alors comme lus).
- **Reçu groupé** : dans « Séances sans reçu », cocher plusieurs séances d'un même client
  (les autres clients sont grisés) puis « Émettre un reçu groupé » : un seul reçu, une ligne
  par séance, total, même numérotation. Une séance ne figure que sur un seul reçu valide ;
  annuler un reçu groupé libère ses séances. La liste affiche « n séances ».
- **Livre des recettes** sur toutes les années (CSV) : reçus valides dans l'ordre
  chronologique (date, numéro, client, nature, règlement, montant), puis totaux par
  trimestre et total général ; récapitulatif de l'année avec ses quatre trimestres.

### Base de données
- Migration `20261007090000_rappels_recus_groupes.sql` : réglage `exercice_rappel_jours` ;
  colonnes `nb_questions` (calculée) et `rappel_le` sur `remises`, fonction
  `relancer_remise` ; table `recus_lignes` (lignes des reçus, remplie pour les reçus
  existants, une séance sur un seul reçu valide), fonction `emettre_recu_groupe`,
  `emettre_recu` / `annuler_recu` / `recu_public` mises à jour.

## 0.8.0 — 2026-10-04

Les cinq prolongements de la 0.7.0 (docs/IDEES.md).

### Ajouté
- **Reçu envoyé au client par lien personnel** (« Envoyer » dans la liste des reçus ou sur la
  version à imprimer) : 90 jours, sans compte, le client l'imprime ou l'enregistre en PDF
  (page `/r/…`). Message prêt pour la messagerie ou les SMS ; la liste indique « lien
  ouvert le … ». Un nouveau lien remplace l'ancien ; un reçu annulé n'en reçoit plus, et un
  lien déjà envoyé montre le tampon d'annulation.
- **Récapitulatif annuel des reçus** : montants et nombre de reçus valides par mois et par
  mode de règlement, et **export pour le tableur** (CSV « à la française » : « ; », virgule
  décimale, dates JJ/MM/AAAA, accents reconnus par Excel, annulés compris et marqués).
- **Exercice à compléter** : dans un document, une ligne commençant par « ? » est une
  question. Le client répond depuis son lien (une seule fois, réponses facultatives sauf au
  moins une) ; nouvelle tâche « Exercice complété par … » (filtre « Exercices ») ; réponses
  lisibles depuis la tâche, la page Exercices et la fiche client. Le modèle « Journal des
  émotions » devient un exercice à compléter.
- **Tâches récurrentes** (« Répéter : chaque semaine / chaque mois ») : cochée, la tâche
  programme la suivante (première date de la série après aujourd'hui, fin de mois
  respectée) ; décochée, la suivante est retirée.
- **Créneaux selon les habitudes du client** : « Proposer des créneaux libres » commence par
  les jours et heures où le client vient régulièrement (au moins deux fois sur l'année
  écoulée), signalés « (votre créneau habituel) ».

### Base de données
- Migration `20261006090000_prolongements.sql` : colonnes de lien sur `recus`, fonctions
  `preparer_lien_recu` et `recu_public` (ouverte sans compte) ; réponses sur `remises`,
  fonctions `questions_document` et `repondre_document` (ouverte sans compte),
  `document_public` indique si le client a déjà répondu ; `recurrence` et `precedente` sur
  `taches_perso`, fonction `echeance_suivante` et déclencheur `tache_recurrente`.

## 0.7.0 — 2026-10-03

### Ajouté
- **Journal** (menu « Journal ») : notes de travail privées, libres ou liées à un client
  (supervision, idées, points à reprendre), épinglables, avec recherche et filtres
  (épinglées, notes libres, par client). Sur la fiche client : ses notes et « Ajouter ».
- **Exercices et documents** (menu « Exercices et documents ») : bibliothèque personnelle
  (exercice, fiche pratique, lecture, autre) avec quatre modèles proposés (respiration
  carrée, journal des émotions, ancrage 5-4-3-2-1, lettre que l'on n'envoie pas) ; mise en
  forme simple (« # » intertitre, « - » liste) avec aperçu. **Remise à un client** par lien
  personnel (90 jours, sans compte, message prêt pour la messagerie ou les SMS) ou **sur
  papier** (version à imprimer / PDF). Le client reçoit une copie figée ; la liste indique
  s'il a ouvert son lien ; « Retirer » désactive le lien. Carte « Exercices remis » sur la fiche.
- **Activité** (menu « Activité ») : heures de consultation par semaine (ou par mois sur
  12 mois), rendez-vous tenus, taux d'absence et d'annulation, répartition par type et par
  modalité, **créneaux les plus demandés** (jour × heure, nombre écrit dans chaque case).
- **Reçus** (notes d'honoraires, menu « Reçus » si le suivi des tarifs est actif) : émis
  depuis une séance tarifée (mode de règlement, date), **numérotés par année sans trou ni
  doublon** (2026-0001…), coordonnées recopiées à l'émission, version à imprimer / PDF.
  Un reçu ne se modifie ni ne s'efface : il s'**annule avec un motif** (il reste visible,
  barré). Aucun paiement en ligne. Profil : adresse professionnelle, SIRET, mention en bas
  du reçu (« TVA non applicable, article 293 B du CGI. » par défaut).
- **Tâches** :
  - **Mes tâches** : tâches personnelles avec échéance facultative et client facultatif,
    cochées une fois faites (liste « À venir » et « Faites ces 7 derniers jours ») ;
  - **« Plus tard »** sur toute tâche : demain, dans 3 jours, dans une semaine (une tâche
    personnelle change d'échéance ; les autres passent dans « Reportées », avec « Remettre
    maintenant ») ;
  - **filtres avec compteurs** : Tout, Questionnaires, Relances, Rendez-vous, Mes tâches,
    Reportées (pictogramme + libellé + nombre) ;
  - **« Votre semaine »** : rendez-vous par type, relances prévues, questionnaires en
    attente, tâches à échéance ; ouvert d'office le lundi.
- **Relance : « Proposer des créneaux libres »** : ajoute au message quelques créneaux des
  deux prochaines semaines, tirés de l'emploi du temps (un le matin, un l'après-midi par jour),
  avant la formule de politesse.
- Mode démonstration : un an d'historique d'emploi du temps (vacances d'août comprises),
  notes, documents remis, reçus (dont un annulé), tâches personnelles.

### Modifié
- Le bouton « Reporter » d'une relance est remplacé par « Plus tard » (commun à toutes les
  tâches).
- Graphique en colonnes générique (`Colonnes`) ; infobulles des colonnes du bord gardées à
  l'écran.

### Base de données
- Migration `20261005090000_journal_exercices_recus.sql` : tables `notes`, `documents`,
  `remises`, `recus`, `taches_perso`, `reports_taches` (propriétaire uniquement + double
  authentification) ; vues `journal`, `mes_taches`, `remises_actives` (sans la corbeille) ;
  fonctions `preparer_remise`, `document_public` (seule ouverte sans compte), `emettre_recu`
  (verrou par thérapeute et par année), `annuler_recu` ; colonnes `adresse_pro`, `siret`,
  `mention_recu` dans `parametres`.

## 0.6.0 — 2026-10-03

### Ajouté
- **Emploi du temps** (menu « Emploi du temps ») : vue semaine (ordinateur, tablette) et vue
  jour (téléphone, avec la bande des jours), navigation semaine par semaine, clic sur un
  créneau libre pour planifier, rendez-vous qui se chevauchent placés côte à côte, ligne de
  l'heure actuelle, légende cliquable pour masquer un type.
- **Cinq types de rendez-vous colorés** : premier rendez-vous, séance de suivi, bilan,
  administratif, personnel / indisponible ; statuts prévu, honoré, absent, annulé ;
  modalité (cabinet, visio, téléphone, domicile) ; répétition chaque semaine ; note privée.
- **Lisible par les personnes daltoniennes** : couleurs d'origine vérifiées par simulation
  (distinctes sous les trois daltonismes), et jamais seules : pictogramme et nom du type,
  motif propre (barre double, barre épaisse, pointillés, hachures), statut par pictogramme,
  annulé barré, description complète lue par les lecteurs d'écran.
- **Couleurs personnalisables** (Paramètres > Emploi du temps) avec vérification en direct
  (« Séance et Bilan se confondent en cas de daltonisme vert ») et **aperçu simulé** tel que
  le voit une personne protanope, deutéranope ou tritanope.
- Réglages : heures et jours de travail, durée par défaut, message de rappel.
- **Tâches** : section « Aujourd'hui » (rendez-vous du jour) ; **rappel de rendez-vous** à
  envoyer pour les 48 h à venir (préparé, envoyé depuis la messagerie) ; **rendez-vous passé à
  compléter** (« Séance faite : remplir la fiche », absent, annulé).
- Fiche client : prochains rendez-vous et bouton « Planifier » ; depuis un rendez-vous,
  « Commencer la séance » crée la fiche de séance datée du jour du rendez-vous.
- Tableau de bord : nombre de rendez-vous du jour dans le bandeau ; page d'ouverture
  « Emploi du temps » possible.

### Modifié
- `StatutEnvoi` déplacé dans `src/composants/` (un composant n'importe plus une page).

## 0.5.0 — 2026-10-03

### Ajouté
- **Enregistrement automatique de la fiche de séance** (3 s après la dernière saisie, et dès
  que l'application passe en arrière-plan) : une déconnexion pour inactivité ne fait plus
  perdre de notes.
- **Corbeille des clients** : un client supprimé reste restaurable 30 jours (page Mes clients
  > Corbeille), puis est effacé définitivement. Il disparaît aussitôt des listes, tâches,
  statistiques et liens de questionnaire.
- **Accord du client pour être recontacté** (RGPD) : case sur la fiche et à la création ;
  une relance sans accord noté est signalée dans les Tâches, avec un bouton pour le noter.
- **« Rester connecté(e) 8 h sur cet appareil »** à la connexion (appareil personnel) ; le
  délai d'inactivité s'applique aussi après réouverture et entre onglets.
- **Période sur le tableau de bord** : 3 derniers mois, 12 derniers mois, depuis le début.
  L'espace de groupe reste sur tout l'historique (anonymat).
- **Plafond quotidien d'appels Gemini pour toute la plateforme** (300 par défaut,
  `npm run comptes -- quota-ia <n>`), en plus du quota de chaque thérapeute.
- Paramètres sur téléphone : liste déroulante des rubriques.
- Liste de mots de détresse plus complète (insensible aux accents et apostrophes), avec un
  rappel que le repérage automatique ne remplace pas la lecture.
- Outillage : vérification du code (`npm run lint`, oxlint), mise en forme (`npm run format`,
  Prettier), tests de bout en bout dans un vrai navigateur (`npm run test:e2e`, Playwright),
  intégration continue GitHub Actions (`.github/workflows/verifier.yml`).

### Modifié
- **Lien du questionnaire actif seulement une fois sorti de l'application** (messagerie
  ouverte, message copié) ; une réponse du client confirme l'envoi si « J'ai envoyé le
  message » avait été oublié.
- Fonction IA fermée aux autres sites : `ORIGINE_AUTORISEE` est désormais requis en
  production (sans lui, seul le développement local est accepté).
- Écrans déjà visités affichés immédiatement puis mis à jour (cache en mémoire, vidé à la
  déconnexion).
- Application plus légère : la version de production ne charge plus le jeu de données de
  démonstration (et la démonstration ne charge plus supabase-js).
- La déconnexion ne ferme plus les sessions ouvertes sur les autres appareils.

### Corrigé
- Fermer la fenêtre d'envoi après avoir ouvert la messagerie ou copié le message supprimait
  le lien : le client tombait sur « Lien introuvable ». L'application demande maintenant si
  le message est parti.
- Échap fermait certaines boîtes de dialogue sans passer par leur logique de fermeture.

## 0.4.0 — 2026-10-03

### Ajouté
- **Mode daltonien** (Paramètres > Affichage) : palettes rouge-vert et bleu-jaune pour
  les états (succès, attente, alerte), vérifiées par simulation ; les états portent
  aussi un pictogramme et un libellé.
- **Affichage** : taille du texte, densité compacte, réduction des animations, page
  d'ouverture après connexion. Impression propre des fiches (sans menus ni boutons).
- **Mon profil** : photo, spécialité, téléphone professionnel, signature des messages
  (variable `{signature}`) ; raccourci vers le profil depuis le menu.
- **Questionnaires** : plusieurs questionnaires (créer, dupliquer, supprimer, choisir
  celui par défaut ou un autre à l'envoi), titre, introduction, message de
  remerciement ; 7 types de questions (curseur à bornes réglables, étoiles de 3 à 10,
  choix unique, choix multiples, oui/non, émotions, texte) ; texte d'aide, réponse
  obligatoire ou facultative ; bibliothèque de questions prêtes ; aperçu en direct ;
  avertissement en cas de modifications non enregistrées.
- **IA dans les Tâches** : chaque questionnaire reçu est lu automatiquement, sans IA
  (tendance, priorité, faits marquants, suggestion) ; bouton « Lecture IA » à la
  demande ; quota quotidien d'appels Gemini par thérapeute (Paramètres > Assistant IA).
  Tout fonctionne sans clé Gemini.
- Tâches prioritaires (dégradation, score très bas, mots de détresse) en tête de liste ;
  résumé du jour sur le tableau de bord.
- Fichiers de reprise : `AGENTS.md` (racine, `src/`, `supabase/`), `docs/IDEES.md`,
  `scripts/comptes.mjs` (création et réinitialisation des comptes par l'administrateur),
  `.editorconfig`, `.nvmrc`, script `npm run verifier`.

### Retiré
- Création de compte et « mot de passe oublié » : les comptes sont gérés par
  l'administrateur (`npm run comptes`).

### Corrigé
- « Aujourd'hui » était calculé en heure UTC : faux entre minuit et 2 h en France.
- Questionnaire client : un curseur jamais touché était enregistré à 5 ; la question à
  reprendre est désormais signalée à son emplacement.
- Le formulaire « Nouveau client » gardait la saisie d'une création annulée.
- Historique des envois limité aux 60 derniers sans moyen de voir la suite.
- Écran blanc pendant le chargement des paramètres.
- Session Supabase conservée après fermeture du navigateur ; connexion possible par un
  lien de récupération reçu par courriel.
- La reconnexion perdait l'onglet demandé (ex. `/parametres?onglet=affichage`).
- Les boîtes de dialogue longues s'ouvraient défilées en bas.
- Préférences d'affichage : seules ces préférences sont mémorisées sur l'appareil
  (auparavant, tous les paramètres l'étaient, dont la signature).

## 0.3.0 — 2026-10-01

- Utilisation tactile (tablette, téléphone), graphiques d'évolution.
- Relances manuelles 15 jours après la dernière séance, avec lien personnel vers un
  questionnaire ; onglet Tâches ; historique des envois.
- Paramètres : relances et modèles de messages, questions du questionnaire, couleurs
  et nom du site, tarifs (facultatifs, par séance) et page Rentabilité.
- Sécurité : double authentification (TOTP), déconnexion après inactivité, journal des
  connexions.

## 0.2.0 — 2026-09-30

- Fiche de séance au format exact de la fiche papier (cases d'émotions par zone).

## 0.1.0 — 2026-09-30

- Maquette : architecture, schéma Supabase avec sécurité au niveau des lignes,
  tableau de bord personnel, espace de groupe anonymisé, fiches clients, parcours
  3 séances + bilan, catégorisation et synthèse par Gemini, mode démonstration.

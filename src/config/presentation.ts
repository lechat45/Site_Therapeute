// Présentation du site (0.12.0) : une diapositive par partie, ouverte par le bouton
// « Découvrir le site » (connexion) ou « Présentation du site » (menu). Le contenu est
// ici, séparé de l'affichage (composants/Presentation.tsx) : le tenir à jour quand une
// partie change. Les parties masquées (config/fonctions.ts) ne sont pas présentées.

import type { NomIcone } from '../composants/Icone';

export interface Diapositive {
  cle: string;
  titre: string;
  /** Une phrase qui dit à quoi sert la partie. */
  resume: string;
  icone: NomIcone;
  /** Ce qu'on y trouve et ce qu'on y fait, en détail. */
  points: string[];
  /** Écran à ouvrir (« Ouvrir cet écran ») ; absent pour une diapositive générale. */
  ecran?: string;
  /** Partie masquable : présentée seulement si elle est affichée. */
  partie?: 'exercices' | 'argent';
}

export const DIAPOSITIVES: Diapositive[] = [
  {
    cle: 'bienvenue',
    titre: 'Bienvenue',
    resume: 'Un seul endroit pour suivre vos clients, vos séances et votre agenda.',
    icone: 'etoile',
    points: [
      'Pensé pour les thérapeutes comportementalistes émotionnels : parcours de 3 séances, un bilan, puis des séances à l’unité.',
      'Chaque fiche client est strictement privée : vous seul(e) y avez accès.',
      'L’application prépare le travail (relances, rappels, questionnaires) ; vous gardez la main sur tout ce qui part.',
      'Utilisable sur ordinateur, tablette et téléphone.',
      'Cette présentation fait le tour du site, partie par partie : avancez avec « Suivant » ou les flèches du clavier.',
    ],
  },
  {
    cle: 'accueil',
    titre: 'Le tableau de bord',
    resume: 'La page d’accueil : votre journée en un coup d’œil, puis vos statistiques.',
    icone: 'tableau',
    ecran: '/',
    points: [
      'En haut, le bandeau d’accueil : la date, les rendez-vous du jour, les tâches à faire et les questionnaires reçus.',
      'Un bouton mène directement aux tâches, un autre à l’emploi du temps.',
      'Vos chiffres clés : séances par client, clients suivis, durée moyenne du suivi, part des parcours menés jusqu’au bilan.',
      'Les émotions les plus présentes, les problématiques les plus fréquentes, les séances par mois et les émotions par tranche d’âge.',
      'Choisissez la période : 3 derniers mois, 12 derniers mois ou depuis le début.',
    ],
  },
  {
    cle: 'clients',
    titre: 'Mes clients',
    resume: 'La liste de vos clients, pour retrouver une fiche en quelques secondes.',
    icone: 'clients',
    ecran: '/clients',
    points: [
      'Recherche par nom ou prénom, filtre par problématique, tri par séance la plus récente ou par ordre alphabétique.',
      'Quatre chiffres en tête : vos clients, ceux en parcours initial, ceux qui ont fait le bilan, ceux sans séance.',
      'Pour chacun : âge, avancement du parcours (barrettes, le bilan en losange), dernière séance, problématiques.',
      '« Nouveau client » crée une fiche ; une fiche supprimée reste 30 jours dans la corbeille et peut être restaurée.',
    ],
  },
  {
    cle: 'fiche-client',
    titre: 'La fiche d’un client',
    resume: 'Tout sur un client, rangé en quatre onglets.',
    icone: 'utilisateur',
    ecran: '/clients',
    points: [
      'Le bandeau : nom, âge, coordonnées, barre de progression du parcours et son étape écrite en toutes lettres.',
      'Un bouton propose la suite logique : démarrer la séance 1, la séance suivante, le bilan, puis une séance à l’unité.',
      '« Vue d’ensemble » : le parcours, le prochain rendez-vous (« Planifier »), la synthèse évolutive et les problématiques.',
      '« Séances » : l’historique et l’évolution (réponses au questionnaire de suivi, émotions séance après séance).',
      '« Relances et questionnaires » : relancer ou non, accord du client, envois et réponses. « Notes » : vos notes sur ce client.',
    ],
  },
  {
    cle: 'seance',
    titre: 'La fiche de séance',
    resume: 'La copie numérique de votre fiche papier.',
    icone: 'document',
    ecran: '/clients',
    points: [
      'Les mêmes cases que sur le papier : émotions au temps présent, générations, naissance et conception, objectif, notes.',
      'Les 14 émotions se choisissent dans une liste ; rien n’est à retaper d’une séance à l’autre.',
      'L’enregistrement est automatique pendant que vous écrivez.',
      'Les séances sont numérotées toutes seules : 3 séances initiales, le bilan (4e), puis des séances à l’unité.',
    ],
  },
  {
    cle: 'agenda',
    titre: 'L’emploi du temps',
    resume: 'Vos rendez-vous à la semaine ou au jour, et un rendez-vous pris en trois questions.',
    icone: 'calendrier',
    ecran: '/emploi-du-temps',
    points: [
      'Chaque type de rendez-vous a sa couleur, son pictogramme et son motif : lisible aussi pour les personnes daltoniennes.',
      'Cliquez sur un créneau libre, ou sur « Nouveau rendez-vous » : avec qui ? quand ? où ?',
      'Les prochains créneaux libres sont proposés en un clic, d’abord aux jour et heure habituels du client.',
      'Un rendez-vous peut se répéter chaque semaine ; une phrase récapitule tout avant d’enregistrer.',
      'Depuis un rendez-vous : préparer un rappel par e-mail ou SMS, commencer la séance, noter une absence ou une annulation.',
    ],
  },
  {
    cle: 'taches',
    titre: 'Les tâches',
    resume: 'Ce que l’application vous propose de faire aujourd’hui, sans rien oublier.',
    icone: 'taches',
    ecran: '/taches',
    points: [
      'Calculées toutes seules : rendez-vous passés à compléter, rappels à envoyer, relances, questionnaires reçus.',
      'Vos propres tâches aussi, avec une échéance et, si besoin, une répétition chaque semaine ou chaque mois.',
      '« Plus tard » : une tâche disparaît et revient le jour choisi (demain, dans 3 jours, dans une semaine).',
      'Des filtres par famille, le résumé de votre semaine et l’historique des messages envoyés.',
      'Le nombre de tâches s’affiche dans le menu, à côté de « Tâches ».',
    ],
  },
  {
    cle: 'relances',
    titre: 'Relances et questionnaires',
    resume: 'Garder le lien après la dernière séance, sans y penser.',
    icone: 'envoyer',
    ecran: '/parametres?onglet=relances',
    points: [
      'Une relance est proposée après la dernière séance : au bout de 15 jours, puis tous les 30 jours, 3 fois au plus (réglable).',
      'Le message contient un lien personnel vers un questionnaire court ; le client répond sans compte, en une minute.',
      'Les réponses arrivent dans les tâches, avec une lecture qui compare au questionnaire précédent et signale ce qui compte.',
      'Rien ne part tout seul : l’application prépare l’e-mail ou le SMS, vous l’envoyez depuis votre propre messagerie.',
      'Les questions se modifient dans Paramètres › Questionnaires (7 types de questions, plusieurs questionnaires possibles).',
    ],
  },
  {
    cle: 'exercices',
    titre: 'Exercices et documents',
    resume: 'Votre bibliothèque de documents à remettre aux clients.',
    icone: 'document',
    ecran: '/exercices',
    partie: 'exercices',
    points: [
      'Des modèles prêts à l’emploi, modifiables, et vos propres documents.',
      'Remis par lien personnel (sans compte) ou sur papier ; un exercice peut contenir des questions auxquelles le client répond.',
      'Les réponses arrivent dans les tâches et en tête de la fiche de séance suivante ; un rappel est proposé s’il n’a pas répondu.',
    ],
  },
  {
    cle: 'journal',
    titre: 'Le journal',
    resume: 'Vos notes de travail, libres ou liées à un client.',
    icone: 'livre',
    ecran: '/journal',
    points: [
      'Supervision, idées, lectures, points à reprendre : tout ce qui n’a pas sa place sur une fiche de séance.',
      'Une note peut être liée à un client : elle apparaît alors aussi dans l’onglet « Notes » de sa fiche.',
      'Épinglez les notes importantes ; recherchez dans toutes vos notes.',
    ],
  },
  {
    cle: 'activite',
    titre: 'L’activité',
    resume: 'Ce que dit votre emploi du temps sur votre pratique.',
    icone: 'activite',
    ecran: '/activite',
    points: [
      'Heures de consultation, rendez-vous tenus, taux d’absence et d’annulation, sur 4 semaines, 12 semaines ou 12 mois.',
      'Les heures par semaine, la répartition par type et par lieu (cabinet, visio, téléphone, domicile).',
      'Les créneaux les plus demandés, jour par jour et heure par heure.',
    ],
  },
  {
    cle: 'budget',
    titre: 'Tarifs, rentabilité et reçus',
    resume: 'Le suivi de vos honoraires, facultatif.',
    icone: 'euro',
    ecran: '/parametres?onglet=tarifs',
    partie: 'argent',
    points: [
      'Un tarif par défaut, un tarif propre à un client, et le tarif de chaque séance si besoin.',
      'La rentabilité : chiffre d’affaires par mois, par client et par type de séance.',
      'Des reçus (notes d’honoraires) numérotés, pour une séance ou plusieurs ; annulables avec un motif, jamais effacés.',
      'Export du livre des recettes pour votre comptabilité. Aucun paiement en ligne.',
      'Rentabilité et reçus s’ouvrent depuis Paramètres › Tarifs.',
    ],
  },
  {
    cle: 'groupe',
    titre: 'L’espace de groupe',
    resume: 'Les statistiques de tous les thérapeutes, sans rien de personnel.',
    icone: 'groupe',
    ecran: '/groupe',
    points: [
      'Les mêmes indicateurs que votre tableau de bord, agrégés anonymement sur l’ensemble de la plateforme.',
      'Aucun nom, aucune note : seulement des totaux, publiés seulement quand assez de clients d’autres thérapeutes y contribuent.',
      'Des repères (émotion la plus présente, motif le plus fréquent…) et une comparaison « Vous et le groupe ».',
      'Vos chiffres ne servent qu’à cette comparaison, sur votre écran : rien n’est envoyé au groupe.',
    ],
  },
  {
    cle: 'ia',
    titre: 'L’assistant IA (facultatif)',
    resume: 'Une aide à la lecture, jamais un diagnostic.',
    icone: 'etincelles',
    ecran: '/parametres?onglet=ia',
    points: [
      'Sur une fiche de séance, « Analyser » propose des problématiques et met à jour la synthèse évolutive du client.',
      'Il ne travaille que quand vous cliquez ; le nom et le prénom du client sont retirés avant l’envoi.',
      'Un nombre d’analyses par jour, réglable ; tout fonctionne aussi sans IA, avec une lecture locale.',
      'Ses suggestions sont à valider par vous.',
    ],
  },
  {
    cle: 'parametres',
    titre: 'Paramètres et confort',
    resume: 'Tout se règle pour vous seul(e).',
    icone: 'reglages',
    ecran: '/parametres',
    points: [
      'Votre profil, votre signature, le nom et la couleur du site.',
      'Le confort de lecture : vision des couleurs (deux modes daltoniens), taille du texte, densité, animations réduites.',
      'Vos heures et jours de travail, les couleurs de l’agenda, la durée habituelle d’un rendez-vous.',
      'Les relances, les modèles de messages et vos questionnaires.',
    ],
  },
  {
    cle: 'securite',
    titre: 'Confidentialité et sécurité',
    resume: 'Des données de santé, protégées comme il se doit.',
    icone: 'bouclier',
    ecran: '/parametres?onglet=securite',
    points: [
      'Chaque fiche n’est lisible que par son thérapeute, contrôlé par la base de données elle-même.',
      'Pas d’inscription libre : les comptes sont créés par l’administrateur.',
      'Double authentification possible (application d’authentification) et déconnexion automatique après inactivité.',
      'Les liens envoyés aux clients sont personnels, à durée limitée, et ne donnent accès qu’à leur questionnaire ou document.',
      'RGPD : le consentement de chaque client se note sur sa fiche (une alerte le rappelle) ; « Exporter ses données » et « Supprimer » répondent à ses droits.',
      'Les fiches inactives depuis 5 ans vous sont proposées à l’effacement ; une politique de confidentialité est lisible par tous.',
    ],
  },
  {
    cle: 'demarrer',
    titre: 'Pour bien démarrer',
    resume: 'Quatre étapes, et vous êtes prêt(e).',
    icone: 'valider',
    points: [
      '1. Paramètres › Mon profil : votre nom, votre spécialité et votre signature.',
      '2. Paramètres › Emploi du temps : vos jours et heures de travail.',
      '3. Mes clients › Nouveau client, puis « Planifier » son premier rendez-vous.',
      '4. Chaque jour, un coup d’œil au tableau de bord et aux tâches.',
      'Vous pouvez revoir cette présentation à tout moment depuis le menu.',
    ],
  },
];

/** Diapositives à montrer, sans les parties masquées. */
export function diapositivesVisibles(visibles: { exercices: boolean; argent: boolean }): Diapositive[] {
  return DIAPOSITIVES.filter((d) => !d.partie || visibles[d.partie]);
}

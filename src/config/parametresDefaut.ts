// Valeurs par défaut d'un nouvel espace thérapeute — miroir des valeurs
// par défaut de la migration 20261001090000 (vérifié par tests/sql.test.ts).

import type { Parametres, Question, Questionnaire } from '../domaine/types';

export const PARAMETRES_PAR_DEFAUT: Parametres = {
  nom_site: 'Suivi thérapeutique',
  couleur: '#7436e6',
  taille_texte: 'normal',
  densite: 'confortable',
  vision: 'standard',
  reduire_animations: false,
  page_accueil: '/',
  specialite: '',
  telephone_pro: '',
  signature: '',
  photo: null,
  tarifs_actifs: true,
  prix_defaut: null,
  relances_actives: true,
  relance_delai_jours: 15,
  relance_intervalle_jours: 30,
  relance_max: 3,
  lien_validite_jours: 30,
  modele_email_objet: 'Des nouvelles depuis notre dernière séance',
  modele_email: [
    'Bonjour {prenom},',
    '',
    "Notre dernière séance remonte à quelques semaines et j'aimerais savoir comment vous allez.",
    '',
    'Si vous le souhaitez, ce court questionnaire (une minute) me permettra de suivre votre évolution :',
    '{lien}',
    '',
    "Ce lien est personnel et valable jusqu'au {expiration}.",
    '',
    "Au plaisir d'avoir de vos nouvelles,",
    '{signature}',
  ].join('\n'),
  modele_sms:
    "Bonjour {prenom}, comment allez-vous depuis notre dernière séance ? Un questionnaire d'une minute pour suivre votre évolution : {lien} — {therapeute}",
  deconnexion_minutes: 30,
  ia_taches: true,
  ia_quota_jour: 20,
  agenda_heure_debut: 8,
  agenda_heure_fin: 20,
  agenda_jours: [1, 2, 3, 4, 5],
  duree_rdv_minutes: 60,
  agenda_couleurs: {},
  modele_rappel:
    "Bonjour {prenom}, je vous rappelle notre rendez-vous du {date} à {heure} ({lieu}). En cas d'empêchement, merci de me prévenir. {signature}",
  adresse_pro: '',
  siret: '',
  mention_recu: 'TVA non applicable, article 293 B du CGI.',
  exercice_rappel_jours: 7,
};

type NouvelleQuestion = Omit<Question, 'id'>;

const question = (q: Partial<NouvelleQuestion> & Pick<NouvelleQuestion, 'libelle' | 'type'>): NouvelleQuestion => ({
  ordre: 0,
  aide: '',
  obligatoire: true,
  options: [],
  minimum: q.type === 'etoiles' ? 1 : 0,
  maximum: q.type === 'etoiles' ? 5 : 10,
  sens: 'haut',
  libelle_min: '',
  libelle_max: '',
  active: true,
  ...q,
});

/** Questionnaire proposé à la création du compte (modifiable). */
export const QUESTIONNAIRE_PAR_DEFAUT: Omit<Questionnaire, 'id' | 'questions'> & { questions: NouvelleQuestion[] } = {
  titre: 'Questionnaire de suivi',
  introduction: "Une minute suffit. Vos réponses ne sont transmises qu'à votre thérapeute.",
  remerciement: 'Merci ! Vos réponses ont bien été transmises.',
  par_defaut: true,
  ordre: 1,
  questions: [
    question({
      ordre: 1,
      libelle: 'Comment vous sentez-vous globalement depuis notre dernière séance ?',
      type: 'curseur',
      libelle_min: 'Très mal',
      libelle_max: 'Très bien',
    }),
    question({
      ordre: 2,
      libelle: "Quelle est aujourd'hui l'intensité de la difficulté qui vous a amené(e) à consulter ?",
      type: 'curseur',
      sens: 'bas',
      libelle_min: 'Disparue',
      libelle_max: 'Très forte',
    }),
    question({
      ordre: 3,
      libelle: 'Comment dormez-vous en ce moment ?',
      type: 'curseur',
      libelle_min: 'Très mal',
      libelle_max: 'Très bien',
    }),
    question({
      ordre: 4,
      libelle: 'Quelles émotions avez-vous le plus ressenties ces derniers jours ?',
      type: 'emotions',
      aide: 'Plusieurs choix possibles.',
      obligatoire: false,
    }),
    question({
      ordre: 5,
      libelle: "Quelle note donnez-vous à l'aide apportée par les séances ?",
      type: 'etoiles',
      obligatoire: false,
    }),
    question({ ordre: 6, libelle: 'Souhaitez-vous reprendre rendez-vous ?', type: 'oui_non', obligatoire: false }),
    question({
      ordre: 7,
      libelle: 'Souhaitez-vous ajouter quelque chose ?',
      type: 'texte',
      aide: 'Ce message ne sera lu que par votre thérapeute.',
      obligatoire: false,
    }),
  ],
};

/** Questions prêtes à l'emploi, proposées dans l'éditeur de questionnaire. */
export const BIBLIOTHEQUE_QUESTIONS: NouvelleQuestion[] = [
  question({
    libelle: "Comment vous sentez-vous aujourd'hui ?",
    type: 'curseur',
    libelle_min: 'Très mal',
    libelle_max: 'Très bien',
  }),
  question({
    libelle: 'Quel est votre niveau de stress en ce moment ?',
    type: 'curseur',
    sens: 'bas',
    libelle_min: 'Aucun',
    libelle_max: 'Très élevé',
  }),
  question({
    libelle: "Quel est votre niveau d'énergie ?",
    type: 'curseur',
    libelle_min: 'Épuisé(e)',
    libelle_max: "Plein(e) d'énergie",
  }),
  question({
    libelle: 'Comment dormez-vous en ce moment ?',
    type: 'curseur',
    libelle_min: 'Très mal',
    libelle_max: 'Très bien',
  }),
  question({
    libelle: "Avez-vous ressenti de l'anxiété ces derniers jours ?",
    type: 'curseur',
    sens: 'bas',
    libelle_min: 'Pas du tout',
    libelle_max: 'Énormément',
  }),
  question({
    libelle: 'Quelles émotions avez-vous le plus ressenties ?',
    type: 'emotions',
    aide: 'Plusieurs choix possibles.',
    obligatoire: false,
  }),
  question({
    libelle: 'Depuis le début du suivi, diriez-vous que la situation…',
    type: 'choix_unique',
    options: ["s'est beaucoup améliorée", "s'est un peu améliorée", "n'a pas changé", "s'est dégradée"],
  }),
  question({
    libelle: 'Dans quels domaines avez-vous constaté des changements ?',
    type: 'choix_multiple',
    obligatoire: false,
    options: ['Sommeil', 'Relations', 'Travail ou études', 'Confiance en soi', 'Gestion des émotions'],
  }),
  question({
    libelle: 'Avez-vous pu mettre en pratique les exercices proposés ?',
    type: 'oui_non',
    obligatoire: false,
  }),
  question({ libelle: 'Souhaitez-vous reprendre rendez-vous ?', type: 'oui_non', obligatoire: false }),
  question({
    libelle: "Quelle note donnez-vous à l'aide apportée par les séances ?",
    type: 'etoiles',
    obligatoire: false,
  }),
  question({
    libelle: "Un événement marquant s'est-il produit depuis la dernière séance ?",
    type: 'texte',
    obligatoire: false,
  }),
];

/** Second questionnaire du jeu de démonstration. */
export const QUESTIONNAIRE_BILAN: Omit<Questionnaire, 'id' | 'questions'> & { questions: NouvelleQuestion[] } = {
  titre: 'Point avant le bilan',
  introduction: 'Quelques questions pour préparer ensemble la séance de bilan.',
  remerciement: 'Merci ! Nous en parlerons lors du bilan.',
  par_defaut: false,
  ordre: 2,
  questions: [
    BIBLIOTHEQUE_QUESTIONS[6],
    BIBLIOTHEQUE_QUESTIONS[7],
    BIBLIOTHEQUE_QUESTIONS[2],
    BIBLIOTHEQUE_QUESTIONS[8],
  ].map((q, i) => ({ ...q, ordre: i + 1 })),
};

/** Variables utilisables dans les modèles de messages. */
export const VARIABLES_MODELES: { cle: string; description: string }[] = [
  { cle: '{prenom}', description: 'prénom du client' },
  { cle: '{nom}', description: 'nom du client' },
  { cle: '{therapeute}', description: 'votre prénom et votre nom' },
  { cle: '{signature}', description: 'votre signature (Paramètres > Mon profil), sinon votre nom' },
  { cle: '{lien}', description: 'lien personnel vers le questionnaire' },
  { cle: '{expiration}', description: 'date de fin de validité du lien' },
  { cle: '{site}', description: 'nom du site' },
];

/** Variables du message de rappel de rendez-vous. */
export const VARIABLES_RAPPEL: { cle: string; description: string }[] = [
  { cle: '{prenom}', description: 'prénom du client' },
  { cle: '{nom}', description: 'nom du client' },
  { cle: '{date}', description: 'jour du rendez-vous (ex. mardi 6 octobre)' },
  { cle: '{heure}', description: 'heure du rendez-vous (ex. 14 h 30)' },
  { cle: '{lieu}', description: 'au cabinet, en visio, par téléphone, à domicile' },
  { cle: '{therapeute}', description: 'votre prénom et votre nom' },
  { cle: '{signature}', description: 'votre signature, sinon votre nom' },
];

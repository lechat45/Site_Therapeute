// RGPD (0.13.0) : réglages et informations affichés par l'application. À relire avec un
// juriste ou un DPO avant la mise en production (docs/RGPD.md). L'éditeur de la plateforme
// (sous-traitant des thérapeutes) remplit ÉDITEUR avant d'ouvrir le service.

/**
 * Durée de conservation proposée d'une fiche après la dernière séance (ou sa création s'il
 * n'y en a pas) : 5 ans, délai de prescription de droit commun (article 2224 du Code civil).
 * Passé ce délai, la fiche est proposée à l'effacement (Paramètres › Confidentialité) ;
 * rien n'est effacé sans l'accord du thérapeute.
 */
export const DUREE_CONSERVATION_ANS = 5;

/** Durée de conservation du journal des connexions (sécurité) : 12 mois. */
export const DUREE_JOURNAL_CONNEXIONS_MOIS = 12;

/**
 * Éditeur de la plateforme : affiché dans la politique de confidentialité. Les valeurs
 * « [à compléter] » le restent visiblement tant que l'administrateur ne les a pas remplies.
 */
export const EDITEUR = {
  nom: '[à compléter : nom ou raison sociale de l’éditeur]',
  adresse: '[à compléter : adresse]',
  contact: '[à compléter : adresse e-mail pour les questions de données personnelles]',
  hebergeur: '[à compléter : hébergeur certifié HDS et pays d’hébergement]',
};

/** Date de la dernière mise à jour de la politique de confidentialité. */
export const POLITIQUE_MISE_A_JOUR = '22 octobre 2026';

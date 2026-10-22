// Parties de l'application affichées ou masquées, en un seul endroit.
//
// À la demande de l'utilisateur (version 0.10.3), deux parties sont RETIRÉES DE
// L'INTERFACE, sans être supprimées : le code, les tables SQL, les données et les
// tests restent, pour pouvoir les rallumer en passant la constante à `true`.
// Ne pas les remettre sans lui (docs/CAHIER_DES_CHARGES.md, décisions).
//
// Les liens publics déjà envoyés aux clients (/d/<jeton> document, /r/<jeton> reçu)
// restent ouverts : un client qui a reçu un lien peut toujours l'ouvrir.

/**
 * Exercices et documents : écran « Exercices et documents » (menu et routes),
 * carte « Exercices remis » de la fiche client, exercices rendus sur la fiche de
 * séance, tâches « exercice complété » et « exercice à rappeler » (et leur filtre),
 * réglage du rappel d'exercice (Paramètres › Relances).
 */
export const EXERCICES_VISIBLES = false;

/**
 * Tout ce qui parle d'argent : tarifs (Paramètres › Tarifs, fiche client, fiche de
 * séance), écrans « Rentabilité » et « Reçus » (routes), coordonnées des reçus
 * (Paramètres › Mon profil). Revient à `parametres.tarifs_actifs` désactivé partout.
 */
export const ARGENT_VISIBLE = false;

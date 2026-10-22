// Parties de l'application affichées ou masquées, en un seul endroit.
//
// À la demande de l'utilisateur, une partie peut être RETIRÉE DE L'INTERFACE sans être
// supprimée : le code, les tables SQL, les données et les tests restent, et la constante
// la rallume. Historique : les deux parties masquées en 0.10.3 ; l'argent remis en 0.11.0.
// Ne changer ces valeurs qu'à sa demande (docs/CAHIER_DES_CHARGES.md, décisions).
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
export const ARGENT_VISIBLE = true;

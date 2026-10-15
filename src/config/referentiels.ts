// Référentiels métier — SOURCE UNIQUE pour le mode démo et pour la
// migration `supabase/migrations/20260930120100_referentiels.sql`.
// Le test `tests/sql.test.ts` échoue si les deux divergent.

import type { Lignee, Referentiel, TrancheAge, Problematique } from '../domaine/types';

// La structure des cases de la fiche papier est partagée avec la fonction Edge.
export * from '../../supabase/functions/_shared/fiche.ts';

/**
 * Les 14 émotions clés.
 * ⚠ LISTE PROVISOIRE — à remplacer par la liste officielle fournie par le
 * cabinet (garder les identifiants 1 à 14 pour ne pas casser les données).
 */
export const EMOTIONS: Referentiel[] = [
  { id: 1, libelle: 'Peur' },
  { id: 2, libelle: 'Colère' },
  { id: 3, libelle: 'Tristesse' },
  { id: 4, libelle: 'Joie' },
  { id: 5, libelle: 'Culpabilité' },
  { id: 6, libelle: 'Honte' },
  { id: 7, libelle: 'Abandon' },
  { id: 8, libelle: 'Rejet' },
  { id: 9, libelle: 'Injustice' },
  { id: 10, libelle: 'Trahison' },
  { id: 11, libelle: 'Humiliation' },
  { id: 12, libelle: 'Impuissance' },
  { id: 13, libelle: 'Dévalorisation' },
  { id: 14, libelle: 'Solitude' },
];

/** Problématiques / motifs de consultation (catégories proposées à l'IA). */
export const PROBLEMATIQUES: Problematique[] = [
  { id: 1, code: 'anxiete_stress', libelle: 'Anxiété, stress' },
  { id: 2, code: 'estime_de_soi', libelle: 'Confiance et estime de soi' },
  { id: 3, code: 'couple', libelle: 'Relations de couple' },
  { id: 4, code: 'famille', libelle: 'Relations familiales' },
  { id: 5, code: 'deuil_separation', libelle: 'Deuil, séparation' },
  { id: 6, code: 'sommeil', libelle: 'Troubles du sommeil' },
  { id: 7, code: 'phobies', libelle: 'Phobies, peurs' },
  { id: 8, code: 'dependances', libelle: 'Addictions, dépendances' },
  { id: 9, code: 'alimentation', libelle: 'Comportement alimentaire' },
  { id: 10, code: 'epuisement_professionnel', libelle: 'Épuisement professionnel' },
  { id: 11, code: 'colere_impulsivite', libelle: 'Colère, impulsivité' },
  { id: 12, code: 'traumatisme', libelle: 'Traumatisme, choc émotionnel' },
  { id: 13, code: 'parentalite', libelle: 'Parentalité' },
  { id: 14, code: 'scolarite', libelle: 'Difficultés scolaires' },
  { id: 15, code: 'autre', libelle: 'Autre' },
];

export const TRANCHES_AGE: TrancheAge[] = [
  { id: 1, libelle: 'Moins de 12 ans', age_min: 0, age_max: 11 },
  { id: 2, libelle: '12 – 17 ans', age_min: 12, age_max: 17 },
  { id: 3, libelle: '18 – 25 ans', age_min: 18, age_max: 25 },
  { id: 4, libelle: '26 – 35 ans', age_min: 26, age_max: 35 },
  { id: 5, libelle: '36 – 45 ans', age_min: 36, age_max: 45 },
  { id: 6, libelle: '46 – 55 ans', age_min: 46, age_max: 55 },
  { id: 7, libelle: '56 – 65 ans', age_min: 56, age_max: 65 },
  { id: 8, libelle: '66 ans et plus', age_min: 66, age_max: null },
];

export const LIGNEES: { valeur: Lignee; libelle: string }[] = [
  { valeur: 'pere', libelle: 'Père' },
  { valeur: 'mere', libelle: 'Mère' },
];

/** Structure du parcours : 3 séances initiales, puis le bilan. */
export const SEANCES_INITIALES = 3;
export const NUMERO_BILAN = SEANCES_INITIALES + 1;

/** Seuils d'anonymisation de l'espace de groupe (identiques à la fonction SQL). */
export const SEUIL_CLIENTS_PAR_CASE = 5;
export const SEUIL_THERAPEUTES = 3;

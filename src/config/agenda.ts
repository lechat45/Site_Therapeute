// Catégories de l'emploi du temps : couleur, pictogramme, motif et libellé.
// La couleur n'est JAMAIS le seul repère (daltonisme, impression en noir et
// blanc) : chaque rendez-vous affiche aussi son pictogramme et son libellé,
// et les créneaux personnels sont hachurés.
//
// Couleurs par défaut validées par simulation (voir domaine/couleurs.ts) :
// écart ≥ 15 en vision normale et ≥ 12,9 sous chacun des trois daltonismes
// (seuil de confusion : 8), contraste ≥ 3:1 sur blanc.

import type { NomIcone } from '../composants/Icone';
import { estCouleur } from '../domaine/couleurs';
import type { CategorieRdv, ModaliteRdv, Parametres, StatutRdv } from '../domaine/types';

export interface Categorie {
  cle: CategorieRdv;
  libelle: string;
  court: string;
  icone: NomIcone;
  couleur: string;
  /** Rendez-vous avec un client (séance possible). */
  avecClient: boolean;
}

export const CATEGORIES: Categorie[] = [
  {
    cle: 'premier',
    libelle: 'Premier rendez-vous',
    court: '1er RDV',
    icone: 'etoile',
    couleur: '#4a3aa7',
    avecClient: true,
  },
  {
    cle: 'seance',
    libelle: 'Séance de suivi',
    court: 'Séance',
    icone: 'utilisateur',
    couleur: '#3b82f6',
    avecClient: true,
  },
  { cle: 'bilan', libelle: 'Bilan', court: 'Bilan', icone: 'evolution', couleur: '#b42318', avecClient: true },
  {
    cle: 'administratif',
    libelle: 'Administratif',
    court: 'Admin.',
    icone: 'document',
    couleur: '#b58900',
    avecClient: false,
  },
  {
    cle: 'personnel',
    libelle: 'Personnel / indisponible',
    court: 'Perso.',
    icone: 'cadenas',
    couleur: '#6b7280',
    avecClient: false,
  },
];

export const categorie = (cle: CategorieRdv) => CATEGORIES.find((c) => c.cle === cle)!;

/** Couleurs proposées dans les réglages (toutes lisibles sur blanc). */
export const NUANCIER_AGENDA = [
  '#4a3aa7',
  '#3b82f6',
  '#b42318',
  '#b58900',
  '#6b7280',
  '#0f766e',
  '#c2410c',
  '#9b2c8a',
  '#15803d',
  '#1f2937',
];

/** Couleur effective d'une catégorie : choix du thérapeute s'il est valide, sinon la couleur par défaut. */
export function couleursAgenda(p: Pick<Parametres, 'agenda_couleurs'>): Record<CategorieRdv, string> {
  return Object.fromEntries(
    CATEGORIES.map((c) => {
      const choisie = p.agenda_couleurs?.[c.cle];
      return [c.cle, choisie && estCouleur(choisie) ? choisie : c.couleur];
    }),
  ) as Record<CategorieRdv, string>;
}

export const STATUTS: Record<StatutRdv, { libelle: string; icone: NomIcone | null }> = {
  prevu: { libelle: 'Prévu', icone: null },
  honore: { libelle: 'Honoré', icone: 'valider' },
  absent: { libelle: 'Absent', icone: 'info' },
  annule: { libelle: 'Annulé', icone: 'croix' },
};

export const MODALITES: Record<ModaliteRdv, { libelle: string; lieu: string }> = {
  cabinet: { libelle: 'Au cabinet', lieu: 'au cabinet' },
  visio: { libelle: 'En visio', lieu: 'en visio' },
  telephone: { libelle: 'Par téléphone', lieu: 'par téléphone' },
  domicile: { libelle: 'À domicile', lieu: 'à domicile' },
};

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

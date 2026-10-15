// Récapitulatif annuel des reçus et export pour le tableur (comptabilité,
// livre des recettes). Seuls les reçus valides comptent dans les totaux ;
// l'export liste aussi les annulés, marqués comme tels.

import { MODES_REGLEMENT } from '../config/ressources';
import { numeroRecu } from './texte';
import type { ModeReglement, Recu } from './types';

export interface RecapAnnuel {
  annee: number;
  nb: number;
  nbAnnules: number;
  total: number;
  /** Douze mois, janvier en premier (mois de la date du reçu). */
  parMois: { mois: number; nb: number; total: number }[];
  /** Modes de règlement utilisés, du plus important au moins important. */
  parMode: { mode: ModeReglement; nb: number; total: number }[];
}

/** Sommes au centime près, sans erreurs d'arrondi des nombres à virgule. */
const centimes = (x: number) => Math.round(x * 100);

export function recapAnnuel(recus: Recu[], annee: number): RecapAnnuel {
  const del = recus.filter((r) => r.annee === annee);
  const valides = del.filter((r) => !r.annule_le);
  const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, nb: 0, c: 0 }));
  const modes = new Map<ModeReglement, { nb: number; c: number }>();
  for (const r of valides) {
    const m = parMois[Number(r.date_emission.slice(5, 7)) - 1];
    m.nb++;
    m.c += centimes(r.montant);
    const x = modes.get(r.mode_reglement) ?? { nb: 0, c: 0 };
    x.nb++;
    x.c += centimes(r.montant);
    modes.set(r.mode_reglement, x);
  }
  return {
    annee,
    nb: valides.length,
    nbAnnules: del.length - valides.length,
    total: valides.reduce((s, r) => s + centimes(r.montant), 0) / 100,
    parMois: parMois.map(({ mois, nb, c }) => ({ mois, nb, total: c / 100 })),
    parMode: [...modes]
      .map(([mode, { nb, c }]) => ({ mode, nb, total: c / 100 }))
      .sort((a, b) => b.total - a.total || a.mode.localeCompare(b.mode)),
  };
}

const ENTETES = [
  'Numéro',
  'Date du reçu',
  'Client',
  'Date de la séance',
  'Prestation',
  'Montant (€)',
  'Règlement',
  'État',
  "Motif d'annulation",
];

/** Cellule protégée : séparateur, guillemets, retours à la ligne, et formules de tableur neutralisées. */
function cellule(valeur: string): string {
  const v = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export interface TotalTrimestre {
  annee: number;
  /** 1 à 4 (janvier-mars, avril-juin, juillet-septembre, octobre-décembre). */
  trimestre: number;
  nb: number;
  total: number;
}

/**
 * Totaux des reçus valides par trimestre civil (date du reçu), du plus
 * ancien au plus récent ; seuls les trimestres ayant des reçus figurent.
 */
export function totauxTrimestres(recus: Recu[]): TotalTrimestre[] {
  const parCle = new Map<string, { annee: number; trimestre: number; nb: number; c: number }>();
  for (const r of recus) {
    if (r.annule_le) continue;
    const annee = Number(r.date_emission.slice(0, 4));
    const trimestre = Math.floor((Number(r.date_emission.slice(5, 7)) - 1) / 3) + 1;
    const cle = `${annee}-${trimestre}`;
    const x = parCle.get(cle) ?? { annee, trimestre, nb: 0, c: 0 };
    x.nb++;
    x.c += centimes(r.montant);
    parCle.set(cle, x);
  }
  return [...parCle.values()]
    .sort((a, b) => a.annee - b.annee || a.trimestre - b.trimestre)
    .map(({ annee, trimestre, nb, c }) => ({ annee, trimestre, nb, total: c / 100 }));
}

const dateFr = (jour: string) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;
const montantFr = (x: number) => (centimes(x) / 100).toFixed(2).replace('.', ',');

/**
 * Reçus d'une année au format CSV « à la française » (séparateur « ; »,
 * virgule décimale, dates JJ/MM/AAAA), du plus ancien au plus récent.
 * Le BOM UTF-8 en tête fait reconnaître les accents par Excel.
 */
export function csvRecus(recus: Recu[], annee: number): string {
  const lignes = recus
    .filter((r) => r.annee === annee)
    .sort((a, b) => a.numero - b.numero)
    .map((r) =>
      [
        numeroRecu(r),
        dateFr(r.date_emission),
        r.client_nom,
        dateFr(r.date_seance),
        r.prestation,
        montantFr(r.montant),
        MODES_REGLEMENT[r.mode_reglement],
        r.annule_le ? 'Annulé' : 'Valide',
        r.motif_annulation,
      ]
        .map(cellule)
        .join(';'),
    );
  return `﻿${[ENTETES.map(cellule).join(';'), ...lignes].join('\r\n')}\r\n`;
}

const libelleTrimestre = (t: number) => ['1er', '2e', '3e', '4e'][t - 1] + ' trimestre';

/**
 * Livre des recettes sur une ou plusieurs années : reçus valides dans
 * l'ordre chronologique (date, numéro, client, nature, règlement, montant),
 * puis les totaux par trimestre et le total général. Les reçus annulés
 * n'y figurent pas (aucune recette encaissée).
 */
export function csvLivreRecettes(recus: Recu[], annees?: number[]): string {
  const retenus = recus
    .filter((r) => !r.annule_le && (!annees || annees.includes(Number(r.date_emission.slice(0, 4)))))
    .sort((a, b) => a.date_emission.localeCompare(b.date_emission) || a.annee - b.annee || a.numero - b.numero);
  const lignes = [
    ['Date', 'N° de reçu', 'Client', 'Nature de la prestation', 'Règlement', 'Montant (€)'],
    ...retenus.map((r) => [
      dateFr(r.date_emission),
      numeroRecu(r),
      r.client_nom,
      r.lignes.length > 1 ? `${r.prestation} : ${r.lignes.map((l) => dateFr(l.date_seance)).join(', ')}` : r.prestation,
      MODES_REGLEMENT[r.mode_reglement],
      montantFr(r.montant),
    ]),
    [],
    ['Totaux par trimestre'],
    ['Année', 'Trimestre', 'Reçus', 'Montant (€)'],
    ...totauxTrimestres(retenus).map((t) => [
      String(t.annee),
      libelleTrimestre(t.trimestre),
      String(t.nb),
      montantFr(t.total),
    ]),
    ['Total', '', String(retenus.length), montantFr(retenus.reduce((s, r) => s + centimes(r.montant), 0) / 100)],
  ];
  return `\uFEFF${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`;
}

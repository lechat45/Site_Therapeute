// Rentabilité : chiffre d'affaires issu des tarifs (facultatifs) de
// chaque séance. Aucune donnée de paiement : c'est un suivi indicatif.

import { douzeDerniersMois } from './statistiques';
import type { ClientResume, SeanceTarif } from './types';

export type PeriodeRentabilite = '12mois' | 'annee' | 'tout';

export interface Rentabilite {
  ca_total: number;
  nb_seances: number;
  nb_seances_tarifees: number;
  nb_seances_sans_tarif: number;
  prix_moyen: number | null;
  nb_clients: number;
  ca_moyen_par_client: number | null;
  /** 12 derniers mois, quel que soit le filtre de période. */
  par_mois: { mois: string; ca: number; nb_seances: number }[];
  par_client: { client: Pick<ClientResume, 'id' | 'nom' | 'prenom'>; ca: number; nb_seances: number }[];
}

const centimes = (x: number) => Math.round(x * 100) / 100;

export function calculerRentabilite(
  seances: SeanceTarif[],
  clients: Pick<ClientResume, 'id' | 'nom' | 'prenom'>[],
  periode: PeriodeRentabilite,
  aujourdhui: string,
): Rentabilite {
  const mois = douzeDerniersMois(aujourdhui);
  const debut =
    periode === '12mois' ? `${mois[0]}-01` : periode === 'annee' ? `${aujourdhui.slice(0, 4)}-01-01` : '0000-01-01';
  const dansPeriode = seances.filter((s) => s.date_seance >= debut && s.date_seance <= aujourdhui);
  const tarifees = dansPeriode.filter((s) => s.prix !== null);
  const ca = centimes(tarifees.reduce((t, s) => t + Number(s.prix), 0));

  const parClient = new Map<string, { ca: number; nb_seances: number }>();
  for (const s of dansPeriode) {
    const c = parClient.get(s.client_id) ?? { ca: 0, nb_seances: 0 };
    c.ca = centimes(c.ca + Number(s.prix ?? 0));
    c.nb_seances++;
    parClient.set(s.client_id, c);
  }
  const noms = new Map(clients.map((c) => [c.id, c]));

  return {
    ca_total: ca,
    nb_seances: dansPeriode.length,
    nb_seances_tarifees: tarifees.length,
    nb_seances_sans_tarif: dansPeriode.length - tarifees.length,
    prix_moyen: tarifees.length ? centimes(ca / tarifees.length) : null,
    nb_clients: parClient.size,
    ca_moyen_par_client: parClient.size ? centimes(ca / parClient.size) : null,
    par_mois: mois.map((m) => {
      const duMois = seances.filter((s) => s.date_seance.startsWith(m) && s.date_seance <= aujourdhui);
      return {
        mois: m,
        ca: centimes(duMois.reduce((t, s) => t + Number(s.prix ?? 0), 0)),
        nb_seances: duMois.length,
      };
    }),
    par_client: [...parClient]
      .map(([id, v]) => ({ client: noms.get(id) ?? { id, nom: '?', prenom: '' }, ...v }))
      .sort((a, b) => b.ca - a.ca || b.nb_seances - a.nb_seances),
  };
}

export const euros = (x: number | null | undefined, decimales = 0) =>
  x === null || x === undefined
    ? '—'
    : x.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      });

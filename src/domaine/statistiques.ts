// Calcul des statistiques en mode démo — réplique exacte de la fonction
// SQL `public.statistiques()` (mêmes définitions, mêmes seuils, même
// arrondi). Le test tests/sql.test.ts compare les deux sur le même jeu.

import {
  EMOTIONS,
  NUMERO_BILAN,
  PROBLEMATIQUES,
  SEUIL_CLIENTS_PAR_CASE,
  SEUIL_THERAPEUTES,
  TRANCHES_AGE,
  ZONES_TEMPS_PRESENT,
} from '../config/referentiels';
import { dateDuJour } from './format';
import type { Client, ClientProblematique, PeriodeStatistiques, Perimetre, Seance, Statistiques } from './types';

export interface DonneesStatistiques {
  clients: (Pick<Client, 'id' | 'therapeute_id' | 'annee_naissance'> & { supprime_le?: string | null })[];
  seances: Pick<Seance, 'id' | 'client_id' | 'therapeute_id' | 'date_seance' | 'cases'>[];
  client_problematiques: Pick<ClientProblematique, 'client_id' | 'therapeute_id' | 'problematique_id'>[];
}

const arrondi = (x: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
};
const ratio = (a: number, b: number, decimales: number) => (b === 0 ? null : arrondi(a / b, decimales));
const JOUR = 86_400_000;

export function trancheDAge(age: number) {
  return TRANCHES_AGE.find((t) => age >= t.age_min && (t.age_max === null || age <= t.age_max));
}

/** Les 12 mois (AAAA-MM) finissant au mois de la date de référence. */
export function douzeDerniersMois(reference: string): string[] {
  const annee = Number(reference.slice(0, 4));
  const mois = Number(reference.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(annee, mois - 11 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

/**
 * Premier jour de la période : « 3 mois » = le mois de référence et les 2
 * précédents, « 12 mois » = lui et les 11 précédents. `null` = tout.
 */
export function debutPeriode(periode: PeriodeStatistiques, reference: string): string | null {
  if (periode === 'tout') return null;
  const mois = douzeDerniersMois(reference);
  return `${mois[periode === '3mois' ? 9 : 0]}-01`;
}

export function calculerStatistiques(
  donnees: DonneesStatistiques,
  uid: string,
  perimetre: Perimetre,
  reference: string = dateDuJour(),
  periode: PeriodeStatistiques = 'tout',
): Statistiques {
  const k = SEUIL_CLIENTS_PAR_CASE;
  const groupe = perimetre === 'groupe';
  const seuils = { clients: k, therapeutes: SEUIL_THERAPEUTES };
  // Le groupe porte toujours sur tout l'historique (voir la migration 20261003100000).
  const depuis = groupe ? null : debutPeriode(periode, reference);

  // Les clients de la corbeille ne comptent plus.
  const actifs = new Set(donnees.clients.filter((c) => !c.supprime_le).map((c) => c.id));
  const seancesActives = donnees.seances.filter((x) => actifs.has(x.client_id));

  if (groupe) {
    const nb = new Set(seancesActives.map((s) => s.therapeute_id)).size;
    if (nb < SEUIL_THERAPEUTES) {
      return { perimetre, disponible: false, seuils, kpis: { nb_therapeutes: nb } };
    }
  }

  const naissance = new Map(donnees.clients.map((c) => [c.id, c.annee_naissance]));
  const base = seancesActives.filter((x) => groupe || x.therapeute_id === uid);
  const s = base
    .filter((x) => !depuis || x.date_seance >= depuis)
    .map((x) => ({
      ...x,
      tranche_id: trancheDAge(Number(x.date_seance.slice(0, 4)) - naissance.get(x.client_id)!)?.id ?? null,
    }));

  // --- par client ------------------------------------------------------
  const parClient = new Map<string, { nb: number; min: number; max: number }>();
  for (const x of s) {
    const t = Date.parse(x.date_seance);
    const c = parClient.get(x.client_id);
    if (c) {
      c.nb++;
      c.min = Math.min(c.min, t);
      c.max = Math.max(c.max, t);
    } else parClient.set(x.client_id, { nb: 1, min: t, max: t });
  }
  const nbClients = parClient.size;
  const nbSeances = s.length;
  const durees = [...parClient.values()].map((c) => Math.round((c.max - c.min) / JOUR));
  const nbBilan = [...parClient.values()].filter((c) => c.nb >= NUMERO_BILAN).length;

  // --- occurrences d'émotions (cases « Émotion temps présent ») -------
  const occ = s.flatMap((x) =>
    x.cases
      .filter((c) => ZONES_TEMPS_PRESENT.includes(c.zone))
      .map(({ emotion_id }) => ({
        seance_id: x.id,
        emotion_id,
        client_id: x.client_id,
        therapeute_id: x.therapeute_id,
        tranche_id: x.tranche_id,
      })),
  );
  const autres = (lignes: { client_id: string; therapeute_id: string }[]) =>
    new Set(lignes.filter((l) => l.therapeute_id !== uid).map((l) => l.client_id)).size;
  const masque = (clientsAutres: number) => groupe && clientsAutres < k;

  const emotions = EMOTIONS.map((e) => {
    const o = occ.filter((x) => x.emotion_id === e.id);
    const m = masque(autres(o));
    return {
      emotion_id: e.id,
      libelle: e.libelle,
      masque: m,
      occurrences: m ? null : o.length,
      part_seances: m ? null : ratio(new Set(o.map((x) => x.seance_id)).size, nbSeances, 4),
      moyenne_par_client: m ? null : ratio(o.length, nbClients, 2),
    };
  });

  const tranches = TRANCHES_AGE.map((t) => {
    const st = s.filter((x) => x.tranche_id === t.id);
    const m = masque(autres(st));
    const ot = occ.filter((x) => x.tranche_id === t.id);
    return {
      tranche_id: t.id,
      libelle: t.libelle,
      masque: m,
      nb_clients: m ? null : new Set(st.map((x) => x.client_id)).size,
      nb_seances: m ? null : st.length,
      emotions: m
        ? []
        : EMOTIONS.map((e, ordre) => ({
            e,
            ordre,
            n: new Set(ot.filter((x) => x.emotion_id === e.id).map((x) => x.seance_id)).size,
          }))
            .filter((x) => x.n > 0)
            .sort((a, b) => b.n - a.n || a.ordre - b.ordre)
            .map((x) => ({
              emotion_id: x.e.id,
              libelle: x.e.libelle,
              part_seances: arrondi(x.n / st.length, 4),
            })),
    };
  });

  const cp = donnees.client_problematiques.filter((x) => parClient.has(x.client_id));
  const problematiques = PROBLEMATIQUES.map((p, ordre) => {
    const lignes = cp.filter((x) => x.problematique_id === p.id);
    const n = new Set(lignes.map((x) => x.client_id)).size;
    const m = masque(autres(lignes));
    return {
      ordre,
      tri: m ? 0 : n,
      ligne: {
        problematique_id: p.id,
        code: p.code,
        libelle: p.libelle,
        masque: m,
        nb_clients: m ? null : n,
        part_clients: m ? null : ratio(n, nbClients, 4),
      },
    };
  })
    .sort((a, b) => Number(a.ligne.masque) - Number(b.ligne.masque) || b.tri - a.tri || a.ordre - b.ordre)
    .map((x) => x.ligne);

  return {
    perimetre,
    disponible: true,
    seuils,
    kpis: {
      nb_therapeutes: new Set(s.map((x) => x.therapeute_id)).size,
      nb_clients: nbClients,
      nb_seances: nbSeances,
      moyenne_seances_par_client: ratio(nbSeances, nbClients, 2),
      duree_moyenne_suivi_jours: durees.length ? arrondi(durees.reduce((a, b) => a + b, 0) / durees.length, 1) : null,
      part_clients_bilan: ratio(nbBilan, nbClients, 4),
    },
    emotions,
    tranches,
    problematiques,
    // la courbe garde ses 12 mois, quelle que soit la période choisie
    par_mois: douzeDerniersMois(reference).map((mois) => ({
      mois,
      nb_seances: base.filter((x) => x.date_seance.startsWith(mois)).length,
    })),
  };
}

// Espace de groupe : repères tirés des statistiques anonymes du groupe, et
// comparaison « vous et le groupe ». Logique pure (testée dans tests/logique.test.ts).
//
// Confidentialité : tout part des agrégats déjà publiés par statistiques('groupe')
// (seuils d'anonymat appliqués en SQL : les cases « masque » sont ignorées ici). Vos
// propres chiffres (statistiques('personnel')) ne servent qu'à l'affichage sur VOTRE
// écran : rien n'est envoyé au groupe, aucun nom ni aucune fiche n'est lu.

import type { StatistiquesDisponibles } from './types';

export interface Repere {
  libelle: string;
  valeur: string;
  detail: string;
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const pourcent = (x: number) => `${Math.round(x * 100)} %`;

/** Quelques repères lisibles sur le groupe (seulement des cases publiées). */
export function reperesGroupe(g: StatistiquesDisponibles): Repere[] {
  const reperes: Repere[] = [];
  const emotion = g.emotions
    .filter((e) => !e.masque && e.part_seances !== null)
    .sort((a, b) => b.part_seances! - a.part_seances!)[0];
  if (emotion)
    reperes.push({
      libelle: 'Émotion la plus présente',
      valeur: emotion.libelle,
      detail: `dans ${pourcent(emotion.part_seances!)} des séances`,
    });
  const probleme = g.problematiques
    .filter((p) => !p.masque && p.part_clients !== null)
    .sort((a, b) => b.part_clients! - a.part_clients!)[0];
  if (probleme)
    reperes.push({
      libelle: 'Motif le plus fréquent',
      valeur: probleme.libelle,
      detail: `pour ${pourcent(probleme.part_clients!)} des clients`,
    });
  const tranche = g.tranches
    .filter((t) => !t.masque && t.nb_seances !== null)
    .sort((a, b) => b.nb_seances! - a.nb_seances!)[0];
  if (tranche)
    reperes.push({
      libelle: 'Âge le plus représenté',
      valeur: tranche.libelle,
      detail: `${tranche.nb_seances} séances sur ${g.kpis.nb_seances}`,
    });
  const mois = [...g.par_mois].sort((a, b) => b.nb_seances - a.nb_seances)[0];
  if (mois && mois.nb_seances > 0) {
    const [annee, m] = mois.mois.split('-').map(Number);
    reperes.push({
      libelle: 'Mois le plus chargé',
      valeur: `${MOIS[m - 1]} ${annee}`,
      detail: `${mois.nb_seances} séances (12 derniers mois)`,
    });
  }
  if (g.kpis.nb_therapeutes > 0)
    reperes.push({
      libelle: 'Séances par thérapeute',
      valeur: String(Math.round(g.kpis.nb_seances / g.kpis.nb_therapeutes)),
      detail: `en moyenne, depuis le début (${g.kpis.nb_therapeutes} thérapeutes)`,
    });
  return reperes;
}

export type Position = 'plus' | 'moins' | 'pareil';

export interface LigneComparaison {
  libelle: string;
  vous: number | null;
  groupe: number | null;
  /** Écart relatif d'au moins 10 % pour parler de « plus » ou de « moins ». */
  position: Position | null;
}

/** Position d'une valeur par rapport à celle du groupe (± 10 % = « comparable »). */
export function position(vous: number | null, groupe: number | null): Position | null {
  if (vous === null || groupe === null) return null;
  if (groupe === 0) return vous === 0 ? 'pareil' : 'plus';
  const ecart = (vous - groupe) / groupe;
  return ecart >= 0.1 ? 'plus' : ecart <= -0.1 ? 'moins' : 'pareil';
}

/** Les trois indicateurs du suivi, vous et le groupe. */
export function comparerIndicateurs(
  vous: StatistiquesDisponibles,
  groupe: StatistiquesDisponibles,
): LigneComparaison[] {
  // au dixième, comme les indicateurs du tableau de bord (« 4,3 séances »)
  const dixieme = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
  const semaines = (j: number | null) => dixieme(j === null ? null : j / 7);
  const lignes: Omit<LigneComparaison, 'position'>[] = [
    {
      libelle: 'Séances par client',
      vous: dixieme(vous.kpis.moyenne_seances_par_client),
      groupe: dixieme(groupe.kpis.moyenne_seances_par_client),
    },
    {
      libelle: 'Durée du suivi (semaines)',
      vous: semaines(vous.kpis.duree_moyenne_suivi_jours),
      groupe: semaines(groupe.kpis.duree_moyenne_suivi_jours),
    },
    {
      libelle: 'Clients allés jusqu’au bilan (%)',
      vous: vous.kpis.part_clients_bilan === null ? null : Math.round(vous.kpis.part_clients_bilan * 100),
      groupe: groupe.kpis.part_clients_bilan === null ? null : Math.round(groupe.kpis.part_clients_bilan * 100),
    },
  ];
  return lignes.map((l) => ({ ...l, position: position(l.vous, l.groupe) }));
}

/**
 * Émotions : les `n` plus présentes dans le groupe (cases publiées seulement), avec votre
 * part de séances en regard (en %, entiers).
 */
export function comparerEmotions(
  vous: StatistiquesDisponibles,
  groupe: StatistiquesDisponibles,
  n = 6,
): LigneComparaison[] {
  const mienne = new Map(vous.emotions.map((e) => [e.emotion_id, e.part_seances]));
  return groupe.emotions
    .filter((e) => !e.masque && e.part_seances !== null)
    .sort((a, b) => b.part_seances! - a.part_seances!)
    .slice(0, n)
    .map((e) => {
      const v = mienne.get(e.emotion_id);
      const l = {
        libelle: e.libelle,
        vous: v === null || v === undefined ? null : Math.round(v * 100),
        groupe: Math.round(e.part_seances! * 100),
      };
      return { ...l, position: position(l.vous, l.groupe) };
    });
}

/** Phrase courte et bienveillante pour une ligne de comparaison. */
export function phrasePosition(p: Position | null): string {
  if (p === 'plus') return 'au-dessus du groupe';
  if (p === 'moins') return 'en dessous du groupe';
  if (p === 'pareil') return 'comparable au groupe';
  return 'pas encore de données';
}

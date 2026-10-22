// Espace de groupe : repères et comparaison « vous et le groupe » (domaine/comparaison.ts).

import { describe, expect, it } from 'vitest';
import {
  comparerEmotions,
  comparerIndicateurs,
  phrasePosition,
  position,
  reperesGroupe,
} from '../src/domaine/comparaison';
import type { StatistiquesDisponibles } from '../src/domaine/types';

/** Fabrique : des statistiques complètes, dont on surcharge ce qui compte (kpis compris). */
function stats(
  partiel: Omit<Partial<StatistiquesDisponibles>, 'kpis'> & { kpis?: Partial<StatistiquesDisponibles['kpis']> },
) {
  return {
    perimetre: 'groupe',
    disponible: true,
    seuils: { clients: 5, therapeutes: 3 },
    emotions: [],
    tranches: [],
    problematiques: [],
    par_mois: [],
    ...partiel,
    kpis: {
      nb_therapeutes: 4,
      nb_clients: 40,
      nb_seances: 200,
      moyenne_seances_par_client: 5,
      duree_moyenne_suivi_jours: 70,
      part_clients_bilan: 0.6,
      ...partiel.kpis,
    },
  } as StatistiquesDisponibles;
}

const emotion = (emotion_id: number, libelle: string, part: number | null, masque = false) => ({
  emotion_id,
  libelle,
  masque,
  occurrences: null,
  part_seances: part,
  moyenne_par_client: null,
});

describe('espace de groupe : repères', () => {
  it('ne retient que les cases publiées (jamais une case masquée par les seuils)', () => {
    const g = stats({
      emotions: [emotion(1, 'Peur', 0.9, true), emotion(2, 'Joie', 0.4)],
      problematiques: [
        { problematique_id: 1, code: 'a', libelle: 'Deuil', masque: true, nb_clients: null, part_clients: 0.8 },
        { problematique_id: 2, code: 'b', libelle: 'Stress', masque: false, nb_clients: 9, part_clients: 0.3 },
      ],
      tranches: [
        { tranche_id: 1, libelle: '18 – 25 ans', masque: true, nb_clients: null, nb_seances: 120, emotions: [] },
        { tranche_id: 2, libelle: '26 – 35 ans', masque: false, nb_clients: 10, nb_seances: 60, emotions: [] },
      ],
      par_mois: [
        { mois: '2026-09', nb_seances: 12 },
        { mois: '2026-10', nb_seances: 20 },
      ],
    });
    const r = Object.fromEntries(reperesGroupe(g).map((x) => [x.libelle, x]));
    expect(r['Émotion la plus présente'].valeur).toBe('Joie');
    expect(r['Émotion la plus présente'].detail).toBe('dans 40 % des séances');
    expect(r['Motif le plus fréquent'].valeur).toBe('Stress');
    expect(r['Âge le plus représenté'].valeur).toBe('26 – 35 ans');
    expect(r['Mois le plus chargé'].valeur).toBe('octobre 2026');
    expect(r['Séances par thérapeute'].valeur).toBe('50');
  });

  it('sans case publiée, pas de repère inventé', () => {
    const r = reperesGroupe(stats({ emotions: [emotion(1, 'Peur', 0.9, true)], kpis: { nb_therapeutes: 0 } }));
    expect(r).toEqual([]);
  });
});

describe('espace de groupe : vous et le groupe', () => {
  it('« comparable » à ± 10 %, sinon au-dessus ou en dessous', () => {
    expect(position(5.4, 5)).toBe('pareil');
    expect(position(5.5, 5)).toBe('plus');
    expect(position(4.5, 5)).toBe('moins');
    expect(position(null, 5)).toBeNull();
    expect(position(0, 0)).toBe('pareil');
    expect(phrasePosition('plus')).toBe('au-dessus du groupe');
    expect(phrasePosition(null)).toBe('pas encore de données');
  });

  it('compare les indicateurs du suivi (semaines et pourcentages lisibles)', () => {
    const vous = stats({
      perimetre: 'personnel',
      kpis: { moyenne_seances_par_client: 4.3, duree_moyenne_suivi_jours: 58, part_clients_bilan: 0.77 },
    });
    const lignes = comparerIndicateurs(vous, stats({}));
    expect(lignes.map((l) => [l.vous, l.groupe, l.position])).toEqual([
      [4.3, 5, 'moins'],
      [8.3, 10, 'moins'],
      [77, 60, 'plus'],
    ]);
  });

  it('émotions : les plus présentes du groupe, avec votre part en regard', () => {
    const groupe = stats({
      emotions: [emotion(1, 'Peur', 0.3), emotion(2, 'Joie', 0.5), emotion(3, 'Rejet', 0.9, true)],
    });
    const vous = stats({ perimetre: 'personnel', emotions: [emotion(1, 'Peur', 0.31), emotion(2, 'Joie', null)] });
    expect(comparerEmotions(vous, groupe)).toEqual([
      { libelle: 'Joie', vous: null, groupe: 50, position: null },
      { libelle: 'Peur', vous: 31, groupe: 30, position: 'pareil' },
    ]);
  });
});

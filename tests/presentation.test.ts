// Présentation du site (config/presentation.ts) : contenu complet, parties masquées absentes.

import { describe, expect, it } from 'vitest';
import { DIAPOSITIVES, diapositivesVisibles } from '../src/config/presentation';

describe('présentation du site', () => {
  it('chaque diapositive a une clé unique, un titre, un résumé et des points', () => {
    expect(new Set(DIAPOSITIVES.map((d) => d.cle)).size).toBe(DIAPOSITIVES.length);
    for (const d of DIAPOSITIVES) {
      expect(d.titre.trim()).not.toBe('');
      expect(d.resume.trim()).not.toBe('');
      expect(d.points.length).toBeGreaterThanOrEqual(3);
      // les écrans s'ouvrent par le routeur : un chemin interne, jamais une adresse complète
      if (d.ecran) expect(d.ecran).toMatch(/^\/[a-z-]*(\?onglet=[a-z]+)?$/);
    }
  });

  it('commence par l’accueil et finit par les premiers pas', () => {
    const tout = diapositivesVisibles({ exercices: true, argent: true });
    expect(tout[0].cle).toBe('bienvenue');
    expect(tout.at(-1)!.cle).toBe('demarrer');
  });

  it('ne présente pas une partie masquée (config/fonctions.ts)', () => {
    const cles = (v: { exercices: boolean; argent: boolean }) => diapositivesVisibles(v).map((d) => d.cle);
    expect(cles({ exercices: false, argent: true })).not.toContain('exercices');
    expect(cles({ exercices: false, argent: true })).toContain('budget');
    expect(cles({ exercices: true, argent: false })).not.toContain('budget');
    expect(cles({ exercices: true, argent: true })).toHaveLength(DIAPOSITIVES.length);
  });
});

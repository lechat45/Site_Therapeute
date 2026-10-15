// Assistant IA des séances (_shared/analyse.ts) : pseudonymisation,
// requête Gemini, validation stricte de la réponse, repli local.

import { describe, expect, it } from 'vitest';
import {
  analyseSimulee,
  construirePrompt,
  construireRequeteGemini,
  ErreurAnalyse,
  lireReponseGemini,
  pseudonymiser,
  urlGemini,
  type ContexteAnalyse,
} from '../supabase/functions/_shared/analyse.ts';
import { decrireFiche } from '../supabase/functions/_shared/fiche.ts';
import { contexteAnalyse, estDerniereAnalysee, synthesePrecedente } from '../src/domaine/contexteAnalyse';
import type { Seance } from '../src/domaine/types';

const seance = (numero: number, synthese?: string): Seance => ({
  id: `s${numero}`,
  client_id: 'c',
  therapeute_id: 't',
  numero,
  type: numero <= 3 ? 'initiale' : numero === 4 ? 'bilan' : 'supplementaire',
  date_seance: '2026-03-10',
  lignee: 'mere',
  objectif: 'Apaiser les crises de colère',
  tim: '',
  notes: 'Élodie Dupont raconte une dispute avec sa sœur. Élodie a pleuré ; la colère domine.',
  cases: [
    { zone: 'present1_pile', position: 2, emotion_id: 3 },
    { zone: 'generation_2', position: 1, emotion_id: 7 },
    { zone: 'present1_haut', position: 1, emotion_id: 2 },
    { zone: 'present1_pile', position: 1, emotion_id: 1 },
    { zone: 'grille_generation_3', position: 3, emotion_id: 8 },
    { zone: 'present2_bas', position: 1, emotion_id: 4 },
  ],
  prix: null,
  analyse_ia: synthese
    ? { problematiques: [], emotions_reperees: [], synthese, points_attention: [], modele: 'x' }
    : null,
  analyse_ia_le: null,
});

const client = { nom: 'Dupont', prenom: 'Élodie', annee_naissance: 1990 };
const ctx: ContexteAnalyse = contexteAnalyse(client, seance(2), 'Synthèse de la séance 1.');

const reponse = (texte: string) => ({ candidates: [{ content: { parts: [{ text: texte }] } }] });

describe('pseudonymisation', () => {
  it('retire nom et prénom, sans tenir compte de la casse ni des accents', () => {
    expect(pseudonymiser('Élodie DUPONT, elodie et dupont-Martin.', client)).toBe(
      '[prénom] [nom], [prénom] et [nom]-Martin.',
    );
  });
  it('ne touche pas aux mots qui contiennent le nom', () => {
    expect(pseudonymiser('Léa Martin, la martingale de Martine.', { nom: 'Martin', prenom: 'Léa' })).toBe(
      '[prénom] [nom], la martingale de Martine.',
    );
  });
  it('le prompt envoyé ne contient ni le nom ni le prénom', () => {
    const prompt = construirePrompt(ctx);
    expect(prompt).not.toMatch(/Élodie|Elodie|Dupont/i);
    expect(prompt).toContain('[prénom] [nom] raconte une dispute');
    expect(JSON.stringify(construireRequeteGemini(ctx))).not.toMatch(/Élodie|Dupont/i);
  });
});

describe("description de la fiche pour l'IA", () => {
  it("reprend la feuille case par case, dans l'ordre de lecture", () => {
    expect(construirePrompt(ctx)).toContain(
      [
        'Fiche (émotions notées case par case) :',
        'Émotion temps présent (1) : en-tête Colère | — ; empilement Peur → Tristesse ; case du bas —',
        'Émotion temps présent (2) : en-tête — | — ; case du bas Joie',
        'Suivi croisé Père / Mère :',
        '- 2ième Génération : Père Abandon, Mère —',
        '3ième Génération (4 cases) : —, —, Rejet, —',
      ].join('\n'),
    );
  });
  it('une fiche vide est décrite par un tiret', () => {
    expect(decrireFiche([])).toBe('—');
  });
});

describe('requête Gemini', () => {
  it('impose une sortie JSON restreinte aux codes et émotions de référence', () => {
    const req = construireRequeteGemini(ctx);
    expect(req.generationConfig.responseMimeType).toBe('application/json');
    const schema = req.generationConfig.responseSchema;
    expect(schema.properties.problematiques.items.properties.code.enum).toContain('anxiete_stress');
    expect(schema.properties.emotions_reperees.items.enum).toHaveLength(14);
    expect(urlGemini('gemini-3.8-flash')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
  });
});

describe('lecture de la réponse Gemini', () => {
  it('valide, filtre et ré-injecte le prénom dans la synthèse stockée', () => {
    const r = lireReponseGemini(
      reponse(
        JSON.stringify({
          problematiques: [
            { code: 'famille', confiance: 0.8, justification: '[prénom] évoque sa sœur.' },
            { code: 'famille', confiance: 0.5, justification: 'doublon' },
            { code: 'inventé', confiance: 1, justification: 'hors liste' },
            { code: 'colere_impulsivite', confiance: 7, justification: 'x' },
          ],
          emotions_reperees: ['Colère', 'Extase'],
          synthese: '[prénom] progresse.',
          points_attention: ['', 'Surveiller le sommeil'],
        }),
      ),
      ctx,
      'gemini-test',
    );
    expect(r.problematiques).toEqual([
      { code: 'famille', confiance: 0.8, justification: 'Élodie évoque sa sœur.' },
      { code: 'colere_impulsivite', confiance: 1, justification: 'x' },
    ]);
    expect(r.emotions_reperees).toEqual(['Colère']);
    expect(r.synthese).toBe('Élodie progresse.');
    expect(r.points_attention).toEqual(['Surveiller le sommeil']);
    expect(r.modele).toBe('gemini-test');
  });

  it('refuse une réponse bloquée, vide ou illisible', () => {
    expect(() => lireReponseGemini({ promptFeedback: { blockReason: 'SAFETY' } }, ctx, 'm')).toThrow(ErreurAnalyse);
    expect(() => lireReponseGemini({ candidates: [{ finishReason: 'MAX_TOKENS' }] }, ctx, 'm')).toThrow(/MAX_TOKENS/);
    expect(() => lireReponseGemini(reponse('pas du json'), ctx, 'm')).toThrow(/illisible/);
    expect(() => lireReponseGemini(reponse('{"problematiques":[]}'), ctx, 'm')).toThrow(/synthèse/);
  });
});

describe('synthèse évolutive', () => {
  it("part de la dernière séance antérieure analysée (ré-analyser n'empile pas)", () => {
    const seances = [seance(1, 'S1'), seance(2), seance(3, 'S3'), seance(4)];
    expect(synthesePrecedente(seances, 4)).toBe('S3');
    expect(synthesePrecedente(seances, 3)).toBe('S1');
    expect(synthesePrecedente(seances, 1)).toBeNull();
    expect(estDerniereAnalysee(seances, 4)).toBe(true);
    expect(estDerniereAnalysee(seances, 2)).toBe(false);
  });

  it('la simulation locale catégorise et prolonge la synthèse', () => {
    const r = analyseSimulee(ctx);
    expect(r.problematiques.map((p) => p.code)).toContain('colere_impulsivite');
    expect(r.synthese.startsWith('Synthèse de la séance 1.\nSéance 2 :')).toBe(true);
    expect(r.modele).toBe('simulation-locale');
  });

  it('la simulation ne se laisse pas piéger par le prénom (« mari » dans « Marion »)', () => {
    const c = contexteAnalyse(
      { nom: 'Rousseau', prenom: 'Marion', annee_naissance: 1987 },
      {
        ...seance(2),
        objectif: '',
        notes: "Marion parle d'insomnies et d'un stress permanent.",
      },
      null,
    );
    const codes = analyseSimulee(c).problematiques.map((p) => p.code);
    expect(codes).not.toContain('couple');
    expect(codes).toEqual(expect.arrayContaining(['sommeil', 'anxiete_stress']));
  });
});

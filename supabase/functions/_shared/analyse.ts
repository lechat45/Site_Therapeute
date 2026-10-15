// Logique d'analyse IA, sans dépendance : importée à la fois par la
// fonction Edge (Deno) et par l'application (mode démo + tests).
//
// Rien ici n'appelle le réseau : on construit la requête Gemini et on
// valide sa réponse. L'appel lui-même vit dans la fonction Edge.

import { casesTempsPresent, decrireFiche } from './fiche.ts';

export const GEMINI_MODELE_PAR_DEFAUT = 'gemini-3.8-flash';
export const MODELE_SIMULATION = 'simulation-locale';

export interface ContexteAnalyse {
  /** Sert UNIQUEMENT à pseudonymiser le texte ; jamais transmis à l'IA. */
  identite: { nom: string; prenom: string };
  numero: number;
  type: 'initiale' | 'bilan' | 'supplementaire';
  age: number | null;
  objectif: string;
  tim: string;
  notes: string;
  /** Cases remplies de la feuille, émotion en clair (voir fiche.ts). */
  cases: { zone: string; position: number; emotion: string }[];
  synthese_precedente: string | null;
  problematiques: { code: string; libelle: string }[];
  emotions: string[];
}

export interface ResultatAnalyse {
  problematiques: { code: string; confiance: number; justification: string }[];
  emotions_reperees: string[];
  synthese: string;
  points_attention: string[];
  modele: string;
}

// ---------------------------------------------------------------------
// Pseudonymisation : le nom et le prénom du client sont retirés du texte
// avant tout envoi (y compris sous forme de mot isolé, sans tenir compte
// de la casse ni des accents).
// ---------------------------------------------------------------------
const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export function pseudonymiser(texte: string, identite: { nom: string; prenom: string }): string {
  let resultat = texte;
  const remplacements: [string, string][] = [
    [identite.prenom, '[prénom]'],
    [identite.nom, '[nom]'],
  ];
  for (const [mot, jeton] of remplacements) {
    const cible = sansAccents(mot.trim());
    if (cible.length < 2) continue;
    // Recherche sur une copie sans accents (même longueur que l'original
    // pour les lettres latines usuelles), remplacement sur l'original.
    const motif = new RegExp(
      `(?<![\\p{L}\\p{N}])${cible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
      'giu',
    );
    const base = sansAccents(resultat);
    if (base.length !== resultat.length) {
      resultat = resultat.replace(motif, jeton);
      continue;
    }
    let sortie = '';
    let curseur = 0;
    for (const m of base.matchAll(motif)) {
      sortie += resultat.slice(curseur, m.index) + jeton;
      curseur = m.index! + m[0].length;
    }
    resultat = sortie + resultat.slice(curseur);
  }
  return resultat;
}

/**
 * Opération inverse, appliquée à la RÉPONSE (stockée dans la fiche privée) :
 * le thérapeute relit « Jules » plutôt que « [prénom] ». Le nom n'a
 * jamais quitté le serveur.
 */
export function repersonnaliser(texte: string, identite: { nom: string; prenom: string }): string {
  return texte.replaceAll('[prénom]', identite.prenom).replaceAll('[nom]', identite.nom);
}

// ---------------------------------------------------------------------
// Requête Gemini (API REST generateContent, sortie JSON structurée)
// ---------------------------------------------------------------------
const CONSIGNES = `Tu assistes un thérapeute comportementaliste émotionnel. Tu lis la fiche d'une séance et tu produis une aide à la rédaction, que le thérapeute validera.

Règles impératives :
- Tu n'établis AUCUN diagnostic médical ou psychiatrique et ne proposes aucun traitement.
- Tu n'inventes rien : tu ne t'appuies que sur la fiche et la synthèse précédente.
- Tu désignes la personne par « la personne accompagnée », jamais par un nom.
- Tu écris en français, sur un ton professionnel, neutre et bienveillant.

Tâches :
1. « problematiques » : classe la problématique de la personne dans 1 à 3 catégories de la liste fournie (codes exacts), avec une confiance entre 0 et 1 et une justification d'une phrase.
2. « emotions_reperees » : les émotions de la liste fournie qui ressortent des notes.
3. « synthese » : mets à jour la synthèse évolutive du suivi en intégrant cette séance à la synthèse précédente (120 à 200 mots, chronologique, sans répétitions).
4. « points_attention » : 0 à 3 points à surveiller lors des prochaines séances.`;

const LIBELLES_TYPE = { initiale: 'séance initiale', bilan: 'bilan', supplementaire: 'séance supplémentaire' };

export function construirePrompt(ctx: ContexteAnalyse): string {
  const p = (t: string) => pseudonymiser(t, ctx.identite).trim() || '—';
  return [
    `Séance n° ${ctx.numero} (${LIBELLES_TYPE[ctx.type]})${ctx.age !== null ? ` — âge : ${ctx.age} ans` : ''}`,
    `Objectif : ${p(ctx.objectif)}`,
    `T.I.M. : ${p(ctx.tim)}`,
    `Fiche (émotions notées case par case) :\n${decrireFiche(ctx.cases)}`,
    `Notes de séance :\n${p(ctx.notes)}`,
    `Synthèse précédente :\n${ctx.synthese_precedente ? p(ctx.synthese_precedente) : '(première analyse)'}`,
    `Catégories de problématiques (code : libellé) :\n${ctx.problematiques.map((x) => `${x.code} : ${x.libelle}`).join('\n')}`,
    `Émotions de référence : ${ctx.emotions.join(', ')}`,
  ].join('\n\n');
}

export function construireRequeteGemini(ctx: ContexteAnalyse) {
  return {
    systemInstruction: { parts: [{ text: CONSIGNES }] },
    contents: [{ role: 'user', parts: [{ text: construirePrompt(ctx) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          problematiques: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                code: { type: 'STRING', enum: ctx.problematiques.map((x) => x.code) },
                confiance: { type: 'NUMBER' },
                justification: { type: 'STRING' },
              },
              required: ['code', 'confiance', 'justification'],
            },
          },
          emotions_reperees: { type: 'ARRAY', items: { type: 'STRING', enum: ctx.emotions } },
          synthese: { type: 'STRING' },
          points_attention: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['problematiques', 'emotions_reperees', 'synthese', 'points_attention'],
        propertyOrdering: ['problematiques', 'emotions_reperees', 'synthese', 'points_attention'],
      },
    },
  };
}

export function urlGemini(modele: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`;
}

export class ErreurAnalyse extends Error {}

/** Valide la réponse brute de Gemini ; rejette tout ce qui sort du cadre. */
export function lireReponseGemini(brut: unknown, ctx: ContexteAnalyse, modele: string): ResultatAnalyse {
  const r = brut as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  if (r?.promptFeedback?.blockReason) {
    throw new ErreurAnalyse(`Analyse bloquée par les filtres de Gemini (${r.promptFeedback.blockReason}).`);
  }
  const candidat = r?.candidates?.[0];
  const texte = candidat?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!texte) {
    throw new ErreurAnalyse(`Réponse vide de Gemini${candidat?.finishReason ? ` (${candidat.finishReason})` : ''}.`);
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(texte);
  } catch {
    throw new ErreurAnalyse('Réponse de Gemini illisible (JSON invalide).');
  }

  const codes = new Set(ctx.problematiques.map((x) => x.code));
  const emotions = new Set(ctx.emotions);
  const vus = new Set<string>();
  const r2 = (t: string) => repersonnaliser(t, ctx.identite);
  const problematiques = (Array.isArray(json.problematiques) ? json.problematiques : [])
    .filter(
      (p): p is { code: string; confiance: unknown; justification: unknown } =>
        typeof p?.code === 'string' && codes.has(p.code),
    )
    .filter((p) => !vus.has(p.code) && vus.add(p.code))
    .slice(0, 3)
    .map((p) => ({
      code: p.code,
      confiance: Math.min(1, Math.max(0, Number(p.confiance) || 0)),
      justification: r2(String(p.justification ?? '').slice(0, 400)),
    }));
  const synthese = typeof json.synthese === 'string' ? json.synthese.trim() : '';
  if (!synthese) throw new ErreurAnalyse("Gemini n'a pas produit de synthèse.");

  return {
    problematiques,
    emotions_reperees: [
      ...new Set(
        (Array.isArray(json.emotions_reperees) ? json.emotions_reperees : []).filter(
          (e): e is string => typeof e === 'string' && emotions.has(e),
        ),
      ),
    ],
    synthese: r2(synthese.slice(0, 3000)),
    points_attention: (Array.isArray(json.points_attention) ? json.points_attention : [])
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      .slice(0, 3)
      .map((x) => r2(x.slice(0, 300))),
    modele,
  };
}

// ---------------------------------------------------------------------
// Simulation locale (mode démo sans clé) : repérage par mots-clés.
// Elle ne prétend pas analyser ; elle montre le parcours de l'écran.
// ---------------------------------------------------------------------
const MOTS_CLES: Record<string, string[]> = {
  anxiete_stress: ['anxi', 'stress', 'angoiss', 'panique', 'inquiet', 'tension'],
  estime_de_soi: ['confiance', 'estime', 'nul', 'valeur', 'pas a la hauteur', 'devaloris'],
  couple: ['couple', 'conjoint', 'mari', 'epoux', 'epouse', 'compagn', 'rupture'],
  famille: ['famille', 'mere', 'pere', 'frere', 'soeur', 'parents', 'fratrie'],
  deuil_separation: ['deuil', 'deces', 'perte', 'separation', 'divorce', 'disparu'],
  sommeil: ['sommeil', 'insomnie', 'cauchemar', 'endorm', 'reveil'],
  phobies: ['phobie', 'peur de', 'vertige', 'avion', 'foule'],
  dependances: ['alcool', 'tabac', 'cannabis', 'addiction', 'dependan', 'ecran'],
  alimentation: ['aliment', 'boulimie', 'anorexie', 'grignot', 'poids', 'manger'],
  epuisement_professionnel: ['travail', 'burn', 'epuis', 'professionnel', 'hierarchie', 'collegue'],
  colere_impulsivite: ['colere', 'impulsi', 'crise', 'explos', 'agressi', 'irritab'],
  traumatisme: ['trauma', 'choc', 'accident', 'agression', 'violence'],
  parentalite: ['enfant', 'parentalite', 'maternite', 'paternite', 'ado'],
  scolarite: ['ecole', 'scolaire', 'college', 'lycee', 'devoirs', 'harcelement'],
};

export function analyseSimulee(ctx: ContexteAnalyse): ResultatAnalyse {
  // Même texte que celui qu'enverrait la vraie analyse (nom et prénom
  // retirés), et mots-clés reconnus en début de mot : « mari » ne doit
  // pas se déclencher sur « Marion ».
  const texte = sansAccents(pseudonymiser(`${ctx.objectif} ${ctx.notes}`, ctx.identite)).toLowerCase();
  const present = (mot: string) => new RegExp(`(?<![\\p{L}])${mot}`, 'u').test(texte);
  const scores = ctx.problematiques
    .map((p) => ({ p, n: (MOTS_CLES[p.code] ?? []).filter(present).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const problematiques = scores.length
    ? scores.map(({ p, n }) => ({
        code: p.code,
        confiance: Math.min(0.9, 0.35 + 0.15 * n),
        justification: `Termes associés à « ${p.libelle.toLowerCase()} » repérés dans les notes.`,
      }))
    : ctx.problematiques
        .filter((p) => p.code === 'autre')
        .map((p) => ({ code: p.code, confiance: 0.2, justification: 'Aucun terme caractéristique repéré.' }));

  const tempsPresent = [...new Set(casesTempsPresent(ctx.cases).map((c) => c.emotion))];
  const emotions_reperees = ctx.emotions.filter(
    (e) => present(sansAccents(e).toLowerCase()) || tempsPresent.includes(e),
  );

  const premierePhraseNotes = ctx.notes.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  const ajout = `Séance ${ctx.numero}${ctx.type === 'bilan' ? ' (bilan)' : ''} : ${
    tempsPresent.length ? `émotions au temps présent ${tempsPresent.join(', ')}. ` : ''
  }${premierePhraseNotes}`.trim();
  const synthese = [ctx.synthese_precedente?.trim(), ajout].filter(Boolean).join('\n');

  return {
    problematiques,
    emotions_reperees,
    synthese,
    points_attention: [],
    modele: MODELE_SIMULATION,
  };
}

// Questionnaires de suivi : types partagés et « lecture » des réponses
// pour l'onglet Tâches. Aucune dépendance : importé par l'application,
// la fonction Edge et les tests.
//
// La lecture LOCALE (règles simples) est toujours disponible et décide
// seule de la priorité. Gemini, s'il est disponible, ne fait que
// reformuler le résumé et la suggestion (voir construireRequeteLecture).

import { pseudonymiser } from './analyse.ts';

export type TypeQuestion = 'curseur' | 'etoiles' | 'texte' | 'choix_unique' | 'choix_multiple' | 'oui_non' | 'emotions';

/** Question telle qu'envoyée au client (copie conservée avec l'envoi). */
export interface QuestionEnvoyee {
  id: string;
  libelle: string;
  type: TypeQuestion;
  aide: string;
  obligatoire: boolean;
  options: string[];
  minimum: number;
  maximum: number;
  /** Curseurs et étoiles : « haut » si une valeur haute est bonne. */
  sens: 'haut' | 'bas';
  libelle_min: string;
  libelle_max: string;
}

export type ValeurReponse = number | string | boolean | string[] | null;

export interface Reponse {
  question_id: string;
  libelle: string;
  type: TypeQuestion;
  valeur: ValeurReponse;
}

export interface LectureQuestionnaire {
  tendance: 'premiere' | 'amelioration' | 'stable' | 'degradation';
  priorite: 'haute' | 'normale';
  /** Faits marquants, ex. « Bien-être : 4 → 8 (+4) ». */
  points: string[];
  resume: string;
  suggestion: string;
  /** « lecture-locale » ou le modèle Gemini utilisé. */
  modele: string;
}

export const MODELE_LECTURE_LOCALE = 'lecture-locale';

export class ReponseInvalide extends Error {
  constructor(
    message: string,
    readonly questionId: string,
  ) {
    super(message);
  }
}

/**
 * Contrôle les réponses d'un client — miroir exact de la fonction SQL
 * `repondre_questionnaire` (mêmes règles, mêmes messages). Une chaîne ou
 * une liste vide vaut « pas de réponse ».
 */
export function validerReponses(
  questions: QuestionEnvoyee[],
  saisies: Record<string, ValeurReponse | undefined>,
  emotions: string[],
): Reponse[] {
  return questions.map((q) => {
    let v = saisies[q.id] ?? null;
    if (typeof v === 'string' && !v.trim()) v = null;
    if (Array.isArray(v) && v.length === 0) v = null;
    const invalide = () => new ReponseInvalide(`Réponse invalide : ${q.libelle}`, q.id);
    if (v === null) {
      if (q.obligatoire) throw new ReponseInvalide(`Réponse manquante : ${q.libelle}`, q.id);
    } else if (estChiffree(q.type)) {
      const min = q.type === 'etoiles' ? 1 : q.minimum;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > q.maximum) throw invalide();
    } else if (q.type === 'oui_non') {
      if (typeof v !== 'boolean') throw invalide();
    } else if (q.type === 'choix_unique') {
      if (typeof v !== 'string' || !q.options.includes(v)) throw invalide();
    } else if (q.type === 'choix_multiple' || q.type === 'emotions') {
      const permises = q.type === 'emotions' ? emotions : q.options;
      if (
        !Array.isArray(v) ||
        new Set(v).size !== v.length ||
        v.some((x) => typeof x !== 'string' || !permises.includes(x))
      )
        throw invalide();
    } else if (typeof v !== 'string' || v.length > 2000) throw invalide();
    return { question_id: q.id, libelle: q.libelle, type: q.type, valeur: v };
  });
}

export const estChiffree = (t: TypeQuestion) => t === 'curseur' || t === 'etoiles';

/** Valeur ramenée entre 0 (mauvais) et 1 (bon), selon les bornes et le sens. */
export function scoreNormalise(q: Pick<QuestionEnvoyee, 'type' | 'minimum' | 'maximum' | 'sens'>, v: number): number {
  const min = q.type === 'etoiles' ? 1 : q.minimum;
  const s = (v - min) / Math.max(1, q.maximum - min);
  return q.sens === 'bas' ? 1 - s : s;
}

/** Minuscules, sans accents ni ponctuation (« N’en » → « n en »), espaces simples. */
const normaliser = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/**
 * Expressions qui, dans un message libre, justifient une lecture rapide
 * (forme normalisée). Simple filet de sécurité : ne remplace jamais la
 * lecture des réponses par le thérapeute.
 */
const DETRESSE = [
  // idées suicidaires, envie de disparaître
  'suicid',
  'en finir',
  'mettre fin a mes jours',
  'mettre fin a ma vie',
  'plus envie de vivre',
  'pas envie de vivre',
  'envie de mourir',
  'veux mourir',
  'vais mourir',
  'me tuer',
  'me foutre en l air',
  'envie de disparaitre',
  'veux disparaitre',
  'idees noires',
  'mieux sans moi',
  'ne plus me reveiller',
  'plus la force',
  'plus aucun espoir',
  'sans espoir',
  'desespoir',
  'desespere',
  // épuisement, effondrement
  'je n en peux plus',
  'j en peux plus',
  'au bout du rouleau',
  'je craque',
  'je m effondre',
  'tout arreter',
  // atteintes à soi
  'me faire du mal',
  'me fais du mal',
  'me blesser',
  'automutil',
  'auto mutil',
  'scarif',
  'me couper',
  'overdose',
  // violences subies
  'me frappe',
  'm a frappe',
  'me bat',
  'violence',
  'violente',
  'peur pour ma vie',
  'harcel',
  'agress',
].map((m) => ` ${m}`);

export function contientDetresse(texte: string): boolean {
  const t = normaliser(texte);
  // chaque expression doit commencer un mot (« agress » trouve « agression », pas « regression »)
  return DETRESSE.some((m) => t.includes(m));
}

/** Intitulé court : « Comment dormez-vous… ». */
export function intituleCourt(libelle: string, max = 42): string {
  const t = libelle.replace(/\s*[?:]\s*$/, '').trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 12 ? coupe.slice(0, espace) : coupe).replace(/[\s,;]+$/, '')}…`;
}

export interface EnvoiLu {
  questions: QuestionEnvoyee[];
  reponses: Reponse[];
}

/**
 * Lecture locale : compare aux réponses précédentes du même client
 * (question par question), repère les baisses, les scores très bas et
 * les messages de détresse.
 */
export function lectureLocale(courant: EnvoiLu, precedent?: EnvoiLu | null): LectureQuestionnaire {
  const parId = new Map(courant.questions.map((q) => [q.id, q]));
  const avant = new Map<string, { q: QuestionEnvoyee; v: number }>();
  if (precedent)
    for (const r of precedent.reponses) {
      const q = precedent.questions.find((x) => x.id === r.question_id);
      if (q && estChiffree(q.type) && typeof r.valeur === 'number') {
        avant.set(q.id, { q, v: r.valeur });
        avant.set(`libelle:${q.libelle}`, { q, v: r.valeur });
      }
    }

  const points: string[] = [];
  let ecartCumule = 0;
  let comparees = 0;
  let alerte = false;
  let detresse = false;

  for (const r of courant.reponses) {
    const q = parId.get(r.question_id);
    if (!q) continue;
    if (estChiffree(q.type) && typeof r.valeur === 'number') {
      const score = scoreNormalise(q, r.valeur);
      const p = avant.get(q.id) ?? avant.get(`libelle:${q.libelle}`);
      const unite = q.type === 'etoiles' ? `/${q.maximum}` : '';
      if (p) {
        const ecart = scoreNormalise(q, r.valeur) - scoreNormalise(p.q, p.v);
        ecartCumule += ecart;
        comparees++;
        if (Math.abs(r.valeur - p.v) >= 1) points.push(`${intituleCourt(q.libelle)} : ${p.v} → ${r.valeur}${unite}`);
        if (ecart <= -0.3) alerte = true;
      }
      if (score <= 0.2) {
        alerte = true;
        if (!p) points.push(`${intituleCourt(q.libelle)} : ${r.valeur}${unite} (score bas)`);
      }
    }
    if (q.type === 'texte' && typeof r.valeur === 'string' && contientDetresse(r.valeur)) {
      alerte = detresse = true;
      points.unshift('Le message contient des mots de détresse : à lire en priorité.');
    }
    if (q.type === 'oui_non' && r.valeur === true && /rendez-vous|rdv|séance/i.test(q.libelle))
      points.push('Souhaite reprendre rendez-vous.');
  }

  const moyenne = comparees ? ecartCumule / comparees : 0;
  const tendance: LectureQuestionnaire['tendance'] = !comparees
    ? 'premiere'
    : moyenne >= 0.08
      ? 'amelioration'
      : moyenne <= -0.08
        ? 'degradation'
        : 'stable';
  const priorite = alerte || tendance === 'degradation' ? 'haute' : 'normale';

  const resume =
    (tendance === 'premiere'
      ? 'Premier questionnaire rempli : pas encore de point de comparaison.'
      : tendance === 'amelioration'
        ? 'Les réponses montrent une amélioration depuis le questionnaire précédent.'
        : tendance === 'degradation'
          ? 'Les réponses montrent une dégradation depuis le questionnaire précédent.'
          : 'Les réponses sont stables depuis le questionnaire précédent.') +
    (detresse ? ' Le message libre appelle toutefois une lecture rapide.' : '');
  const suggestion =
    priorite === 'haute'
      ? 'Prendre contact rapidement et proposer un rendez-vous.'
      : tendance === 'amelioration'
        ? "Un message d'encouragement peut suffire."
        : points.includes('Souhaite reprendre rendez-vous.')
          ? 'Proposer une date de rendez-vous.'
          : "Rien d'urgent : à évoquer lors de la prochaine séance.";

  return { tendance, priorite, points, resume, suggestion, modele: MODELE_LECTURE_LOCALE };
}

// ---------------------------------------------------------------------
// Gemini (facultatif) : reformule le résumé et la suggestion
// ---------------------------------------------------------------------
const CONSIGNES_LECTURE = `Tu aides un thérapeute comportementaliste émotionnel à lire en quelques secondes le questionnaire de suivi qu'un client vient de remplir.
Règles : aucun diagnostic, aucune invention, aucun nom ; français professionnel et bienveillant.
Réponds par un « resume » de 2 à 3 phrases factuelles (évolution par rapport au questionnaire précédent s'il existe) et une « suggestion » d'action en une phrase.`;

function decrireReponses(envoi: EnvoiLu, identite: { nom: string; prenom: string }): string {
  return envoi.reponses
    .map((r) => {
      const q = envoi.questions.find((x) => x.id === r.question_id);
      const v = r.valeur;
      const texte =
        v === null
          ? '(sans réponse)'
          : Array.isArray(v)
            ? v.join(', ')
            : typeof v === 'boolean'
              ? v
                ? 'oui'
                : 'non'
              : typeof v === 'number' && q
                ? `${v} (échelle ${q.type === 'etoiles' ? 1 : q.minimum}–${q.maximum}, ${q.sens === 'bas' ? 'plus bas = mieux' : 'plus haut = mieux'})`
                : pseudonymiser(String(v), identite);
      return `- ${r.libelle} : ${texte}`;
    })
    .join('\n');
}

export function construireRequeteLecture(
  courant: EnvoiLu,
  precedent: EnvoiLu | null,
  locale: LectureQuestionnaire,
  identite: { nom: string; prenom: string },
) {
  const texte = [
    `Questionnaire actuel :\n${decrireReponses(courant, identite)}`,
    `Questionnaire précédent :\n${precedent ? decrireReponses(precedent, identite) : '(aucun)'}`,
    `Repères calculés : tendance ${locale.tendance}, priorité ${locale.priorite}.${locale.points.length ? `\n${locale.points.join('\n')}` : ''}`,
  ].join('\n\n');
  return {
    systemInstruction: { parts: [{ text: CONSIGNES_LECTURE }] },
    contents: [{ role: 'user', parts: [{ text: texte }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { resume: { type: 'STRING' }, suggestion: { type: 'STRING' } },
        required: ['resume', 'suggestion'],
        propertyOrdering: ['resume', 'suggestion'],
      },
    },
  };
}

/** Garde la priorité et les points locaux ; ne prend de Gemini que le texte. */
export function lireReponseLecture(
  brut: unknown,
  locale: LectureQuestionnaire,
  modele: string,
  identite: { nom: string; prenom: string },
): LectureQuestionnaire {
  const r = brut as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const texte = r?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let json: { resume?: unknown; suggestion?: unknown };
  try {
    json = JSON.parse(texte);
  } catch {
    return locale;
  }
  const propre = (x: unknown, max: number) =>
    typeof x === 'string' && x.trim()
      ? x.trim().slice(0, max).replaceAll('[prénom]', identite.prenom).replaceAll('[nom]', identite.nom)
      : null;
  const resume = propre(json.resume, 600);
  const suggestion = propre(json.suggestion, 300);
  if (!resume || !suggestion) return locale;
  return { ...locale, resume, suggestion, modele };
}

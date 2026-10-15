// Texte simple des exercices et documents → blocs affichables, SANS HTML
// (aucune injection possible) : « # » titre, « - » élément de liste,
// « ? » question à laquelle le client répond, ligne vide = nouveau paragraphe.

import type { ReponseExercice } from './types';

export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'paragraphe'; texte: string }
  /** `indice` : rang de la question (0, 1, 2…), celui de la réponse attendue. */
  | { type: 'question'; texte: string; indice: number };

// Mêmes règles que public.questions_document() : ligne débarrassée des
// espaces et tabulations, « ? » suivi d'au moins un espace.
const nettoyer = (ligne: string) => ligne.replace(/^[ \t]+|[ \t]+$/g, '');
const QUESTION = /^\?\s/;

const lignesDe = (contenu: string) => contenu.replace(/\r\n?/g, '\n').split('\n');

export function blocsTexte(contenu: string): Bloc[] {
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let questions = 0;
  const fermerParagraphe = () => {
    if (paragraphe.length) blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') });
    paragraphe = [];
  };
  for (const brute of lignesDe(contenu)) {
    const ligne = nettoyer(brute);
    if (!ligne.trim()) {
      fermerParagraphe();
      continue;
    }
    if (QUESTION.test(ligne)) {
      fermerParagraphe();
      blocs.push({ type: 'question', texte: ligne.replace(/^\?\s+/, ''), indice: questions++ });
    } else if (/^#+\s/.test(ligne)) {
      fermerParagraphe();
      blocs.push({ type: 'titre', texte: ligne.replace(/^#+\s+/, '') });
    } else if (/^[-*•]\s/.test(ligne)) {
      fermerParagraphe();
      const texte = ligne.replace(/^[-*•]\s+/, '');
      const dernier = blocs[blocs.length - 1];
      if (dernier?.type === 'liste') dernier.elements.push(texte);
      else blocs.push({ type: 'liste', elements: [texte] });
    } else paragraphe.push(ligne);
  }
  fermerParagraphe();
  return blocs;
}

/** Questions d'un exercice à compléter, dans l'ordre (miroir de public.questions_document). */
export function questionsDocument(contenu: string): string[] {
  return lignesDe(contenu)
    .map(nettoyer)
    .filter((l) => QUESTION.test(l))
    .map((l) => l.replace(/^\?\s+/, ''));
}

export const REPONSE_MAX = 5000;

/**
 * Réponses du client à un exercice : mêmes règles et mêmes messages que
 * public.repondre_document() (une réponse par question, 5 000 caractères
 * au plus, au moins une réponse).
 */
export function validerReponsesDocument(questions: string[], reponses: string[]): ReponseExercice[] {
  if (!questions.length) throw new Error("Ce document n'attend pas de réponse.");
  if (reponses.length !== questions.length || reponses.some((r) => typeof r !== 'string'))
    throw new Error('Réponses incomplètes.');
  const propres = reponses.map((r) => r.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ''));
  if (propres.some((r) => r.length > REPONSE_MAX)) throw new Error('Réponse trop longue (5 000 caractères au plus).');
  if (propres.every((r) => !r)) throw new Error('Répondez à au moins une question.');
  return questions.map((question, i) => ({ question, reponse: propres[i] }));
}

/** Numéro affiché d'un reçu : « 2026-0007 ». */
export const numeroRecu = (r: { annee: number; numero: number }) => `${r.annee}-${String(r.numero).padStart(4, '0')}`;

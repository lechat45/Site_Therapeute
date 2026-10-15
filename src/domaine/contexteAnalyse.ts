// Contexte d'une séance pour l'analyse IA : émotions de la fiche en clair,
// synthèse évolutive précédente, séance analysée la plus récente. Pur, sans
// appel réseau (l'appel est dans donnees/ et la fonction Edge).

import { EMOTIONS, PROBLEMATIQUES, trierCases } from '../config/referentiels';
import type { ContexteAnalyse } from '../../supabase/functions/_shared/analyse.ts';
import type { Client, Seance } from './types';

export const libelleEmotion = (id: number | null) => EMOTIONS.find((e) => e.id === id)?.libelle ?? null;

/** Assemble ce que l'IA a le droit de voir d'une séance (le nom sert à pseudonymiser). */
export function contexteAnalyse(
  client: Pick<Client, 'nom' | 'prenom' | 'annee_naissance'>,
  seance: Seance,
  synthesePrecedente: string | null,
): ContexteAnalyse {
  return {
    identite: { nom: client.nom, prenom: client.prenom },
    numero: seance.numero,
    type: seance.type,
    age: Number(seance.date_seance.slice(0, 4)) - client.annee_naissance,
    objectif: seance.objectif,
    tim: seance.tim,
    notes: seance.notes,
    cases: trierCases(seance.cases).map((c) => ({
      zone: c.zone,
      position: c.position,
      emotion: libelleEmotion(c.emotion_id) ?? '?',
    })),
    synthese_precedente: synthesePrecedente,
    problematiques: PROBLEMATIQUES.map(({ code, libelle }) => ({ code, libelle })),
    emotions: EMOTIONS.map((e) => e.libelle),
  };
}

/**
 * La synthèse « précédente » d'une séance est celle produite par la
 * dernière séance ANTÉRIEURE analysée : ré-analyser une séance ne
 * l'intègre donc jamais deux fois.
 */
export function synthesePrecedente(seances: Seance[], numero: number): string | null {
  const precedentes = seances.filter((s) => s.numero < numero && s.analyse_ia).sort((a, b) => b.numero - a.numero);
  return precedentes[0]?.analyse_ia?.synthese ?? null;
}

/** La synthèse du client suit la séance analysée la plus avancée du parcours. */
export function estDerniereAnalysee(seances: Seance[], numero: number): boolean {
  return !seances.some((s) => s.numero > numero && s.analyse_ia);
}

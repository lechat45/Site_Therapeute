// Mise en forme française (dates, nombres, pourcentages, âge) et
// `dateDuJour()` : la date LOCALE du jour, à utiliser partout pour
// « aujourd'hui ».

import type { TypeSeance } from './types';

const fr = 'fr-FR';

export const pourcentage = (x: number | null | undefined, decimales = 0) =>
  x === null || x === undefined
    ? '—'
    : `${(x * 100).toLocaleString(fr, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;

export const nombre = (x: number | null | undefined, decimales = 1) =>
  x === null || x === undefined ? '—' : x.toLocaleString(fr, { maximumFractionDigits: decimales });

const versDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);

export const dateLongue = (iso: string | null | undefined) =>
  iso ? versDate(iso).toLocaleDateString(fr, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const dateCourte = (iso: string | null | undefined) =>
  iso ? versDate(iso).toLocaleDateString(fr, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** « samedi 3 octobre » */
export const jourLisible = (iso: string | null | undefined) =>
  iso ? versDate(iso).toLocaleDateString(fr, { weekday: 'long', day: 'numeric', month: 'long' }) : '—';

export const dateHeure = (iso: string | null | undefined) =>
  iso
    ? versDate(iso).toLocaleString(fr, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Date du jour AAAA-MM-JJ en heure LOCALE. Ne jamais utiliser
 * `toISOString().slice(0, 10)` pour « aujourd'hui » : c'est la date UTC,
 * qui retarde d'un jour en France entre minuit et 1 h ou 2 h du matin.
 */
export function dateDuJour(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Âge (en années pleines, faute de date de naissance complète) à une date donnée. */
export const ageA = (anneeNaissance: number, iso = dateDuJour()) => Number(iso.slice(0, 4)) - anneeNaissance;

export const LIBELLE_TYPE: Record<TypeSeance, string> = {
  initiale: 'Initiale',
  bilan: 'Bilan',
  supplementaire: 'Supplémentaire',
};

export const titreSeance = (numero: number, type: TypeSeance) =>
  type === 'bilan' ? `Séance ${numero} · Bilan` : `Séance ${numero}`;

export const initiales = (prenom: string, nom: string) =>
  `${prenom.trim()[0] ?? ''}${nom.trim()[0] ?? ''}`.toUpperCase();

export const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const messageErreur = (e: unknown) =>
  e instanceof Error && e.message ? e.message : 'Une erreur inattendue est survenue.';

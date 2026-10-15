// `donnees` : LA porte d'accès aux données pour toute l'application.
// Choisit la source (Supabase ou démo) selon les variables VITE_SUPABASE_*.

import type { SourceDonnees } from './source';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Supabase si les variables d'environnement sont renseignées, sinon mode
 * démo. Chargement à la demande : la production ne télécharge ni le jeu de
 * données fictif, ni la démo ; la démo ne télécharge pas supabase-js.
 */
export const donnees: SourceDonnees =
  url && cle ? new (await import('./supabase')).SourceSupabase(url, cle) : new (await import('./demo')).SourceDemo();

export { ErreurDonnees } from './source';
export type { SourceDonnees } from './source';

// Session du thérapeute connecté : connexion, double authentification,
// déconnexion. `useTherapeute()` dans tout composant de l'espace connecté.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { donnees } from '../donnees';
import type { Therapeute } from '../domaine/types';
import { activiteExpiree, marquerActivite } from './inactivite';
import { viderCache } from './useChargement';

interface ContexteSession {
  /** `undefined` pendant la vérification initiale de la session. */
  therapeute: Therapeute | null | undefined;
  ouvrir: (t: Therapeute) => void;
  fermer: () => Promise<void>;
}

const Contexte = createContext<ContexteSession | null>(null);

/**
 * Posé par l'écran de connexion (sessionStorage) : la structure redirige
 * alors une fois vers la page d'ouverture choisie dans les paramètres.
 */
export const DRAPEAU_ACCUEIL = 'suivi-therapeutique:aller-accueil';

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [therapeute, setTherapeute] = useState<Therapeute | null | undefined>(undefined);

  useEffect(() => {
    donnees.sessionCourante().then(
      async (t) => {
        // Session restaurée après une trop longue inactivité (onglet rouvert,
        // « rester connecté ») : on la ferme avant d'afficher quoi que ce soit.
        if (t && activiteExpiree()) {
          await donnees.deconnexion().catch(() => {});
          return setTherapeute(null);
        }
        setTherapeute(t);
      },
      () => setTherapeute(null),
    );
  }, []);

  const valeur = useMemo<ContexteSession>(
    () => ({
      therapeute,
      ouvrir: (t) => {
        // changement de compte : rien de l'ancien ne doit rester en mémoire
        if (t.id !== therapeute?.id) viderCache();
        marquerActivite();
        setTherapeute(t);
      },
      fermer: async () => {
        await donnees.deconnexion();
        viderCache();
        setTherapeute(null);
      },
    }),
    [therapeute],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession() {
  const c = useContext(Contexte);
  if (!c) throw new Error('useSession hors de FournisseurSession');
  return c;
}

/** À utiliser sous une route protégée : la session y est garantie. */
export function useTherapeute(): Therapeute {
  const { therapeute } = useSession();
  if (!therapeute) throw new Error('Aucune session');
  return therapeute;
}

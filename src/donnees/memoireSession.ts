// « Rester connecté sur cet appareil » : sans cette option, la session ne
// vit que dans l'onglet (sessionStorage) et disparaît à sa fermeture. Avec,
// elle est aussi gardée dans localStorage, au plus 8 heures après la
// connexion (pour un appareil personnel seulement).
//
// Sert de `storage` à supabase-js et de stockage de session au mode démo.

const CLE_FIN = 'suivi-therapeutique:rester-connecte-jusqua';
export const DUREE_MEMOIRE_MS = 8 * 3_600_000;

/** Le stockage peut être bloqué (navigation privée, réglages) : on continue sans. */
function sur<T>(f: () => T, defaut: T): T {
  try {
    return f();
  } catch {
    return defaut;
  }
}

const finMemoire = () => Number(sur(() => localStorage.getItem(CLE_FIN), null)) || 0;

/** À appeler AVANT la connexion : décide où la session sera écrite. */
export function memoriserSession(oui: boolean) {
  sur(
    () =>
      oui ? localStorage.setItem(CLE_FIN, String(Date.now() + DUREE_MEMOIRE_MS)) : localStorage.removeItem(CLE_FIN),
    undefined,
  );
}

export const stockageSession = {
  getItem(cle: string): string | null {
    const onglet = sur(() => sessionStorage.getItem(cle), null);
    if (onglet !== null) return onglet;
    if (finMemoire() <= Date.now()) {
      // délai écoulé : on oublie la session gardée sur l'appareil
      sur(() => localStorage.removeItem(cle), undefined);
      memoriserSession(false);
      return null;
    }
    return sur(() => localStorage.getItem(cle), null);
  },
  setItem(cle: string, valeur: string) {
    sur(() => sessionStorage.setItem(cle, valeur), undefined);
    if (finMemoire() > Date.now()) sur(() => localStorage.setItem(cle, valeur), undefined);
  },
  removeItem(cle: string) {
    sur(() => sessionStorage.removeItem(cle), undefined);
    sur(() => localStorage.removeItem(cle), undefined);
  },
};

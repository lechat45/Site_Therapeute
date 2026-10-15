// Petits morceaux du mode démo utilisés par les écrans. Séparés de demo.ts
// pour que la version de production ne charge pas le jeu de données fictif.

export const CLE_GEMINI = 'suivi-therapeutique:demo:cle-gemini';
export const EMAIL_DEMO = 'demo@exemple.fr';
export const MOT_DE_PASSE_DEMO = 'demo';

/** Clé Gemini collée par l'utilisateur de la démo : gardée dans l'onglet seulement. */
export const cleGeminiDemo = {
  lire(): string | null {
    try {
      return sessionStorage.getItem(CLE_GEMINI);
    } catch {
      return null;
    }
  },
  ecrire(cle: string | null) {
    try {
      if (cle?.trim()) sessionStorage.setItem(CLE_GEMINI, cle.trim());
      else sessionStorage.removeItem(CLE_GEMINI);
    } catch {
      /* stockage indisponible */
    }
  },
};

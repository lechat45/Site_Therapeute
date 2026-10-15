// Paramètres du thérapeute connecté, et thème (couleur + nom du site)
// appliqué à toute l'interface.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Chargement } from '../composants/Commun';
import { PARAMETRES_PAR_DEFAUT } from '../config/parametresDefaut';
import { donnees } from '../donnees';
import type { Parametres } from '../domaine/types';

const CLE_THEME = 'suivi-therapeutique:theme';
const CLE_AFFICHAGE = 'suivi-therapeutique:affichage';

type Affichage = Pick<Parametres, 'taille_texte' | 'densite' | 'vision' | 'reduire_animations'>;

/**
 * Préférences d'affichage → attributs de <html>, lus par
 * styles/accessibilite.css (taille du texte, densité, vision des couleurs,
 * animations). Mémorisées pour l'écran de connexion de cet appareil.
 */
export function appliquerAffichage(a: Affichage, memoriser = true) {
  const html = document.documentElement;
  html.dataset.taille = a.taille_texte;
  html.dataset.densite = a.densite;
  html.dataset.vision = a.vision;
  html.dataset.animations = a.reduire_animations ? 'reduites' : 'normales';
  if (memoriser)
    try {
      // Uniquement ces quatre réglages : rien de personnel dans le stockage local.
      const { taille_texte, densite, vision, reduire_animations } = a;
      localStorage.setItem(CLE_AFFICHAGE, JSON.stringify({ taille_texte, densite, vision, reduire_animations }));
    } catch {
      /* stockage indisponible */
    }
}

export function affichageMemorise(): Affichage {
  const defaut: Affichage = {
    taille_texte: PARAMETRES_PAR_DEFAUT.taille_texte,
    densite: PARAMETRES_PAR_DEFAUT.densite,
    vision: PARAMETRES_PAR_DEFAUT.vision,
    reduire_animations: PARAMETRES_PAR_DEFAUT.reduire_animations,
  };
  try {
    return { ...defaut, ...JSON.parse(localStorage.getItem(CLE_AFFICHAGE) ?? '{}') };
  } catch {
    return defaut;
  }
}

/** Toutes les nuances de l'interface dérivent de `--marque` (voir styles.css). */
export function appliquerTheme(couleur: string, nomSite: string, memoriser = true) {
  document.documentElement.style.setProperty('--marque', couleur);
  document.title = nomSite;
  if (memoriser)
    try {
      localStorage.setItem(CLE_THEME, JSON.stringify({ couleur, nomSite }));
    } catch {
      /* stockage indisponible */
    }
}

/** Dernier thème utilisé sur cet appareil (pour l'écran de connexion). */
export function themeMemorise(): { couleur: string; nomSite: string } {
  try {
    const t = JSON.parse(localStorage.getItem(CLE_THEME) ?? 'null');
    if (t?.couleur && t?.nomSite) return t;
  } catch {
    /* rien */
  }
  return { couleur: PARAMETRES_PAR_DEFAUT.couleur, nomSite: PARAMETRES_PAR_DEFAUT.nom_site };
}

// --- contraste ---------------------------------------------------------------
const lineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
}
const melangerNoir = (hex: string, part: number) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * part)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/**
 * Contraste, sur fond blanc, de la teinte qui porte les boutons et les
 * liens (`--violet-700` = couleur mêlée à 14 % de noir). Il faut au moins
 * 4,5:1 pour que le texte reste lisible.
 */
export function contrasteAccent(couleur: string): number {
  const l = luminance(melangerNoir(couleur, 0.86));
  return 1.05 / (l + 0.05);
}

export const COULEURS_PROPOSEES: { nom: string; valeur: string }[] = [
  { nom: 'Violet', valeur: '#7436e6' },
  { nom: 'Prune', valeur: '#9b2c8a' },
  { nom: 'Indigo', valeur: '#4f46e5' },
  { nom: 'Bleu', valeur: '#2563eb' },
  { nom: 'Sarcelle', valeur: '#0f766e' },
  { nom: 'Vert', valeur: '#15803d' },
  { nom: 'Terre', valeur: '#b45309' },
  { nom: 'Rose', valeur: '#db2777' },
];

// --- contexte ---------------------------------------------------------------
interface ContexteReglages {
  parametres: Parametres;
  enregistrer: (champs: Partial<Parametres>) => Promise<void>;
}

const Contexte = createContext<ContexteReglages | null>(null);

export function FournisseurReglages({ children }: { children: ReactNode }) {
  const [parametres, setParametres] = useState<Parametres | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    donnees.parametres().then(setParametres, () => {
      setParametres({ ...PARAMETRES_PAR_DEFAUT });
      setErreur(true);
    });
  }, []);

  // Thème et affichage suivent les paramètres enregistrés.
  const couleur = parametres?.couleur;
  const nomSite = parametres?.nom_site;
  useEffect(() => {
    if (couleur && nomSite) appliquerTheme(couleur, nomSite);
  }, [couleur, nomSite]);
  const affichage = parametres
    ? JSON.stringify([parametres.taille_texte, parametres.densite, parametres.vision, parametres.reduire_animations])
    : null;
  useEffect(() => {
    // volontairement déclenché par les seules préférences d'affichage
    if (parametres) appliquerAffichage(parametres);
  }, [affichage]);

  const enregistrer = useCallback(async (champs: Partial<Parametres>) => {
    setParametres(await donnees.enregistrerParametres(champs));
  }, []);

  if (!parametres) return <Chargement texte="Ouverture de votre espace…" />;
  if (erreur) console.warn('Paramètres indisponibles : valeurs par défaut utilisées.');
  return <Contexte.Provider value={{ parametres, enregistrer }}>{children}</Contexte.Provider>;
}

export function useReglages() {
  const c = useContext(Contexte);
  if (!c) throw new Error('useReglages hors de FournisseurReglages');
  return c;
}

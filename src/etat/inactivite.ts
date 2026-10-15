// Déconnexion après une période d'inactivité (réglable), partagée entre
// onglets par localStorage, avec un avertissement une minute avant.

import { useEffect, useRef, useState } from 'react';

const EVENEMENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
const PREAVIS_MS = 60_000;
/** Dernière activité, partagée entre onglets : { le, minutes } (aucune donnée personnelle). */
const CLE_ACTIVITE = 'suivi-therapeutique:derniere-activite';

interface Activite {
  le: number;
  minutes: number;
}

function lireActivite(): Activite | null {
  try {
    const a = JSON.parse(localStorage.getItem(CLE_ACTIVITE) ?? 'null') as Activite | null;
    return a && Number.isFinite(a.le) && Number.isFinite(a.minutes) ? a : null;
  } catch {
    return null;
  }
}

function ecrireActivite(a: Activite) {
  try {
    localStorage.setItem(CLE_ACTIVITE, JSON.stringify(a));
  } catch {
    /* stockage indisponible : la minuterie de l'onglet suffit */
  }
}

/** À la connexion : repart de zéro. */
export function marquerActivite() {
  ecrireActivite({ le: Date.now(), minutes: lireActivite()?.minutes ?? 30 });
}

/**
 * Vrai si la session restaurée (rechargement, autre onglet, « rester
 * connecté ») a dépassé le délai d'inactivité : il faut se reconnecter.
 */
export function activiteExpiree(maintenant = Date.now()): boolean {
  const a = lireActivite();
  return a !== null && maintenant - a.le >= a.minutes * 60_000;
}

/**
 * Déconnexion automatique après `minutes` sans activité (données de santé,
 * appareil parfois partagé). Un avertissement s'affiche une minute avant.
 * L'activité de n'importe quel onglet compte.
 */
export function useInactivite(minutes: number, expirer: () => void) {
  const [avertissement, setAvertissement] = useState(false);
  const derniere = useRef(Date.now());
  const expirerRef = useRef(expirer);
  expirerRef.current = expirer;

  useEffect(() => {
    // une session expirée a déjà été fermée par FournisseurSession (activiteExpiree)
    derniere.current = Date.now();
    ecrireActivite({ le: derniere.current, minutes });
    let ecrite = derniere.current;
    const activite = () => {
      derniere.current = Date.now();
      setAvertissement(false);
      // au plus une écriture toutes les 10 s
      if (derniere.current - ecrite > 10_000) {
        ecrite = derniere.current;
        ecrireActivite({ le: ecrite, minutes });
      }
    };
    for (const e of EVENEMENTS) window.addEventListener(e, activite, { passive: true });
    const minuterie = setInterval(() => {
      const ecoule = Date.now() - Math.max(derniere.current, lireActivite()?.le ?? 0);
      if (ecoule >= minutes * 60_000) expirerRef.current();
      else if (ecoule >= minutes * 60_000 - PREAVIS_MS) setAvertissement(true);
      else setAvertissement(false);
    }, 5_000);
    return () => {
      for (const e of EVENEMENTS) window.removeEventListener(e, activite);
      clearInterval(minuterie);
    };
  }, [minutes]);

  return avertissement;
}

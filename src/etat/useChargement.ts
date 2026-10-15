// Hook de chargement asynchrone (`donnees`, `erreur`, `chargement`,
// `recharger`), avec un cache mémoire facultatif par clé pour réafficher
// tout de suite un écran déjà visité.

import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { messageErreur } from '../domaine/format';

interface Etat<T> {
  donnees?: T;
  erreur?: string;
  chargement: boolean;
}

// Dernières données connues, par clé, EN MÉMOIRE seulement (jamais sur
// disque) : un écran déjà visité s'affiche tout de suite, puis se met à
// jour. Vidé à la déconnexion et au changement de compte.
const cache = new Map<string, unknown>();

export function viderCache() {
  cache.clear();
}

/**
 * Charge une ressource asynchrone ; `recharger()` relance le chargement.
 * Avec `cle`, l'écran affiche d'abord les données déjà connues
 * (`chargement` reste vrai pendant la mise à jour).
 */
export function useChargement<T>(charger: () => Promise<T>, deps: DependencyList, cle?: string) {
  const [etat, setEtat] = useState<Etat<T>>(() =>
    cle && cache.has(cle) ? { donnees: cache.get(cle) as T, chargement: true } : { chargement: true },
  );
  const [jeton, setJeton] = useState(0);

  useEffect(() => {
    let actif = true;
    setEtat((e) =>
      cle && cache.has(cle)
        ? { donnees: cache.get(cle) as T, chargement: true }
        : { ...e, chargement: true, erreur: undefined },
    );
    charger().then(
      (donnees) => {
        if (cle) cache.set(cle, donnees);
        if (actif) setEtat({ donnees, chargement: false });
      },
      (e) => actif && setEtat((x) => ({ donnees: x.donnees, erreur: messageErreur(e), chargement: false })),
    );
    return () => {
      actif = false;
    };
    // `charger` change à chaque rendu : seules `deps`, `cle` et `jeton` relancent le chargement.
  }, [...deps, cle, jeton]);

  const recharger = useCallback(() => setJeton((j) => j + 1), []);
  const remplacer = useCallback(
    (donnees: T) => {
      if (cle) cache.set(cle, donnees);
      setEtat({ donnees, chargement: false });
    },
    [cle],
  );
  return { ...etat, recharger, remplacer };
}

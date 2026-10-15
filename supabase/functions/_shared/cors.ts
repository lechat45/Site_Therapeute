// En-têtes CORS de la fonction Edge : seules les adresses du site sont
// acceptées. Sans réglage, seul le serveur de développement local l'est :
// une mise en production sans ORIGINE_AUTORISEE échoue donc visiblement
// au lieu d'ouvrir la fonction à n'importe quel site.

export const ORIGINES_DEVELOPPEMENT = ['http://localhost:5190', 'http://127.0.0.1:5190'];

const ENTETES = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

/** `ORIGINE_AUTORISEE` : une ou plusieurs adresses séparées par des virgules (« * » = toutes, déconseillé). */
export function originesAutorisees(valeur: string | undefined): string[] {
  const liste = (valeur ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return liste.length ? liste : ORIGINES_DEVELOPPEMENT;
}

/**
 * En-têtes à renvoyer, ou `null` si l'origine est refusée. Une requête sans
 * en-tête `Origin` ne vient pas d'un navigateur : rien à autoriser.
 */
export function entetesCors(origine: string | null, autorisees: string[]): Record<string, string> | null {
  if (!origine) return { ...ENTETES };
  if (!autorisees.includes('*') && !autorisees.includes(origine)) return null;
  return { ...ENTETES, 'Access-Control-Allow-Origin': origine };
}

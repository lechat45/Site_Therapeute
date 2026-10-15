// Outils de sécurité utilisés par le mode démo (en production, Supabase
// Auth et Postgres s'en chargent) : codes à usage unique (TOTP, RFC 6238),
// jetons de lien, description de l'appareil pour le journal.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(octets: Uint8Array): string {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      sortie += B32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += B32[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function depuisBase32(texte: string): Uint8Array {
  const propre = texte.replace(/[\s=]/g, '').toUpperCase();
  const octets: number[] = [];
  let bits = 0;
  let valeur = 0;
  for (const c of propre) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('Clé invalide.');
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(octets);
}

export const genererSecretTotp = () => base32(crypto.getRandomValues(new Uint8Array(20)));

/** Code TOTP (HMAC-SHA1, pas de 30 s) pour un instant donné, en millisecondes. */
export async function codeTotp(secret: string, instant = Date.now(), chiffres = 6): Promise<string> {
  const compteur = Math.floor(instant / 1000 / 30);
  const message = new Uint8Array(8);
  new DataView(message.buffer).setBigUint64(0, BigInt(compteur));
  const cle = await crypto.subtle.importKey(
    'raw',
    depuisBase32(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', cle, message));
  const decalage = h[h.length - 1] & 15;
  const nombre = ((h[decalage] & 127) << 24) | (h[decalage + 1] << 16) | (h[decalage + 2] << 8) | h[decalage + 3];
  return String(nombre % 10 ** chiffres).padStart(chiffres, '0');
}

/** Accepte le code courant et ses voisins immédiats (décalage d'horloge). */
export async function verifierTotp(secret: string, code: string, instant = Date.now()): Promise<boolean> {
  const saisi = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(saisi)) return false;
  for (const pas of [0, -1, 1]) if ((await codeTotp(secret, instant + pas * 30_000)) === saisi) return true;
  return false;
}

export const uriOtpauth = (secret: string, compte: string, emetteur: string) =>
  `otpauth://totp/${encodeURIComponent(`${emetteur}:${compte}`)}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=6&period=30`;

/** Jeton de lien : 256 bits aléatoires, en hexadécimal (64 caractères). */
export function genererJeton(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((o) => o.toString(16).padStart(2, '0')).join('');
}

export async function empreinteJeton(jeton: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton));
  return [...new Uint8Array(h)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/** « Chrome · Windows », « Safari · iPad »… pour le journal des connexions. */
export function decrireAppareil(ua = globalThis.navigator?.userAgent ?? ''): string {
  const navigateur = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navigateur';
  const systeme = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? 'Android (téléphone)'
          : 'Android (tablette)'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'appareil inconnu';
  return `${navigateur} · ${systeme}`;
}

/** Règle de mot de passe commune aux deux modes. */
export const LONGUEUR_MOT_DE_PASSE = 10;
export function problemeMotDePasse(mdp: string): string | null {
  if (mdp.length < LONGUEUR_MOT_DE_PASSE) return `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`;
  if (!/[a-zA-Z]/.test(mdp) || !/[^a-zA-Z]/.test(mdp)) return 'Mélangez lettres et chiffres ou symboles.';
  return null;
}

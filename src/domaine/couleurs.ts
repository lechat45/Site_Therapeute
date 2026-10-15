// Couleurs lisibles par tous : simulation des trois daltonismes (Machado,
// Oliveira & Fernandes 2009, sévérité maximale) et écart perceptuel dans
// l'espace OKLab (×100). Sert à vérifier les couleurs de l'emploi du temps,
// y compris celles que le thérapeute choisit lui-même.
//
// Repères (mêmes seuils que l'outil de validation des palettes) :
//   écart < 8 sous un daltonisme  → couleurs confondues pour ces personnes ;
//   écart < 15 en vision normale   → couleurs trop proches pour tout le monde.

export type Daltonisme = 'protan' | 'deutan' | 'tritan';

export const SEUIL_DALTONISME = 8;
export const SEUIL_VISION_NORMALE = 15;

export const NOMS_DALTONISME: Record<Daltonisme | 'normale', string> = {
  protan: 'daltonisme rouge (protanopie)',
  deutan: 'daltonisme vert (deutéranopie)',
  tritan: 'daltonisme bleu-jaune (tritanopie)',
  normale: 'vision normale',
};

const MACHADO: Record<Daltonisme, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export const estCouleur = (x: string) => /^#[0-9a-f]{6}$/i.test(x);

const versLineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lineaire = (hex: string) => [1, 3, 5].map((i) => versLineaire(parseInt(hex.slice(i, i + 2), 16) / 255));

function oklab([r, g, b]: number[]): number[] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function simuler(hex: string, d?: Daltonisme): number[] {
  const rgb = lineaire(hex);
  if (!d) return rgb;
  const borne = (x: number) => Math.max(0, Math.min(1, x));
  return MACHADO[d].map((ligne) => borne(ligne[0] * rgb[0] + ligne[1] * rgb[1] + ligne[2] * rgb[2]));
}

/** Écart perceptuel ×100 entre deux couleurs, telles que les voit une personne daltonienne (ou non). */
export function ecart(a: string, b: string, d?: Daltonisme): number {
  const x = oklab(simuler(a, d));
  const y = oklab(simuler(b, d));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = lineaire(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [clair, fonce] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (clair + 0.05) / (fonce + 0.05);
}

export interface Confusion<C extends string> {
  a: C;
  b: C;
  vision: Daltonisme | 'normale';
  ecart: number;
}

/** Paires de couleurs difficiles à distinguer (la pire vision pour chaque paire). */
export function confusions<C extends string>(couleurs: Record<C, string>): Confusion<C>[] {
  const cles = Object.keys(couleurs) as C[];
  const resultat: Confusion<C>[] = [];
  for (let i = 0; i < cles.length; i++)
    for (let j = i + 1; j < cles.length; j++) {
      const [a, b] = [cles[i], cles[j]];
      const normale = ecart(couleurs[a], couleurs[b]);
      if (normale < SEUIL_VISION_NORMALE) {
        resultat.push({ a, b, vision: 'normale', ecart: normale });
        continue;
      }
      const pire = (['protan', 'deutan', 'tritan'] as const)
        .map((d) => ({ d, e: ecart(couleurs[a], couleurs[b], d) }))
        .sort((p, q) => p.e - q.e)[0];
      if (pire.e < SEUIL_DALTONISME) resultat.push({ a, b, vision: pire.d, ecart: pire.e });
    }
  return resultat;
}

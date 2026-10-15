// Structure de la fiche papier : chaque case de la feuille est une
// « zone » et une « position ». SOURCE UNIQUE, importée par l'application,
// la fonction Edge et les tests. La contrainte `check` de la table
// `seance_cases` (migration) doit rester alignée : un test le vérifie.
//
//        Émotion Temps Présent (1)          │        Émotion Temps Présent (2)
//        [ haut 1 | haut 2 ]                │        [ haut 1 | haut 2 ]
//          [pile 1] ↓↑                      │               ↓↑
//          …  (9 cases)                     │        [    bas     ]
//          [pile 9]                         │  3ième Génération : [1][2][3][4]
//        [     bas      ]                   │  2ième Génération : [1][2][3][4]
//  Père [ ] Naissance / Conception … [ ] Mère│        [   notes de séance   ]

export type ZoneFiche =
  | 'present1_haut'
  | 'present1_pile'
  | 'present1_bas'
  | 'present2_haut'
  | 'present2_bas'
  | 'naissance'
  | 'conception'
  | 'generation_1'
  | 'generation_2'
  | 'generation_3'
  | 'grille_generation_3'
  | 'grille_generation_2';

export interface DefinitionZone {
  zone: ZoneFiche;
  libelle: string;
  cases: number;
  /** Compte dans les statistiques d'apparition des émotions. */
  tempsPresent: boolean;
}

export const ZONES: DefinitionZone[] = [
  { zone: 'present1_haut', libelle: 'Émotion temps présent (1), en-tête', cases: 2, tempsPresent: true },
  { zone: 'present1_pile', libelle: 'Émotion temps présent (1), empilement', cases: 9, tempsPresent: true },
  { zone: 'present1_bas', libelle: 'Émotion temps présent (1), case du bas', cases: 1, tempsPresent: true },
  { zone: 'present2_haut', libelle: 'Émotion temps présent (2), en-tête', cases: 2, tempsPresent: true },
  { zone: 'present2_bas', libelle: 'Émotion temps présent (2), case du bas', cases: 1, tempsPresent: true },
  // Suivi croisé : position 1 = Père, position 2 = Mère
  { zone: 'naissance', libelle: 'Naissance', cases: 2, tempsPresent: false },
  { zone: 'conception', libelle: 'Conception', cases: 2, tempsPresent: false },
  { zone: 'generation_1', libelle: '1ère Génération', cases: 2, tempsPresent: false },
  { zone: 'generation_2', libelle: '2ième Génération', cases: 2, tempsPresent: false },
  { zone: 'generation_3', libelle: '3ième Génération', cases: 2, tempsPresent: false },
  { zone: 'grille_generation_3', libelle: '3ième Génération (4 cases)', cases: 4, tempsPresent: false },
  { zone: 'grille_generation_2', libelle: '2ième Génération (4 cases)', cases: 4, tempsPresent: false },
];

export const ZONES_CROISEES: ZoneFiche[] = ['naissance', 'conception', 'generation_1', 'generation_2', 'generation_3'];
export const POSITION_PERE = 1;
export const POSITION_MERE = 2;
export const ZONES_TEMPS_PRESENT: ZoneFiche[] = ZONES.filter((z) => z.tempsPresent).map((z) => z.zone);

const ORDRE = new Map(ZONES.map((z, i) => [z.zone, i]));
export const zone = (z: string) => ZONES.find((x) => x.zone === z);

/** Tri dans l'ordre de lecture de la feuille. */
export function trierCases<T extends { zone: string; position: number }>(cases: T[]): T[] {
  return [...cases].sort(
    (a, b) =>
      (ORDRE.get(a.zone as ZoneFiche) ?? 99) - (ORDRE.get(b.zone as ZoneFiche) ?? 99) || a.position - b.position,
  );
}

/** Cases « Émotion temps présent », dans l'ordre de lecture. */
export function casesTempsPresent<T extends { zone: string; position: number }>(cases: T[]): T[] {
  return trierCases(cases.filter((c) => ZONES_TEMPS_PRESENT.includes(c.zone as ZoneFiche)));
}

/** Description textuelle de la feuille (pour l'IA). Les cases vides sont notées « — ». */
export function decrireFiche(cases: { zone: string; position: number; emotion: string }[]): string {
  const v = (z: ZoneFiche, p: number) => cases.find((c) => c.zone === z && c.position === p)?.emotion ?? '—';
  const remplie = (z: ZoneFiche) => cases.some((c) => c.zone === z);
  const lignes: string[] = [];

  const pile = trierCases(cases.filter((c) => c.zone === 'present1_pile')).map((c) => c.emotion);
  if (remplie('present1_haut') || pile.length || remplie('present1_bas'))
    lignes.push(
      `Émotion temps présent (1) : en-tête ${v('present1_haut', 1)} | ${v('present1_haut', 2)} ; ` +
        `empilement ${pile.join(' → ') || '—'} ; case du bas ${v('present1_bas', 1)}`,
    );
  if (remplie('present2_haut') || remplie('present2_bas'))
    lignes.push(
      `Émotion temps présent (2) : en-tête ${v('present2_haut', 1)} | ${v('present2_haut', 2)} ; case du bas ${v('present2_bas', 1)}`,
    );

  const croises = ZONES_CROISEES.filter(remplie).map(
    (z) => `- ${zone(z)!.libelle} : Père ${v(z, POSITION_PERE)}, Mère ${v(z, POSITION_MERE)}`,
  );
  if (croises.length) lignes.push(`Suivi croisé Père / Mère :\n${croises.join('\n')}`);

  for (const z of ['grille_generation_3', 'grille_generation_2'] as const)
    if (remplie(z)) lignes.push(`${zone(z)!.libelle} : ${[1, 2, 3, 4].map((p) => v(z, p)).join(', ')}`);

  return lignes.join('\n') || '—';
}

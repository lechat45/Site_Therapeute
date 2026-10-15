// Emploi du temps : calculs purs (semaines, disposition des rendez-vous qui
// se chevauchent, conflits, catégorie suggérée). Les dates « AAAA-MM-JJ »
// sont des jours LOCAUX ; les rendez-vous sont des horodatages ISO.

import { dateDuJour } from './format';
import type { CategorieRdv, Parametres, RendezVous } from './types';

const JOUR_MS = 86_400_000;

/** Jour local (AAAA-MM-JJ) d'un horodatage. */
export const jourDe = (iso: string) => dateDuJour(new Date(iso));

/** Ajoute des jours à une date locale AAAA-MM-JJ (sans dérive à l'heure d'été). */
export function decalerJour(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  return dateDuJour(new Date(a, m - 1, j + n));
}

/** 1 = lundi … 7 = dimanche. */
export function jourSemaine(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number);
  return ((new Date(a, m - 1, j).getDay() + 6) % 7) + 1;
}

/** Lundi de la semaine du jour donné. */
export const lundiDe = (jour: string) => decalerJour(jour, 1 - jourSemaine(jour));

/** Horodatage ISO d'un jour local et d'une heure locale « HH:MM ». */
export function horodatage(jour: string, heure: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  const [h, min] = heure.split(':').map(Number);
  return new Date(a, m - 1, j, h, min).toISOString();
}

/** « HH:MM » local d'un horodatage. */
export function heureDe(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minutes écoulées depuis minuit (heure locale). */
export function minutesDe(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export const dureeMinutes = (r: Pick<RendezVous, 'debut' | 'fin'>) =>
  Math.round((Date.parse(r.fin) - Date.parse(r.debut)) / 60_000);

/** « 14 h 30 », lisible à voix haute (lecteurs d'écran, messages). */
export function heureLisible(iso: string): string {
  const [h, m] = heureDe(iso).split(':');
  return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`;
}

/** Rendez-vous d'une plage [de, a[ (horodatages), triés. */
export function dansPlage<T extends Pick<RendezVous, 'debut'>>(rdv: T[], de: string, a: string): T[] {
  return rdv.filter((r) => r.debut >= de && r.debut < a).sort((x, y) => x.debut.localeCompare(y.debut));
}

/**
 * Disposition des rendez-vous d'une journée qui se chevauchent : chacun
 * reçoit une colonne et le nombre de colonnes de son groupe (largeur =
 * 1 / colonnes). Les rendez-vous annulés comptent aussi (ils restent visibles).
 * Les horodatages doivent être au même format (`toISOString()`).
 */
export function disposer(
  rdv: Pick<RendezVous, 'id' | 'debut' | 'fin'>[],
): Map<string, { colonne: number; colonnes: number }> {
  const tries = [...rdv].sort((a, b) => a.debut.localeCompare(b.debut) || b.fin.localeCompare(a.fin));
  const place = new Map<string, { colonne: number; colonnes: number }>();
  let groupe: { id: string; colonne: number }[] = [];
  let finGroupe = '';
  let finsColonnes: string[] = [];
  const clore = () => {
    const n = finsColonnes.length;
    for (const g of groupe) place.set(g.id, { colonne: g.colonne, colonnes: n });
    groupe = [];
    finsColonnes = [];
  };
  for (const r of tries) {
    if (groupe.length && r.debut >= finGroupe) clore();
    let colonne = finsColonnes.findIndex((f) => f <= r.debut);
    if (colonne === -1) colonne = finsColonnes.push(r.fin) - 1;
    else finsColonnes[colonne] = r.fin;
    groupe.push({ id: r.id, colonne });
    if (r.fin > finGroupe) finGroupe = r.fin;
  }
  clore();
  return place;
}

/** Rendez-vous (non annulés) qui chevauchent le créneau [debut, fin[. */
export function conflits<T extends Pick<RendezVous, 'id' | 'debut' | 'fin' | 'statut'>>(
  creneau: { id?: string; debut: string; fin: string },
  rdv: T[],
): T[] {
  const [d, f] = [Date.parse(creneau.debut), Date.parse(creneau.fin)];
  return rdv.filter(
    (r) => r.id !== creneau.id && r.statut !== 'annule' && Date.parse(r.debut) < f && Date.parse(r.fin) > d,
  );
}

/** Catégorie proposée pour un client, selon l'avancement de son parcours. */
export function categorieSuggeree(nbSeances: number): CategorieRdv {
  if (nbSeances === 0) return 'premier';
  if (nbSeances === 3) return 'bilan'; // la 4e séance est le bilan
  return 'seance';
}

/** Les jours affichés d'une semaine : jours de travail, plus ceux qui ont des rendez-vous. */
export function joursAffiches(lundi: string, joursTravail: number[], rdv: Pick<RendezVous, 'debut'>[]): string[] {
  const occupes = new Set(rdv.map((r) => jourDe(r.debut)));
  return Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i)).filter(
    (j, i) => joursTravail.includes(i + 1) || occupes.has(j),
  );
}

/** Heures affichées : les heures de travail, étendues aux rendez-vous qui en débordent. */
export function heuresAffichees(
  debut: number,
  fin: number,
  rdv: Pick<RendezVous, 'debut' | 'fin'>[],
): { debut: number; fin: number } {
  let [d, f] = [debut, fin];
  for (const r of rdv) {
    d = Math.min(d, Math.floor(minutesDe(r.debut) / 60));
    const finR = jourDe(r.fin) > jourDe(r.debut) ? 24 : Math.ceil(minutesDe(r.fin) / 60);
    f = Math.max(f, finR);
  }
  return { debut: d, fin: Math.max(f, d + 1) };
}

/** Nombre de jours entiers entre deux jours locaux. */
export const joursEntre = (de: string, a: string) =>
  Math.round((Date.parse(`${a}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / JOUR_MS);

/** Jour de la semaine (1 = lundi) et heure « HH:MM » où un client vient régulièrement. */
export interface Habitude {
  jour: number;
  heure: string;
  nb: number;
}

/**
 * Habitudes d'un client : jours et heures de ses rendez-vous passés (hors
 * annulés) revenus au moins deux fois, les plus fréquents d'abord.
 */
export function habitudesClient(
  rdv: Pick<RendezVous, 'client_id' | 'debut' | 'statut'>[],
  clientId: string,
  maintenant: Date,
  max = 3,
): Habitude[] {
  const comptes = new Map<string, number>();
  for (const r of rdv) {
    if (r.client_id !== clientId || r.statut === 'annule' || Date.parse(r.debut) >= maintenant.getTime()) continue;
    const cle = `${jourSemaine(jourDe(r.debut))}|${heureDe(r.debut)}`;
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  return [...comptes]
    .filter(([, nb]) => nb >= 2)
    .map(([cle, nb]) => {
      const [jour, heure] = cle.split('|');
      return { jour: Number(jour), heure, nb };
    })
    .sort((a, b) => b.nb - a.nb || a.jour - b.jour || a.heure.localeCompare(b.heure))
    .slice(0, max);
}

export interface Creneau {
  debut: string;
  fin: string;
  /** Au jour et à l'heure habituels du client. */
  habituel: boolean;
}

/**
 * Créneaux libres à proposer à un client (relance) : à partir de demain,
 * sur les jours et heures de travail, sans chevaucher un rendez-vous.
 * D'abord ceux qui tombent à ses habitudes, puis, à l'heure pile, au plus
 * un le matin et un l'après-midi par jour, pour varier. Triés par date.
 */
export function creneauxLibres(
  rdv: Pick<RendezVous, 'id' | 'debut' | 'fin' | 'statut'>[],
  p: Pick<Parametres, 'agenda_heure_debut' | 'agenda_heure_fin' | 'agenda_jours' | 'duree_rdv_minutes'>,
  maintenant: Date,
  { jours = 14, nombre = 6, habitudes = [] }: { jours?: number; nombre?: number; habitudes?: Habitude[] } = {},
): Creneau[] {
  const aujourdhui = dateDuJour(maintenant);
  const duree = p.duree_rdv_minutes * 60_000;
  const creneau = (jour: string, heure: string, habituel: boolean): Creneau | null => {
    const [h, m] = heure.split(':').map(Number);
    if (h * 60 + m < p.agenda_heure_debut * 60 || h * 60 + m + p.duree_rdv_minutes > p.agenda_heure_fin * 60)
      return null;
    const debut = horodatage(jour, heure);
    const fin = new Date(Date.parse(debut) + duree).toISOString();
    return conflits({ debut, fin }, rdv).length ? null : { debut, fin, habituel };
  };
  const jourDeTravail = Array.from({ length: jours }, (_, i) => decalerJour(aujourdhui, i + 1)).filter((j) =>
    p.agenda_jours.includes(jourSemaine(j)),
  );

  const resultat: Creneau[] = [];
  for (const jour of jourDeTravail)
    for (const habitude of habitudes.filter((x) => x.jour === jourSemaine(jour))) {
      const c = creneau(jour, habitude.heure, true);
      if (c && resultat.length < nombre) resultat.push(c);
    }
  for (const jour of jourDeTravail) {
    if (resultat.length >= nombre) break;
    const libres: Creneau[] = [];
    for (let h = p.agenda_heure_debut; h < p.agenda_heure_fin; h++) {
      const c = creneau(jour, `${String(h).padStart(2, '0')}:00`, false);
      if (c && !resultat.some((x) => x.debut === c.debut)) libres.push(c);
    }
    const heure = (c: Creneau) => new Date(c.debut).getHours();
    for (const c of [libres.find((x) => heure(x) < 12), libres.find((x) => heure(x) >= 13)])
      if (c && resultat.length < nombre) resultat.push(c);
  }
  return resultat.sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Phrase à insérer dans un message : « Je peux vous proposer : … ». */
export function texteCreneaux(creneaux: { debut: string; habituel?: boolean }[]): string {
  const lignes = creneaux.map((c) => {
    const jour = new Date(`${jourDe(c.debut)}T12:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return `- ${jour} à ${heureLisible(c.debut)}${c.habituel ? ' (votre créneau habituel)' : ''}`;
  });
  return [
    'Si vous souhaitez reprendre rendez-vous, je peux vous proposer :',
    ...lignes,
    'Dites-moi ce qui vous convient.',
  ].join('\n');
}

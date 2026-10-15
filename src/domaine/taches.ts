// L'onglet « Tâches » : ce que l'application propose au thérapeute de
// faire aujourd'hui. Les tâches se déduisent des données, rien n'est
// stocké en plus.
//
// Relance : à partir de la dernière séance d'un client, la première
// relance est due après `relance_delai_jours`, les suivantes tous les
// `relance_intervalle_jours`, dans la limite de `relance_max`. Une
// nouvelle séance remet le compteur à zéro.
//
// Questionnaire reçu : lu localement (tendance, priorité, faits
// marquants) ; une lecture IA facultative peut reformuler le résumé.
//
// Emploi du temps : rappel à envoyer pour un rendez-vous des 48 h à venir ;
// rendez-vous passé encore « prévu » à compléter (séance faite, absent,
// annulé) pendant 14 jours.

import { lectureLocale, type EnvoiLu } from '../../supabase/functions/_shared/questionnaire.ts';
import { decalerJour, dureeMinutes, horodatage, lundiDe } from './agenda';
import type {
  CanalEnvoi,
  CategorieRdv,
  ClientResume,
  Envoi,
  LectureQuestionnaire,
  Parametres,
  Recurrence,
  Remise,
  RendezVous,
  ReportTache,
  TachePerso,
} from './types';

export type Tache =
  | {
      type: 'relance';
      cle: string;
      client: ClientResume;
      /** Rang de cette relance depuis la dernière séance (1, 2, 3…). */
      rang: number;
      max: number;
      echeance: string;
      retardJours: number;
      canaux: CanalEnvoi[];
      /** Le dernier questionnaire du client appelait une attention particulière. */
      prioritaire: boolean;
    }
  | {
      type: 'questionnaire';
      cle: string;
      client: ClientResume;
      envoi: Envoi;
      /** Lecture IA si elle existe déjà, sinon lecture locale. */
      lecture: LectureQuestionnaire;
    }
  | {
      /** Rendez-vous dans les 48 h : rappel à envoyer (à la main). */
      type: 'rappel';
      cle: string;
      client: ClientResume;
      rdv: RendezVous;
      canaux: CanalEnvoi[];
    }
  | {
      /** Rendez-vous passé resté « prévu » : séance faite, absent ou annulé ? */
      type: 'cloture';
      cle: string;
      client: ClientResume;
      rdv: RendezVous;
    }
  | {
      /** Exercice remis par lien, complété par le client, réponses pas encore lues. */
      type: 'exercice';
      cle: string;
      client: ClientResume;
      remise: Remise;
    }
  | {
      /** Exercice à compléter remis par lien, sans réponse depuis `exercice_rappel_jours`. */
      type: 'rappel_exercice';
      cle: string;
      client: ClientResume;
      remise: Remise;
      joursAttente: number;
    }
  | {
      /** Tâche personnelle du thérapeute, sans échéance ou arrivée à échéance. */
      type: 'perso';
      cle: string;
      tache: TachePerso;
      client: ClientResume | null;
      /** Jours de retard (0 = aujourd'hui) ; `null` sans échéance. */
      retardJours: number | null;
    };

/** Familles de tâches, pour les filtres de l'onglet Tâches. */
export type FamilleTache = 'questionnaires' | 'exercices' | 'relances' | 'agenda' | 'perso';

export function familleTache(t: Tache): FamilleTache {
  if (t.type === 'questionnaire') return 'questionnaires';
  if (t.type === 'exercice' || t.type === 'rappel_exercice') return 'exercices';
  if (t.type === 'relance') return 'relances';
  if (t.type === 'perso') return 'perso';
  return 'agenda';
}

/** Intitulé court d'une tâche (liste des tâches reportées, annonces). */
export function titreTache(t: Tache): string {
  if (t.type === 'perso') return t.tache.titre;
  const nom = `${t.client.prenom} ${t.client.nom}`;
  if (t.type === 'questionnaire') return `Questionnaire reçu de ${nom}`;
  if (t.type === 'exercice') return `Exercice complété par ${nom}`;
  if (t.type === 'rappel_exercice') return `Rappeler l'exercice à ${nom}`;
  if (t.type === 'relance') return `Relancer ${nom}`;
  if (t.type === 'rappel') return `Rappeler le rendez-vous de ${nom}`;
  return `Rendez-vous de ${nom} à compléter`;
}

const HEURE = 3_600_000;
const RAPPEL_AVANT_MS = 48 * HEURE;
const CLOTURE_PENDANT_MS = 14 * 24 * HEURE;

const JOUR = 86_400_000;
export const ajouterJours = (iso: string, jours: number) =>
  new Date(Date.parse(iso.slice(0, 10)) + jours * JOUR).toISOString().slice(0, 10);
export const ecartJours = (de: string, a: string) =>
  Math.round((Date.parse(a.slice(0, 10)) - Date.parse(de.slice(0, 10))) / JOUR);

/** « AAAA-MM-JJ » + n mois, ramené au dernier jour du mois si besoin (31 janvier + 1 mois = 28 février). */
export function ajouterMois(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = (total % 12) + 1;
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${annee}-${String(mois).padStart(2, '0')}-${String(Math.min(j, dernier)).padStart(2, '0')}`;
}

/**
 * Tâche récurrente cochée : échéance de la suivante, première date de la
 * série (base + n semaines ou n mois) postérieure à aujourd'hui. Sans
 * échéance, la série part d'aujourd'hui. Miroir de public.echeance_suivante().
 */
export function echeanceSuivante(echeance: string | null, recurrence: Recurrence, aujourdhui: string): string | null {
  if (recurrence === 'aucune') return null;
  const base = echeance ?? aujourdhui;
  for (let n = 1; ; n++) {
    const date = recurrence === 'semaine' ? ajouterJours(base, 7 * n) : ajouterMois(base, n);
    if (date > aujourdhui) return date;
  }
}

/** Prochaine relance d'un client, ou `null` s'il n'y en a pas (désactivée, plafond atteint…). */
export function prochaineRelance(
  client: ClientResume,
  envois: Envoi[],
  p: Parametres,
): { echeance: string; rang: number } | null {
  if (!p.relances_actives || !client.relances_actives || !client.derniere_seance) return null;
  const depuis = envois
    .filter((e) => e.client_id === client.id && e.envoye_le && e.envoye_le.slice(0, 10) >= client.derniere_seance!)
    .map((e) => e.envoye_le!.slice(0, 10))
    .sort();
  if (depuis.length >= p.relance_max) return null;
  const echeance = depuis.length
    ? ajouterJours(depuis[depuis.length - 1], p.relance_intervalle_jours)
    : ajouterJours(client.derniere_seance, p.relance_delai_jours);
  const reportee =
    client.relance_reportee_au && client.relance_reportee_au > echeance ? client.relance_reportee_au : echeance;
  return { echeance: reportee, rang: depuis.length + 1 };
}

/** Questionnaires remplis d'un client, du plus récent au plus ancien. */
const remplisDe = (envois: Envoi[], clientId: string) =>
  envois
    .filter((e) => e.client_id === clientId && e.reponses && e.repondu_le)
    .sort((a, b) => b.repondu_le!.localeCompare(a.repondu_le!));

const lu = (e: Envoi): EnvoiLu => ({ questions: e.questions, reponses: e.reponses ?? [] });

/** Lecture d'un questionnaire rempli, comparé au précédent du même client. */
export function lireEnvoi(envoi: Envoi, envois: Envoi[]): LectureQuestionnaire {
  if (envoi.analyse_ia) return envoi.analyse_ia;
  const precedent = remplisDe(envois, envoi.client_id).find((e) => e.repondu_le! < envoi.repondu_le!);
  return lectureLocale(lu(envoi), precedent ? lu(precedent) : null);
}

const canauxDe = (c: ClientResume): CanalEnvoi[] => [
  ...(c.email ? (['email'] as const) : []),
  ...(c.telephone ? (['sms'] as const) : []),
];

export function calculerTaches(
  clients: ClientResume[],
  envois: Envoi[],
  p: Parametres,
  aujourdhui: string,
  rendezVous: RendezVous[] = [],
  maintenant: string = new Date().toISOString(),
  tachesPerso: TachePerso[] = [],
  remises: Remise[] = [],
): Tache[] {
  const parId = new Map(clients.map((c) => [c.id, c]));
  const t = Date.parse(maintenant);

  // tâches personnelles : non faites, sans échéance ou échues (les clients de la corbeille sont absents de `clients`)
  const perso: Extract<Tache, { type: 'perso' }>[] = tachesPerso
    .filter((x) => !x.faite_le && (!x.echeance || x.echeance <= aujourdhui) && (!x.client_id || parId.has(x.client_id)))
    .map((x) => ({
      type: 'perso' as const,
      cle: `p-${x.id}`,
      tache: x,
      client: x.client_id ? parId.get(x.client_id)! : null,
      retardJours: x.echeance ? ecartJours(x.echeance, aujourdhui) : null,
    }))
    .sort((a, b) => (b.retardJours ?? -1) - (a.retardJours ?? -1) || a.tache.cree_le.localeCompare(b.tache.cree_le));
  const persoEchues = perso.filter((x) => x.retardJours !== null);
  const persoLibres = perso.filter((x) => x.retardJours === null);

  const rappels: Extract<Tache, { type: 'rappel' }>[] = [];
  const clotures: Extract<Tache, { type: 'cloture' }>[] = [];
  for (const rdv of rendezVous) {
    const client = rdv.client_id ? parId.get(rdv.client_id) : undefined;
    if (!client || rdv.statut !== 'prevu') continue;
    const [debut, fin] = [Date.parse(rdv.debut), Date.parse(rdv.fin)];
    if (debut > t && debut <= t + RAPPEL_AVANT_MS && !rdv.rappel_envoye_le && canauxDe(client).length)
      rappels.push({ type: 'rappel', cle: `rap-${rdv.id}`, client, rdv, canaux: canauxDe(client) });
    if (fin <= t && debut >= t - CLOTURE_PENDANT_MS && !rdv.seance_id && rdv.categorie !== 'administratif')
      clotures.push({ type: 'cloture', cle: `clo-${rdv.id}`, client, rdv });
  }
  rappels.sort((a, b) => a.rdv.debut.localeCompare(b.rdv.debut));
  clotures.sort((a, b) => b.rdv.debut.localeCompare(a.rdv.debut));

  const questionnaires = envois
    .filter((e) => e.repondu_le && !e.consulte_le && parId.has(e.client_id))
    .map((e) => ({
      type: 'questionnaire' as const,
      cle: `q-${e.id}`,
      client: parId.get(e.client_id)!,
      envoi: e,
      lecture: lireEnvoi(e, envois),
    }));

  const exercices: Extract<Tache, { type: 'exercice' }>[] = remises
    .filter((x) => x.repondu_le && !x.consulte_le && parId.has(x.client_id))
    .sort((a, b) => b.repondu_le!.localeCompare(a.repondu_le!))
    .map((remise) => ({ type: 'exercice', cle: `x-${remise.id}`, client: parId.get(remise.client_id)!, remise }));

  // exercices à compléter restés sans réponse (lien encore valable, pas déjà rappelés)
  const rappelsExercices: Extract<Tache, { type: 'rappel_exercice' }>[] =
    p.exercice_rappel_jours > 0
      ? remises
          .filter(
            (x) =>
              x.mode === 'lien' &&
              x.nb_questions > 0 &&
              !x.repondu_le &&
              !x.rappel_le &&
              (!x.expire_le || x.expire_le > maintenant) &&
              parId.has(x.client_id) &&
              ecartJours(x.cree_le, aujourdhui) >= p.exercice_rappel_jours,
          )
          .map((remise) => ({
            type: 'rappel_exercice' as const,
            cle: `xr-${remise.id}`,
            client: parId.get(remise.client_id)!,
            remise,
            joursAttente: ecartJours(remise.cree_le, aujourdhui),
          }))
          .sort((a, b) => b.joursAttente - a.joursAttente)
      : [];

  const relances: Extract<Tache, { type: 'relance' }>[] = [];
  for (const c of clients) {
    const r = prochaineRelance(c, envois, p);
    if (!r || r.echeance > aujourdhui) continue;
    const canaux = canauxDe(c);
    const dernier = remplisDe(envois, c.id)[0];
    relances.push({
      type: 'relance',
      cle: `r-${c.id}-${r.rang}`,
      client: c,
      rang: r.rang,
      max: p.relance_max,
      echeance: r.echeance,
      retardJours: ecartJours(r.echeance, aujourdhui),
      canaux,
      prioritaire: dernier ? lireEnvoi(dernier, envois).priorite === 'haute' : false,
    });
  }

  // Ordre : ce qui demande une attention rapide d'abord.
  const urgents = questionnaires.filter((t) => t.lecture.priorite === 'haute');
  const autres = questionnaires.filter((t) => t.lecture.priorite !== 'haute');
  const parDate = (a: { envoi: Envoi }, b: { envoi: Envoi }) => b.envoi.repondu_le!.localeCompare(a.envoi.repondu_le!);
  relances.sort((a, b) => Number(b.prioritaire) - Number(a.prioritaire) || b.retardJours - a.retardJours);
  return [
    ...urgents.sort(parDate),
    ...clotures,
    ...persoEchues,
    ...rappels,
    ...relances.filter((r) => r.prioritaire),
    ...autres.sort(parDate),
    ...exercices,
    ...relances.filter((r) => !r.prioritaire),
    ...rappelsExercices,
    ...persoLibres,
  ];
}

/**
 * « Plus tard » : une tâche reportée disparaît jusqu'à la date choisie (elle
 * revient ce jour-là). Les reports échus sont ignorés.
 */
export function separerReportees(
  taches: Tache[],
  reports: ReportTache[],
  aujourdhui: string,
): { actives: Tache[]; reportees: { tache: Tache; jusqua: string }[] } {
  const jusqua = new Map(reports.filter((r) => r.jusqua > aujourdhui).map((r) => [r.cle, r.jusqua]));
  return {
    actives: taches.filter((t) => !jusqua.has(t.cle)),
    reportees: taches.filter((t) => jusqua.has(t.cle)).map((t) => ({ tache: t, jusqua: jusqua.get(t.cle)! })),
  };
}

export interface RecapSemaine {
  lundi: string;
  dimanche: string;
  rdv: { total: number; heures: number; parCategorie: Record<CategorieRdv, number> };
  /** Relances qui arrivent à échéance d'ici dimanche (ou déjà dues). */
  relances: { client: ClientResume; echeance: string }[];
  /** Questionnaires envoyés, sans réponse, encore valables. */
  questionnairesEnAttente: number;
  tachesPerso: TachePerso[];
}

/** Récapitulatif de la semaine en cours (du lundi au dimanche). */
export function recapSemaine(
  aujourdhui: string,
  clients: ClientResume[],
  envois: Envoi[],
  rendezVous: RendezVous[],
  tachesPerso: TachePerso[],
  p: Parametres,
  maintenant: string = new Date().toISOString(),
): RecapSemaine {
  const lundi = lundiDe(aujourdhui);
  const dimanche = decalerJour(lundi, 6);
  const [de, a] = [horodatage(lundi, '00:00'), horodatage(decalerJour(lundi, 7), '00:00')];
  const semaine = rendezVous.filter((r) => r.debut >= de && r.debut < a && r.statut !== 'annule');
  const parCategorie = { premier: 0, seance: 0, bilan: 0, administratif: 0, personnel: 0 };
  for (const r of semaine) parCategorie[r.categorie]++;
  const relances = clients
    .map((client) => ({ client, prochaine: prochaineRelance(client, envois, p) }))
    .filter((x) => x.prochaine && x.prochaine.echeance <= dimanche)
    .map((x) => ({ client: x.client, echeance: x.prochaine!.echeance }))
    .sort((x, y) => x.echeance.localeCompare(y.echeance));
  return {
    lundi,
    dimanche,
    rdv: {
      total: semaine.length,
      heures: Math.round((semaine.reduce((s, r) => s + dureeMinutes(r), 0) / 60) * 10) / 10,
      parCategorie,
    },
    relances,
    questionnairesEnAttente: envois.filter((e) => e.envoye_le && !e.repondu_le && e.expire_le > maintenant).length,
    tachesPerso: tachesPerso
      .filter((x) => !x.faite_le && x.echeance && x.echeance <= dimanche)
      .sort((x, y) => x.echeance!.localeCompare(y.echeance!)),
  };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Résumé du jour, en une ligne, pour l'en-tête des tâches et le tableau de bord. */
export function resumeDuJour(taches: Tache[], rdvAujourdhui = 0): string {
  const compte = (type: Tache['type']) => taches.filter((t) => t.type === type).length;
  const q = compte('questionnaire');
  const urgents = taches.filter((t) => t.type === 'questionnaire' && t.lecture.priorite === 'haute').length;
  const clotures = compte('cloture');
  const morceaux = [
    rdvAujourdhui && `${rdvAujourdhui} rendez-vous aujourd'hui`, // « rendez-vous » est invariable
    q &&
      `${pluriel(q, 'questionnaire')} ${q > 1 ? 'reçus' : 'reçu'}${urgents ? ` dont ${urgents} à lire en priorité` : ''}`,
    clotures && `${clotures} rendez-vous ${clotures > 1 ? 'passés' : 'passé'} à compléter`,
    compte('exercice') &&
      `${pluriel(compte('exercice'), 'exercice')} ${compte('exercice') > 1 ? 'complétés' : 'complété'} par vos clients`,
    compte('rappel_exercice') && `${pluriel(compte('rappel_exercice'), 'exercice')} à rappeler`,
    compte('rappel') && `${pluriel(compte('rappel'), 'rappel')} de rendez-vous à envoyer`,
    compte('relance') && `${pluriel(compte('relance'), 'relance')} à envoyer`,
    compte('perso') && `${pluriel(compte('perso'), 'tâche')} ${compte('perso') > 1 ? 'personnelles' : 'personnelle'}`,
  ].filter(Boolean);
  return morceaux.length ? morceaux.join(' · ') : "Rien à faire pour l'instant.";
}

// RGPD (0.13.0), logique pure (tests/rgpd.test.ts) :
//  - exportClient : toutes les données d'un client, lisibles, pour son droit d'accès et
//    de portabilité (article 15 et 20) ; jamais de jeton ni d'identifiant de thérapeute ;
//  - exportComplet : toutes les données du thérapeute (portabilité) ;
//  - fichesARevoir : fiches au-delà de la durée de conservation (config/rgpd.ts).

import { EMOTIONS, PROBLEMATIQUES } from '../config/referentiels';
import { decalerJour } from './agenda';
import type {
  Client,
  ClientProblematique,
  ClientResume,
  Connexion,
  Envoi,
  Note,
  Parametres,
  Questionnaire,
  Recu,
  Remise,
  RendezVous,
  Ressource,
  Seance,
  TachePerso,
  Therapeute,
} from './types';

export const FORMAT_EXPORT = 'suivi-therapeutique/export-client';
export const VERSION_EXPORT = 1;

export interface DonneesClient {
  client: Client;
  seances: Seance[];
  problematiques: ClientProblematique[];
  envois: Envoi[];
  rendezVous: RendezVous[];
  notes: Note[];
  remises: Remise[];
  recus: Recu[];
}

const emotion = (id: number) => EMOTIONS.find((e) => e.id === id)?.libelle ?? `émotion ${id}`;
const problematique = (id: number) => PROBLEMATIQUES.find((p) => p.id === id)?.libelle ?? `problématique ${id}`;

/**
 * Export complet d'un client, en clair. Les données d'un autre client ne peuvent pas s'y
 * glisser : tout est filtré sur `client.id`.
 */
export function exportClient(d: DonneesClient, exporteLe: string) {
  const id = d.client.id;
  const c = d.client;
  return {
    format: FORMAT_EXPORT,
    version: VERSION_EXPORT,
    exporte_le: exporteLe,
    personne: {
      nom: c.nom,
      prenom: c.prenom,
      annee_naissance: c.annee_naissance,
      email: c.email,
      telephone: c.telephone,
      fiche_creee_le: c.cree_le,
      consentement_note_le: c.consentement_le,
      accord_pour_etre_recontacte_le: c.accord_relance_le,
      relances_actives: c.relances_actives,
      tarif_seance: c.prix_seance,
    },
    synthese: c.synthese_ia ? { texte: c.synthese_ia, mise_a_jour_le: c.synthese_ia_maj_le } : null,
    problematiques: d.problematiques
      .filter((p) => p.client_id === id)
      .map((p) => ({
        libelle: problematique(p.problematique_id),
        origine: p.source === 'ia' ? 'suggérée par l’IA' : 'thérapeute',
        ajoutee_le: p.ajoute_le,
      })),
    seances: d.seances
      .filter((s) => s.client_id === id)
      .map((s) => ({
        numero: s.numero,
        type: s.type,
        date: s.date_seance,
        objectif: s.objectif,
        tim: s.tim,
        notes: s.notes,
        emotions: s.cases.map((x) => ({ zone: x.zone, position: x.position, emotion: emotion(x.emotion_id) })),
        tarif: s.prix,
      })),
    questionnaires: d.envois
      .filter((e) => e.client_id === id)
      .map((e) => ({
        titre: e.questionnaire.titre ?? null,
        canal: e.canal,
        envoye_le: e.envoye_le,
        repondu_le: e.repondu_le,
        questions: e.questions.map((q) => q.libelle),
        reponses: e.reponses,
      })),
    rendez_vous: d.rendezVous
      .filter((r) => r.client_id === id)
      .map((r) => ({
        debut: r.debut,
        fin: r.fin,
        type: r.categorie,
        lieu: r.modalite,
        statut: r.statut,
        note: r.note,
      })),
    notes: d.notes
      .filter((n) => n.client_id === id)
      .map((n) => ({ titre: n.titre, contenu: n.contenu, ecrite_le: n.cree_le, modifiee_le: n.maj_le })),
    documents_remis: d.remises
      .filter((r) => r.client_id === id)
      .map((r) => ({
        titre: r.titre,
        remis_le: r.cree_le,
        mode: r.mode,
        reponses: r.reponses,
        repondu_le: r.repondu_le,
      })),
    recus: d.recus
      .filter((r) => r.client_id === id)
      .map((r) => ({
        numero: `${r.annee}-${String(r.numero).padStart(4, '0')}`,
        emis_le: r.date_emission,
        montant: r.montant,
        annule_le: r.annule_le,
        lignes: r.lignes.map((l) => ({ date_seance: l.date_seance, prestation: l.prestation, montant: l.montant })),
      })),
  };
}

/** Nom du fichier d'export : « donnees-prenom-nom-AAAA-MM-JJ.json », sans accents ni espaces. */
export function nomFichierExport(prenom: string, nom: string, jour: string): string {
  const propre = (x: string) =>
    x
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `donnees-${[propre(prenom), propre(nom)].filter(Boolean).join('-')}-${jour}.json`;
}

/**
 * Fiches au-delà de la durée de conservation : dernière séance (ou création de la fiche
 * s'il n'y en a pas) plus ancienne que `ans` années. Les plus anciennes d'abord.
 */
export function fichesARevoir(clients: ClientResume[], aujourdhui: string, ans: number): ClientResume[] {
  const limite = decalerJour(aujourdhui, -Math.round(ans * 365.25));
  const reference = (c: ClientResume) => c.derniere_seance ?? c.cree_le.slice(0, 10);
  return clients
    .filter((c) => !c.supprime_le && reference(c) < limite)
    .sort((a, b) => reference(a).localeCompare(reference(b)));
}

export const FORMAT_EXPORT_COMPLET = 'suivi-therapeutique/export-complet';

/**
 * Export de TOUTES les données d'un thérapeute (portabilité, sauvegarde personnelle) : son
 * compte, ses réglages, ses questionnaires, chaque client (même forme que exportClient), ses
 * notes libres, ses créneaux sans client, sa bibliothèque, ses tâches, son journal de connexions.
 */
export function exportComplet(
  d: {
    therapeute: Pick<Therapeute, 'prenom' | 'nom' | 'email'>;
    parametres: Parametres;
    questionnaires: Questionnaire[];
    clients: DonneesClient[];
    notes: Note[];
    rendezVous: RendezVous[];
    ressources: Ressource[];
    tachesPerso: TachePerso[];
    connexions: Connexion[];
  },
  exporteLe: string,
) {
  return {
    format: FORMAT_EXPORT_COMPLET,
    version: VERSION_EXPORT,
    exporte_le: exporteLe,
    therapeute: d.therapeute,
    parametres: d.parametres,
    questionnaires: d.questionnaires,
    clients: d.clients.map((c) => exportClient(c, exporteLe)),
    notes_libres: d.notes
      .filter((n) => !n.client_id)
      .map((n) => ({ titre: n.titre, contenu: n.contenu, ecrite_le: n.cree_le, modifiee_le: n.maj_le })),
    creneaux_sans_client: d.rendezVous
      .filter((r) => !r.client_id)
      .map((r) => ({ debut: r.debut, fin: r.fin, type: r.categorie, titre: r.titre, note: r.note })),
    bibliotheque: d.ressources.map((r) => ({ titre: r.titre, categorie: r.categorie, contenu: r.contenu })),
    taches_perso: d.tachesPerso,
    journal_connexions: d.connexions,
  };
}

// Contrat `SourceDonnees` : toutes les opérations sur les données, groupées
// par domaine. Implémenté DEUX fois : demo.ts (navigateur, données fictives)
// et supabase.ts (production). Toute méthode ajoutée ici doit exister dans
// les deux, avec les mêmes règles (les règles SQL font foi).

import type {
  AnalyseIA,
  CanalEnvoi,
  ChampsRendezVous,
  Client,
  DocumentPublic,
  ModeReglement,
  Note,
  NoteModifiable,
  Recu,
  RecuPublic,
  Remise,
  RemisePreparee,
  ReportTache,
  Ressource,
  RessourceModifiable,
  TachePerso,
  TachePersoModifiable,
  ClientProblematique,
  ClientResume,
  Connexion,
  Envoi,
  EnvoiPrepare,
  FicheSeance,
  InscriptionMfa,
  LectureQuestionnaire,
  NouveauClient,
  NouveauRendezVous,
  Parametres,
  RendezVous,
  PeriodeStatistiques,
  Perimetre,
  Questionnaire,
  QuestionnaireModifiable,
  QuestionnairePublic,
  QuotaIA,
  ResultatConnexion,
  Seance,
  SeanceTarif,
  SourceProblematique,
  Statistiques,
  Therapeute,
  ValeurReponse,
} from '../domaine/types';

/**
 * Contrat unique d'accès aux données. Deux implémentations :
 *  - `demo`     : données fictives dans le navigateur (aucun serveur) ;
 *  - `supabase` : production (Postgres + RLS + fonction Edge Gemini).
 * Les écrans ne connaissent que cette interface. Toute nouvelle méthode
 * doit être implémentée dans LES DEUX sources (voir AGENTS.md).
 *
 * Il n'y a volontairement ni inscription ni « mot de passe oublié » :
 * les comptes sont créés et réinitialisés par l'administrateur
 * (scripts/comptes.mjs).
 */
export interface SourceDonnees {
  readonly mode: 'demo' | 'supabase';

  // --- compte et sécurité ---------------------------------------------
  sessionCourante(): Promise<Therapeute | null>;
  /**
   * Peut demander une seconde étape (code de double authentification).
   * memoriser : la session survit à la fermeture du navigateur pendant
   * 8 h (appareil personnel) ; sinon elle ne vit que dans l'onglet.
   */
  connexion(email: string, motDePasse: string, memoriser?: boolean): Promise<ResultatConnexion>;
  verifierCodeConnexion(code: string): Promise<Therapeute>;
  deconnexion(): Promise<void>;
  changerMotDePasse(actuel: string, nouveau: string): Promise<void>;
  modifierProfil(prenom: string, nom: string): Promise<Therapeute>;
  journalConnexions(): Promise<Connexion[]>;
  mfaActive(): Promise<boolean>;
  mfaCommencer(): Promise<InscriptionMfa>;
  mfaActiver(id: string, code: string): Promise<void>;
  mfaDesactiver(code: string): Promise<void>;

  // --- paramètres et questionnaires ----------------------------------------
  parametres(): Promise<Parametres>;
  enregistrerParametres(champs: Partial<Parametres>): Promise<Parametres>;
  questionnaires(): Promise<Questionnaire[]>;
  /** Crée ou remplace un questionnaire et ses questions (les envois passés gardent leur copie). */
  enregistrerQuestionnaire(questionnaire: QuestionnaireModifiable): Promise<Questionnaire>;
  /** Refusé pour le questionnaire par défaut. */
  supprimerQuestionnaire(id: string): Promise<void>;
  definirQuestionnaireParDefaut(id: string): Promise<void>;

  // --- clients -----------------------------------------------------------
  /** Clients actifs (hors corbeille). Efface au passage la corbeille de plus de 30 jours. */
  listerClients(): Promise<ClientResume[]>;
  listerCorbeille(): Promise<ClientResume[]>;
  lireClient(id: string): Promise<Client>;
  creerClient(client: NouveauClient): Promise<Client>;
  modifierClient(id: string, champs: Partial<NouveauClient>): Promise<void>;
  /** Met le client à la corbeille : restaurable pendant 30 jours. */
  supprimerClient(id: string): Promise<void>;
  restaurerClient(id: string): Promise<void>;
  /** Efface le client et tout son parcours, sans retour possible. */
  supprimerClientDefinitivement(id: string): Promise<void>;

  listerProblematiquesClient(clientId: string): Promise<ClientProblematique[]>;
  ajouterProblematique(clientId: string, problematiqueId: number, source: SourceProblematique): Promise<void>;
  retirerProblematique(clientId: string, problematiqueId: number): Promise<void>;

  // --- séances -------------------------------------------------------------
  listerSeances(clientId: string): Promise<Seance[]>;
  lireSeance(id: string): Promise<Seance>;
  /**
   * Crée la séance suivante du parcours (numéro, type et tarif attribués
   * automatiquement), datée du jour ou de `date` (AAAA-MM-JJ, ex. le jour du rendez-vous).
   */
  creerSeance(clientId: string, date?: string): Promise<Seance>;
  enregistrerSeance(id: string, fiche: FicheSeance): Promise<void>;
  /** Seule la dernière séance du parcours peut être supprimée. */
  supprimerSeance(id: string): Promise<void>;
  listerSeancesTarifs(): Promise<SeanceTarif[]>;

  // --- emploi du temps ------------------------------------------------------
  /** Rendez-vous commençant dans [de, a[ (horodatages ISO), hors clients de la corbeille. */
  listerRendezVous(de: string, a: string): Promise<RendezVous[]>;
  creerRendezVous(rdv: NouveauRendezVous): Promise<RendezVous>;
  modifierRendezVous(id: string, champs: ChampsRendezVous): Promise<RendezVous>;
  supprimerRendezVous(id: string): Promise<void>;

  // --- journal --------------------------------------------------------------
  /** Notes du thérapeute (hors clients de la corbeille), épinglées d'abord puis les plus récentes. */
  notes(): Promise<Note[]>;
  /** Crée (sans `id`) ou modifie une note. */
  enregistrerNote(id: string | null, champs: NoteModifiable): Promise<Note>;
  supprimerNote(id: string): Promise<void>;

  // --- exercices et documents ---------------------------------------------
  ressources(): Promise<Ressource[]>;
  enregistrerRessource(id: string | null, champs: RessourceModifiable): Promise<Ressource>;
  supprimerRessource(id: string): Promise<void>;
  /** Remise à un client : copie figée ; lien personnel (90 jours) ou impression. */
  preparerRemise(ressourceId: string, clientId: string, mode: 'lien' | 'imprime'): Promise<RemisePreparee>;
  listerRemises(clientId?: string): Promise<Remise[]>;
  supprimerRemise(id: string): Promise<void>;
  /** Accessible sans compte, par le lien reçu par le client. */
  documentPublic(jeton: string): Promise<DocumentPublic>;
  /** Exercice à compléter : réponses du client, une seule fois (sans compte). */
  repondreDocument(jeton: string, reponses: string[]): Promise<void>;
  /** Réponses à un exercice lues : la tâche « Exercice complété » disparaît. */
  marquerRemiseConsultee(id: string): Promise<void>;
  /** Exercice non rendu : nouveau lien (l'ancien ne marche plus), rappel noté. */
  relancerRemise(id: string): Promise<{ jeton: string; expire_le: string }>;

  // --- reçus (notes d'honoraires) -------------------------------------------
  listerRecus(): Promise<Recu[]>;
  /** Numéro suivant de l'année, sans trou ni doublon ; un seul reçu valide par séance. */
  emettreRecu(seanceId: string, mode: ModeReglement, dateEmission: string): Promise<Recu>;
  /** Un seul reçu pour 2 à 31 séances d'un même client ; une séance ne figure que sur un reçu valide. */
  emettreRecuGroupe(seanceIds: string[], mode: ModeReglement, dateEmission: string): Promise<Recu>;
  /** Un reçu ne s'efface pas : il s'annule, avec un motif. */
  annulerRecu(id: string, motif: string): Promise<void>;
  /** Lien personnel vers le reçu (90 jours) ; un nouveau lien remplace le précédent. */
  preparerLienRecu(id: string): Promise<{ jeton: string; expire_le: string }>;
  /** Accessible sans compte, par le lien reçu par le client. */
  recuPublic(jeton: string): Promise<RecuPublic>;

  // --- tâches personnelles et « plus tard » ---------------------------------
  tachesPerso(): Promise<TachePerso[]>;
  enregistrerTachePerso(id: string | null, champs: TachePersoModifiable): Promise<TachePerso>;
  supprimerTachePerso(id: string): Promise<void>;
  reportsTaches(): Promise<ReportTache[]>;
  /** Masque une tâche calculée jusqu'à `jusqua` (AAAA-MM-JJ) ; `null` la fait revenir. */
  reporterTache(cle: string, jusqua: string | null): Promise<void>;

  // --- relances et questionnaires ----------------------------------------
  listerEnvois(clientId?: string): Promise<Envoi[]>;
  /** Crée le lien personnel (questionnaire par défaut si non précisé) ; le jeton n'est renvoyé qu'ici. */
  preparerEnvoi(clientId: string, canal: CanalEnvoi, questionnaireId?: string): Promise<EnvoiPrepare>;
  /** Le lien quitte l'application (messagerie ouverte, message copié) : il devient actif. */
  marquerLienSorti(id: string): Promise<void>;
  /** Le thérapeute a envoyé le message depuis sa messagerie. */
  confirmerEnvoi(id: string, objet: string, corps: string): Promise<void>;
  annulerEnvoi(id: string): Promise<void>;
  marquerConsulte(id: string): Promise<void>;
  /** Accessible sans compte, par le lien envoyé au client. */
  questionnairePublic(jeton: string): Promise<QuestionnairePublic>;
  repondreQuestionnaire(jeton: string, reponses: Record<string, ValeurReponse>): Promise<void>;

  // --- IA et statistiques ---------------------------------------------------
  /**
   * Catégorise la problématique et met à jour la synthèse évolutive du
   * client. Sans Gemini (pas de clé, quota atteint, panne), l'analyse
   * locale prend le relais : cela fonctionne toujours.
   */
  analyserSeance(id: string): Promise<AnalyseIA>;
  /** Lecture IA d'un questionnaire reçu (onglet Tâches), avec repli local. */
  lireQuestionnaireIA(envoiId: string): Promise<LectureQuestionnaire>;
  quotaIA(): Promise<QuotaIA>;
  /** La période ne s'applique qu'à l'espace personnel (voir la migration 20261003100000). */
  statistiques(perimetre: Perimetre, periode?: PeriodeStatistiques): Promise<Statistiques>;

  /** Mode démo seulement : remet le jeu de données fictif d'origine. */
  reinitialiserDemo?(): void;
}

export class ErreurDonnees extends Error {}

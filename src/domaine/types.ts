// Types du domaine — reflètent le schéma SQL (supabase/migrations).

import type { ZoneFiche } from '../../supabase/functions/_shared/fiche.ts';
export type { ZoneFiche };

export type Lignee = 'pere' | 'mere';
export type TypeSeance = 'initiale' | 'bilan' | 'supplementaire';
export type SourceProblematique = 'therapeute' | 'ia';
export type Perimetre = 'personnel' | 'groupe';
/** Période des statistiques personnelles : le mois en cours et les 2 (ou 11) précédents. */
export type PeriodeStatistiques = 'tout' | '12mois' | '3mois';

export interface Referentiel {
  id: number;
  libelle: string;
}
export interface Problematique extends Referentiel {
  code: string;
}
export interface TrancheAge extends Referentiel {
  age_min: number;
  age_max: number | null;
}

export interface Therapeute {
  id: string;
  email: string;
  nom: string;
  prenom: string;
}

/** Coordonnées, tarif et réglages de relance d'un client (tous facultatifs). */
export interface SuiviClient {
  email: string | null;
  telephone: string | null;
  prix_seance: number | null;
  relances_actives: boolean;
  relance_reportee_au: string | null;
  /** Date à laquelle le client a accepté d'être recontacté (RGPD) ; `null` = accord non noté. */
  accord_relance_le: string | null;
}

export interface Client extends SuiviClient {
  id: string;
  therapeute_id: string;
  nom: string;
  prenom: string;
  annee_naissance: number;
  synthese_ia: string | null;
  synthese_ia_maj_le: string | null;
  cree_le: string;
  /** Dans la corbeille depuis cette date (effacement définitif 30 jours après). */
  supprime_le: string | null;
}

export type NouveauClient = Pick<Client, 'nom' | 'prenom' | 'annee_naissance'> & Partial<SuiviClient>;

/** Ligne de la vue `clients_resume`. */
export interface ClientResume extends SuiviClient {
  id: string;
  nom: string;
  prenom: string;
  annee_naissance: number;
  cree_le: string;
  nb_seances: number;
  derniere_seance: string | null;
  problematiques: number[];
  supprime_le: string | null;
}

// ---------------------------------------------------------------------
// Paramètres, questionnaire de suivi, envois
// ---------------------------------------------------------------------
export type TailleTexte = 'normal' | 'grand' | 'tres_grand';
export type Densite = 'confortable' | 'compacte';
/** Vision des couleurs : palette adaptée au daltonisme rouge-vert ou bleu-jaune. */
export type Vision = 'standard' | 'rouge_vert' | 'bleu_jaune';
export type PageAccueil = '/' | '/clients' | '/taches' | '/emploi-du-temps';

export interface Parametres {
  // apparence et affichage
  nom_site: string;
  couleur: string;
  taille_texte: TailleTexte;
  densite: Densite;
  vision: Vision;
  reduire_animations: boolean;
  page_accueil: PageAccueil;
  // profil
  specialite: string;
  telephone_pro: string;
  signature: string;
  /** Photo de profil (URL data:, 300 Ko au plus). */
  photo: string | null;
  // tarifs
  tarifs_actifs: boolean;
  prix_defaut: number | null;
  // relances
  relances_actives: boolean;
  relance_delai_jours: number;
  relance_intervalle_jours: number;
  relance_max: number;
  lien_validite_jours: number;
  modele_email_objet: string;
  modele_email: string;
  modele_sms: string;
  // sécurité
  deconnexion_minutes: number;
  // intelligence artificielle
  ia_taches: boolean;
  ia_quota_jour: number;
  // emploi du temps
  agenda_heure_debut: number;
  agenda_heure_fin: number;
  /** Jours de travail, 1 = lundi … 7 = dimanche. */
  agenda_jours: number[];
  duree_rdv_minutes: number;
  /** Couleurs choisies par catégorie ; absentes = couleurs adaptées à tous. */
  agenda_couleurs: Partial<Record<CategorieRdv, string>>;
  modele_rappel: string;
  // reçus (notes d'honoraires)
  adresse_pro: string;
  siret: string;
  mention_recu: string;
  /** Exercice à compléter sans réponse : tâche « Rappeler l'exercice » après N jours (0 = jamais). */
  exercice_rappel_jours: number;
}

// ---------------------------------------------------------------------
// Journal, exercices, reçus, tâches personnelles
// ---------------------------------------------------------------------
export interface Note {
  id: string;
  client_id: string | null;
  titre: string;
  contenu: string;
  epinglee: boolean;
  cree_le: string;
  maj_le: string;
}
export type NoteModifiable = Pick<Note, 'client_id' | 'titre' | 'contenu' | 'epinglee'>;

export type CategorieRessource = 'exercice' | 'fiche' | 'lecture' | 'autre';

/** Exercice ou document de la bibliothèque du thérapeute. */
export interface Ressource {
  id: string;
  titre: string;
  categorie: CategorieRessource;
  resume: string;
  /** Texte simple : « # » titre, « - » liste, ligne vide = nouveau paragraphe. */
  contenu: string;
  cree_le: string;
  maj_le: string;
}
export type RessourceModifiable = Pick<Ressource, 'titre' | 'categorie' | 'resume' | 'contenu'>;

/** Document remis à un client (copie figée au moment de la remise). */
export interface Remise {
  id: string;
  client_id: string;
  document_id: string | null;
  mode: 'lien' | 'imprime';
  titre: string;
  cree_le: string;
  expire_le: string | null;
  ouvert_le: string | null;
  /** Exercice à compléter : questions recopiées et réponses du client. */
  reponses: ReponseExercice[] | null;
  repondu_le: string | null;
  /** Réponses lues par le thérapeute (la tâche « Exercice complété » disparaît). */
  consulte_le: string | null;
  /** Nombre de questions « ? » de la copie remise (0 : simple document). */
  nb_questions: number;
  /** Rappel envoyé pour un exercice non rendu (nouveau lien). */
  rappel_le: string | null;
}
export interface ReponseExercice {
  question: string;
  reponse: string;
}
export interface RemisePreparee {
  id: string;
  /** Jeton du lien personnel, renvoyé une seule fois (null si imprimé). */
  jeton: string | null;
  expire_le: string | null;
}
export type DocumentPublic =
  | {
      valide: true;
      titre: string;
      contenu: string;
      therapeute: string;
      nom_site: string;
      couleur: string;
      expire_le: string;
      /** Exercice à compléter déjà rendu : le formulaire n'est plus proposé. */
      repondu_le: string | null;
    }
  | { valide: false; raison: 'inconnu' | 'expire'; nom_site?: string; couleur?: string };

export type ModeReglement = 'especes' | 'cheque' | 'virement' | 'carte' | 'autre';

export interface Recu {
  id: string;
  annee: number;
  numero: number;
  client_id: string | null;
  seance_id: string | null;
  client_nom: string;
  date_seance: string;
  date_emission: string;
  prestation: string;
  montant: number;
  mode_reglement: ModeReglement;
  /** Coordonnées du thérapeute au moment de l'émission. */
  emetteur: { nom: string; specialite: string; adresse: string; telephone: string; siret: string; mention: string };
  annule_le: string | null;
  motif_annulation: string;
  cree_le: string;
  /** Lien personnel envoyé au client (le jeton n'est jamais relu). */
  lien_expire_le: string | null;
  lien_ouvert_le: string | null;
  /** Une ligne par séance (plusieurs pour un reçu groupé), dans l'ordre des dates. */
  lignes: LigneRecu[];
}
export interface LigneRecu {
  seance_id: string | null;
  date_seance: string;
  prestation: string;
  montant: number;
}
/** Ce qu'affiche un reçu (page à imprimer, page du client). */
export type RecuAffiche = Pick<
  Recu,
  | 'annee'
  | 'numero'
  | 'client_nom'
  | 'date_seance'
  | 'date_emission'
  | 'prestation'
  | 'montant'
  | 'mode_reglement'
  | 'emetteur'
  | 'annule_le'
  | 'motif_annulation'
> & { lignes: Omit<LigneRecu, 'seance_id'>[] };
export type RecuPublic =
  | { valide: true; recu: RecuAffiche; nom_site: string; couleur: string; expire_le: string }
  | { valide: false; raison: 'inconnu' | 'expire'; nom_site?: string; couleur?: string };

export interface TachePerso {
  id: string;
  client_id: string | null;
  titre: string;
  echeance: string | null;
  faite_le: string | null;
  cree_le: string;
  /** Une tâche récurrente cochée crée la suivante (prochaine échéance de la série). */
  recurrence: Recurrence;
}
export type Recurrence = 'aucune' | 'semaine' | 'mois';
export type TachePersoModifiable = Partial<
  Pick<TachePerso, 'client_id' | 'titre' | 'echeance' | 'faite_le' | 'recurrence'>
>;

/** Tâche calculée (relance, questionnaire, rappel…) masquée jusqu'à une date. */
export interface ReportTache {
  cle: string;
  jusqua: string;
}

// ---------------------------------------------------------------------
// Emploi du temps
// ---------------------------------------------------------------------
export type CategorieRdv = 'premier' | 'seance' | 'bilan' | 'administratif' | 'personnel';
export type StatutRdv = 'prevu' | 'honore' | 'absent' | 'annule';
export type ModaliteRdv = 'cabinet' | 'visio' | 'telephone' | 'domicile';

export interface RendezVous {
  id: string;
  client_id: string | null;
  categorie: CategorieRdv;
  statut: StatutRdv;
  modalite: ModaliteRdv;
  /** Horodatages ISO (UTC) ; affichés en heure locale. */
  debut: string;
  fin: string;
  /** Intitulé des créneaux sans fiche client. */
  titre: string;
  note: string;
  seance_id: string | null;
  rappel_envoye_le: string | null;
  cree_le: string;
}

export type NouveauRendezVous = Pick<RendezVous, 'categorie' | 'debut' | 'fin'> &
  Partial<Pick<RendezVous, 'client_id' | 'statut' | 'modalite' | 'titre' | 'note'>>;

export type ChampsRendezVous = Partial<Omit<RendezVous, 'id' | 'cree_le'>>;

// Types du questionnaire partagés avec la fonction Edge.
export type {
  LectureQuestionnaire,
  QuestionEnvoyee,
  Reponse,
  TypeQuestion,
  ValeurReponse,
} from '../../supabase/functions/_shared/questionnaire.ts';
import type { LectureQuestionnaire, QuestionEnvoyee, Reponse } from '../../supabase/functions/_shared/questionnaire.ts';

export interface Question extends QuestionEnvoyee {
  ordre: number;
  active: boolean;
}

export interface Questionnaire {
  id: string;
  titre: string;
  introduction: string;
  remerciement: string;
  par_defaut: boolean;
  ordre: number;
  questions: Question[];
}

/** Questionnaire à enregistrer : sans identifiant, il est créé (de même pour ses questions). */
export type QuestionnaireModifiable = Omit<Questionnaire, 'id' | 'par_defaut' | 'ordre' | 'questions'> & {
  id?: string;
  questions: (Omit<Question, 'id'> & { id?: string })[];
};

export type CanalEnvoi = 'email' | 'sms';

export interface Envoi {
  id: string;
  client_id: string;
  questionnaire_id: string | null;
  canal: CanalEnvoi;
  destinataire: string;
  objet: string;
  corps: string;
  questionnaire: { titre?: string; introduction?: string; remerciement?: string };
  questions: QuestionEnvoyee[];
  cree_le: string;
  expire_le: string;
  envoye_le: string | null;
  /** Le lien a quitté l'application (messagerie ouverte, message copié) : il devient actif. */
  lien_sorti_le: string | null;
  reponses: Reponse[] | null;
  repondu_le: string | null;
  consulte_le: string | null;
  /** Lecture IA des réponses, conservée pour ne pas rappeler Gemini. */
  analyse_ia: LectureQuestionnaire | null;
}

export interface QuotaIA {
  utilise: number;
  max: number;
  /** Le plafond commun à toute la plateforme est atteint pour aujourd'hui. */
  plateforme_epuisee?: boolean;
}

/** Résultat de `preparer_envoi` : le jeton n'est connu qu'à cet instant. */
export interface EnvoiPrepare {
  id: string;
  jeton: string;
  expire_le: string;
  destinataire: string;
}

export type QuestionnairePublic =
  | {
      valide: true;
      therapeute: string;
      nom_site: string;
      couleur: string;
      expire_le: string;
      titre: string;
      introduction: string;
      remerciement: string;
      questions: QuestionEnvoyee[];
      /** Les 14 émotions, pour les questions de type « emotions ». */
      emotions: string[];
    }
  | {
      valide: false;
      raison: 'inconnu' | 'expire' | 'deja_repondu' | 'non_envoye';
      nom_site?: string;
      couleur?: string;
    };

export interface Connexion {
  le: string;
  appareil: string;
}

export type ResultatConnexion = { etape: 'ok'; therapeute: Therapeute } | { etape: 'double_authentification' };

export interface InscriptionMfa {
  id: string;
  secret: string;
  uri: string;
  /** Image du QR code (URL data:). */
  qr: string;
}

/** Tarif d'une séance, pour la rentabilité. */
export type SeanceTarif = Pick<Seance, 'id' | 'client_id' | 'date_seance' | 'prix'>;

export interface ClientProblematique {
  client_id: string;
  therapeute_id: string;
  problematique_id: number;
  source: SourceProblematique;
  ajoute_le: string;
}

/** Une case remplie de la fiche papier (voir `_shared/fiche.ts`). */
export interface CaseFiche {
  zone: ZoneFiche;
  position: number;
  emotion_id: number;
}

export interface AnalyseIA {
  problematiques: { code: string; confiance: number; justification: string }[];
  emotions_reperees: string[];
  synthese: string;
  points_attention: string[];
  modele: string;
}

export interface Seance {
  id: string;
  client_id: string;
  therapeute_id: string;
  numero: number;
  type: TypeSeance;
  date_seance: string; // AAAA-MM-JJ
  lignee: Lignee | null;
  objectif: string;
  tim: string;
  notes: string;
  /** Cases remplies de la feuille (émotions au temps présent, suivi croisé, grilles). */
  cases: CaseFiche[];
  /** Tarif de la séance en euros (facultatif). */
  prix: number | null;
  analyse_ia: AnalyseIA | null;
  analyse_ia_le: string | null;
}

/** Ce que le thérapeute saisit sur la fiche (payload de `enregistrer_seance`). */
export type FicheSeance = Pick<Seance, 'date_seance' | 'lignee' | 'objectif' | 'tim' | 'notes' | 'cases' | 'prix'>;

// ---------------------------------------------------------------------
// Statistiques — forme exacte du jsonb renvoyé par `statistiques()`
// ---------------------------------------------------------------------
export interface StatEmotion {
  emotion_id: number;
  libelle: string;
  masque: boolean;
  occurrences: number | null;
  part_seances: number | null;
  moyenne_par_client: number | null;
}

export interface StatTranche {
  tranche_id: number;
  libelle: string;
  masque: boolean;
  nb_clients: number | null;
  nb_seances: number | null;
  emotions: { emotion_id: number; libelle: string; part_seances: number }[];
}

export interface StatProblematique {
  problematique_id: number;
  code: string;
  libelle: string;
  masque: boolean;
  nb_clients: number | null;
  part_clients: number | null;
}

export interface Seuils {
  clients: number;
  therapeutes: number;
}

export interface StatistiquesDisponibles {
  perimetre: Perimetre;
  disponible: true;
  seuils: Seuils;
  kpis: {
    nb_therapeutes: number;
    nb_clients: number;
    nb_seances: number;
    moyenne_seances_par_client: number | null;
    duree_moyenne_suivi_jours: number | null;
    part_clients_bilan: number | null;
  };
  emotions: StatEmotion[];
  tranches: StatTranche[];
  problematiques: StatProblematique[];
  /** Les 12 derniers mois (AAAA-MM), du plus ancien au plus récent. */
  par_mois: { mois: string; nb_seances: number }[];
}

export interface StatistiquesIndisponibles {
  perimetre: Perimetre;
  disponible: false;
  seuils: Seuils;
  kpis: { nb_therapeutes: number };
}

export type Statistiques = StatistiquesDisponibles | StatistiquesIndisponibles;

// Source de données « démo » : tout reste dans ce navigateur (localStorage).
// Elle applique les mêmes règles que la base : cloisonnement par
// thérapeute, numérotation du parcours, suppression de la dernière
// séance seulement, statistiques et seuils d'anonymat identiques, liens
// de questionnaire à usage unique dont seule l'empreinte est stockée,
// quota quotidien d'analyses IA avec repli local.
//
// Chaque méthode publique est le MIROIR d'une fonction SQL ou d'une requête
// de supabase.ts (mêmes règles, mêmes messages d'erreur) : modifier l'une
// sans l'autre fausse le mode démo et les tests de bout en bout.
// Sections (chercher « // --- ») : IA · compte et sécurité · paramètres et
// questionnaires · clients · problématiques · séances · journal · exercices et
// documents · reçus · tâches personnelles et « plus tard » · emploi du temps ·
// relances et questionnaires · IA · statistiques.

import {
  analyseSimulee,
  construireRequeteGemini,
  GEMINI_MODELE_PAR_DEFAUT,
  lireReponseGemini,
  MODELE_SIMULATION,
  urlGemini,
} from '../../supabase/functions/_shared/analyse.ts';
import {
  construireRequeteLecture,
  lectureLocale,
  lireReponseLecture,
  validerReponses,
} from '../../supabase/functions/_shared/questionnaire.ts';
import { EMOTIONS, NUMERO_BILAN, SEANCES_INITIALES } from '../config/referentiels';
import { contexteAnalyse, estDerniereAnalysee, synthesePrecedente } from '../domaine/contexteAnalyse';
import { dateDuJour } from '../domaine/format';
import { echeanceSuivante } from '../domaine/taches';
import { questionsDocument, validerReponsesDocument } from '../domaine/texte';
import {
  decrireAppareil,
  empreinteJeton,
  genererJeton,
  genererSecretTotp,
  problemeMotDePasse,
  uriOtpauth,
  verifierTotp,
} from '../domaine/securite';
import { calculerStatistiques } from '../domaine/statistiques';
import type {
  AnalyseIA,
  CanalEnvoi,
  ChampsRendezVous,
  Client,
  ClientProblematique,
  ClientResume,
  Envoi,
  FicheSeance,
  LectureQuestionnaire,
  NouveauClient,
  NouveauRendezVous,
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
  Parametres,
  PeriodeStatistiques,
  Perimetre,
  Questionnaire,
  QuestionnaireModifiable,
  QuestionnairePublic,
  RendezVous,
  ResultatConnexion,
  Seance,
  SourceProblematique,
  Statistiques,
  Therapeute,
  TypeSeance,
  ValeurReponse,
} from '../domaine/types';
import { cleGeminiDemo } from './cleDemo';
import {
  genererJeuDemo,
  VERSION_JEU_DEMO,
  type EnvoiDemo,
  type JeuDemo,
  type QuestionnaireDemo,
  type RecuDemo,
  type RemiseDemo,
  type RendezVousDemo,
} from './jeuDemo';
import { memoriserSession, stockageSession } from './memoireSession';
import { ErreurDonnees, type SourceDonnees } from './source';
import { DUREE_JOURNAL_CONNEXIONS_MOIS } from '../config/rgpd';

const CLE_JEU = `suivi-therapeutique:demo:v${VERSION_JEU_DEMO}`;
const CLE_SESSION = 'suivi-therapeutique:demo:session';
const CLE_ECHECS = 'suivi-therapeutique:demo:echecs';
const CLE_QUOTA = 'suivi-therapeutique:demo:quota-ia';

const ESSAIS_MAX = 5;
const BLOCAGE_MS = 60_000;
const CORBEILLE_MS = 30 * 86_400_000;
const LIBELLES_EMOTIONS = EMOTIONS.map((e) => e.libelle);

// Le stockage peut être indisponible (navigation privée, blocage) : on
// continue alors en mémoire.
const lire = (s: () => Storage, cle: string) => {
  try {
    return s().getItem(cle);
  } catch {
    return null;
  }
};
const ecrire = (s: () => Storage, cle: string, valeur: string | null) => {
  try {
    if (valeur === null) s().removeItem(cle);
    else s().setItem(cle, valeur);
  } catch {
    /* stockage indisponible */
  }
};
const local = () => localStorage;

const copie = <T>(x: T): T => structuredClone(x);
const maintenant = () => new Date().toISOString();
const attendre = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TELEPHONE = /^\+?[0-9 .()-]{6,20}$/;

/** Mêmes contrôles que la base (contraintes `check` de la migration). */
function verifierSuivi(champs: Partial<NouveauClient>) {
  if (champs.email && !EMAIL.test(champs.email)) throw new ErreurDonnees('Adresse e-mail invalide.');
  if (champs.telephone && !TELEPHONE.test(champs.telephone)) throw new ErreurDonnees('Numéro de téléphone invalide.');
  if (champs.prix_seance !== undefined && champs.prix_seance !== null && !(champs.prix_seance >= 0))
    throw new ErreurDonnees('Tarif invalide.');
  if (champs.accord_relance_le && !/^\d{4}-\d{2}-\d{2}$/.test(champs.accord_relance_le))
    throw new ErreurDonnees("Date d'accord invalide.");
  if (champs.consentement_le && !/^\d{4}-\d{2}-\d{2}$/.test(champs.consentement_le))
    throw new ErreurDonnees('Date de consentement invalide.');
}

const versResume = (c: Client, seances: Seance[], problematiques: number[]): ClientResume => ({
  id: c.id,
  nom: c.nom,
  prenom: c.prenom,
  annee_naissance: c.annee_naissance,
  cree_le: c.cree_le,
  nb_seances: seances.length,
  derniere_seance: seances.length ? seances[seances.length - 1].date_seance : null,
  problematiques,
  email: c.email,
  telephone: c.telephone,
  prix_seance: c.prix_seance,
  relances_actives: c.relances_actives,
  relance_reportee_au: c.relance_reportee_au,
  accord_relance_le: c.accord_relance_le,
  supprime_le: c.supprime_le,
  consentement_le: c.consentement_le ?? null,
});

function verifierParametres(p: Parametres) {
  const entre = (x: number, a: number, b: number, nom: string) => {
    if (!Number.isInteger(x) || x < a || x > b) throw new ErreurDonnees(`${nom} : entre ${a} et ${b}.`);
  };
  if (!p.nom_site.trim() || p.nom_site.length > 60) throw new ErreurDonnees('Nom du site : 1 à 60 caractères.');
  if (!/^#[0-9a-f]{6}$/.test(p.couleur)) throw new ErreurDonnees('Couleur invalide.');
  if (p.prix_defaut !== null && !(p.prix_defaut >= 0)) throw new ErreurDonnees('Tarif par défaut invalide.');
  if (p.specialite.length > 80) throw new ErreurDonnees('Spécialité : 80 caractères au plus.');
  if (p.telephone_pro.length > 30) throw new ErreurDonnees('Téléphone : 30 caractères au plus.');
  if (p.signature.length > 500) throw new ErreurDonnees('Signature : 500 caractères au plus.');
  if (p.photo !== null && (!p.photo.startsWith('data:image/') || p.photo.length > 300_000))
    throw new ErreurDonnees('Photo trop lourde (300 Ko au plus).');
  entre(p.relance_delai_jours, 1, 365, 'Délai avant la première relance');
  entre(p.relance_intervalle_jours, 1, 365, 'Intervalle entre les relances');
  entre(p.relance_max, 1, 20, 'Nombre de relances');
  entre(p.lien_validite_jours, 1, 180, 'Validité du lien');
  entre(p.deconnexion_minutes, 5, 480, 'Déconnexion automatique');
  entre(p.ia_quota_jour, 0, 200, 'Analyses IA par jour');
  entre(p.agenda_heure_debut, 0, 23, 'Début de journée');
  entre(p.agenda_heure_fin, 1, 24, 'Fin de journée');
  if (p.agenda_heure_debut >= p.agenda_heure_fin)
    throw new ErreurDonnees('La journée doit finir après avoir commencé.');
  if (!p.agenda_jours.length || p.agenda_jours.some((j) => !Number.isInteger(j) || j < 1 || j > 7))
    throw new ErreurDonnees('Choisissez au moins un jour de travail.');
  entre(p.duree_rdv_minutes, 15, 240, 'Durée par défaut des rendez-vous');
  if (Object.values(p.agenda_couleurs).some((c) => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)))
    throw new ErreurDonnees('Couleur invalide.');
  if (p.modele_rappel.length > 1000) throw new ErreurDonnees('Message de rappel : 1000 caractères au plus.');
  if (p.adresse_pro.length > 300) throw new ErreurDonnees('Adresse : 300 caractères au plus.');
  if (p.siret && !/^[0-9 ]{9,17}$/.test(p.siret)) throw new ErreurDonnees('SIRET : 14 chiffres (espaces permis).');
  if (p.mention_recu.length > 300) throw new ErreurDonnees('Mention des reçus : 300 caractères au plus.');
  entre(p.exercice_rappel_jours, 0, 60, "Rappel d'un exercice non rendu");
}

/** Mêmes contrôles que les contraintes de la table `questions`. */
function verifierQuestionnaire(q: QuestionnaireModifiable) {
  if (!q.titre.trim() || q.titre.length > 120)
    throw new ErreurDonnees('Le questionnaire doit avoir un titre (120 caractères au plus).');
  for (const x of q.questions) {
    const nom = `« ${x.libelle.slice(0, 40) || 'question sans intitulé'} »`;
    if (!x.libelle.trim() || x.libelle.length > 300) throw new ErreurDonnees('Chaque question doit avoir un intitulé.');
    if (x.minimum >= x.maximum) throw new ErreurDonnees(`${nom} : le minimum doit être inférieur au maximum.`);
    if (x.type === 'etoiles' && (x.minimum !== 1 || x.maximum < 3 || x.maximum > 10))
      throw new ErreurDonnees(`${nom} : de 3 à 10 étoiles.`);
    if ((x.type === 'choix_unique' || x.type === 'choix_multiple') && x.options.filter((o) => o.trim()).length < 2)
      throw new ErreurDonnees(`${nom} : au moins deux options.`);
    if (x.options.length > 12) throw new ErreurDonnees(`${nom} : 12 options au plus.`);
  }
}

export class SourceDemo implements SourceDonnees {
  readonly mode = 'demo' as const;
  private jeu: JeuDemo;
  private uid: string | null;
  private attenteMfa: string | null = null;
  private mfaEnCours: string | null = null;

  constructor() {
    this.jeu = this.charger() ?? genererJeuDemo();
    this.uid = stockageSession.getItem(CLE_SESSION);
    if (!lire(local, CLE_JEU)) this.sauver();
    // Un autre onglet (ex. le questionnaire rempli par le client) a écrit :
    // on reprend ses données plutôt que de les écraser.
    globalThis.addEventListener?.('storage', (e) => {
      if (e.key === CLE_JEU) this.jeu = this.charger() ?? this.jeu;
    });
  }

  private charger(): JeuDemo | null {
    try {
      const jeu = JSON.parse(lire(local, CLE_JEU) ?? 'null') as JeuDemo | null;
      // jeu incomplet (version intermédiaire) : on le régénère plutôt que de planter
      return jeu?.version === VERSION_JEU_DEMO && Array.isArray(jeu.rendez_vous) ? jeu : null;
    } catch {
      return null;
    }
  }

  /** Remet le jeu fictif d'origine (paramètres, ou écran de connexion si la démo est bloquée). */
  reinitialiserDemo() {
    this.jeu = genererJeuDemo();
    this.attenteMfa = null;
    ecrire(local, CLE_ECHECS, null);
    this.sauver();
  }

  private sauver() {
    ecrire(local, CLE_JEU, JSON.stringify(this.jeu));
  }

  private moi(): string {
    if (!this.uid || !this.jeu.therapeutes.some((t) => t.id === this.uid))
      throw new ErreurDonnees('Session expirée : reconnectez-vous.');
    return this.uid;
  }
  private therapeute() {
    const uid = this.moi();
    return this.jeu.therapeutes.find((t) => t.id === uid)!;
  }

  // Équivalent de la RLS : on ne voit que ses propres lignes.
  private client(id: string): Client {
    const c = this.jeu.clients.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!c) throw new ErreurDonnees('Client introuvable.');
    return c;
  }
  private seance(id: string): Seance {
    const s = this.jeu.seances.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!s) throw new ErreurDonnees('Séance introuvable.');
    return s;
  }
  private envoi(id: string): EnvoiDemo {
    const e = this.jeu.envois.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!e) throw new ErreurDonnees('Envoi introuvable.');
    return e;
  }
  private questionnaire(id: string): QuestionnaireDemo {
    const q = this.jeu.questionnaires.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!q) throw new ErreurDonnees('Questionnaire introuvable.');
    return q;
  }
  private seancesDe(clientId: string) {
    return this.jeu.seances.filter((s) => s.client_id === clientId).sort((a, b) => a.numero - b.numero);
  }
  private profil(id: string): Therapeute {
    const { id: i, email, nom, prenom } = this.jeu.therapeutes.find((x) => x.id === id)!;
    return { id: i, email, nom, prenom };
  }
  private param(): Parametres {
    return this.jeu.parametres[this.moi()];
  }

  // --- intelligence artificielle : une clé, un quota, toujours un repli ----
  /** Réserve une analyse Gemini ; `false` = pas de clé ou quota du jour atteint. */
  private reserverGemini(): string | null {
    const cle = cleGeminiDemo.lire();
    if (!cle) return null;
    const jour = dateDuJour();
    const compte = JSON.parse(lire(local, CLE_QUOTA) ?? '{}') as Record<string, Record<string, number>>;
    const utilise = compte[this.moi()]?.[jour] ?? 0;
    if (utilise >= this.param().ia_quota_jour) return null;
    compte[this.moi()] = { [jour]: utilise + 1 };
    ecrire(local, CLE_QUOTA, JSON.stringify(compte));
    return cle;
  }

  private async appelerGemini(cle: string, requete: unknown): Promise<unknown> {
    const reponse = await fetch(urlGemini(GEMINI_MODELE_PAR_DEFAUT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify(requete),
      signal: AbortSignal.timeout(45_000),
    });
    if (!reponse.ok) throw new Error(`Gemini ${reponse.status}`);
    return reponse.json();
  }

  async quotaIA() {
    const compte = JSON.parse(lire(local, CLE_QUOTA) ?? '{}') as Record<string, Record<string, number>>;
    // pas de plafond de plateforme en démonstration (un seul navigateur)
    return {
      utilise: compte[this.moi()]?.[dateDuJour()] ?? 0,
      max: this.param().ia_quota_jour,
      plateforme_epuisee: false,
    };
  }

  // --- compte et sécurité ------------------------------------------------
  async sessionCourante() {
    return this.uid && this.jeu.therapeutes.some((t) => t.id === this.uid) ? this.profil(this.uid) : null;
  }

  private ouvrirSession(id: string): Therapeute {
    this.uid = id;
    this.attenteMfa = null;
    stockageSession.setItem(CLE_SESSION, id);
    this.jeu.journal.unshift({ therapeute_id: id, le: maintenant(), appareil: decrireAppareil() });
    this.jeu.journal = this.jeu.journal.slice(0, 200);
    this.sauver();
    return this.profil(id);
  }

  async connexion(email: string, motDePasse: string, memoriser = false): Promise<ResultatConnexion> {
    await attendre();
    memoriserSession(memoriser);
    const echecs = JSON.parse(lire(local, CLE_ECHECS) ?? '{"n":0,"jusqua":0}') as { n: number; jusqua: number };
    if (echecs.jusqua > Date.now())
      throw new ErreurDonnees(
        `Trop d'essais : réessayez dans ${Math.ceil((echecs.jusqua - Date.now()) / 1000)} secondes.`,
      );
    const t = this.jeu.therapeutes.find(
      (x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.mot_de_passe === motDePasse,
    );
    if (!t) {
      const n = echecs.n + 1;
      ecrire(
        local,
        CLE_ECHECS,
        JSON.stringify(n >= ESSAIS_MAX ? { n: 0, jusqua: Date.now() + BLOCAGE_MS } : { n, jusqua: 0 }),
      );
      throw new ErreurDonnees(
        n >= ESSAIS_MAX
          ? "Trop d'essais : la connexion est bloquée pendant une minute."
          : 'Adresse ou mot de passe incorrect.',
      );
    }
    ecrire(local, CLE_ECHECS, null);
    if (t.mfa_secret) {
      this.attenteMfa = t.id;
      return { etape: 'double_authentification' };
    }
    return { etape: 'ok', therapeute: this.ouvrirSession(t.id) };
  }

  async verifierCodeConnexion(code: string) {
    const t = this.jeu.therapeutes.find((x) => x.id === this.attenteMfa);
    if (!t?.mfa_secret) throw new ErreurDonnees('Reconnectez-vous.');
    if (!(await verifierTotp(t.mfa_secret, code))) throw new ErreurDonnees('Code incorrect.');
    return this.ouvrirSession(t.id);
  }

  async deconnexion() {
    this.uid = null;
    stockageSession.removeItem(CLE_SESSION);
    memoriserSession(false);
  }

  async changerMotDePasse(actuel: string, nouveau: string) {
    await attendre();
    const t = this.therapeute();
    if (t.mot_de_passe !== actuel) throw new ErreurDonnees('Mot de passe actuel incorrect.');
    const probleme = problemeMotDePasse(nouveau);
    if (probleme) throw new ErreurDonnees(probleme);
    t.mot_de_passe = nouveau;
    this.sauver();
  }

  async modifierProfil(prenom: string, nom: string) {
    const t = this.therapeute();
    if (!prenom.trim() || !nom.trim()) throw new ErreurDonnees('Le prénom et le nom sont obligatoires.');
    t.prenom = prenom.trim();
    t.nom = nom.trim();
    this.sauver();
    return this.profil(t.id);
  }

  async journalConnexions() {
    const uid = this.moi();
    return this.jeu.journal
      .filter((j) => j.therapeute_id === uid)
      .slice(0, 20)
      .map(({ le, appareil }) => ({ le, appareil }));
  }

  async mfaActive() {
    return Boolean(this.therapeute().mfa_secret);
  }

  async mfaCommencer() {
    const t = this.therapeute();
    const secret = genererSecretTotp();
    this.mfaEnCours = secret;
    const uri = uriOtpauth(secret, t.email, this.param().nom_site);
    // chargé à la demande : inutile au reste de l'application
    const { default: QRCode } = await import('qrcode');
    const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { id: 'demo', secret, uri, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
  }

  async mfaActiver(_id: string, code: string) {
    if (!this.mfaEnCours) throw new ErreurDonnees("Recommencez l'activation.");
    if (!(await verifierTotp(this.mfaEnCours, code))) throw new ErreurDonnees('Code incorrect.');
    this.therapeute().mfa_secret = this.mfaEnCours;
    this.mfaEnCours = null;
    this.sauver();
  }

  async mfaDesactiver(code: string) {
    const t = this.therapeute();
    if (!t.mfa_secret || !(await verifierTotp(t.mfa_secret, code))) throw new ErreurDonnees('Code incorrect.');
    t.mfa_secret = null;
    this.sauver();
  }

  // --- paramètres et questionnaires -------------------------------------------
  async parametres() {
    return copie(this.param());
  }

  async enregistrerParametres(champs: Partial<Parametres>) {
    await attendre();
    const suivant = { ...this.param(), ...champs };
    verifierParametres(suivant);
    this.jeu.parametres[this.moi()] = suivant;
    this.sauver();
    return copie(suivant);
  }

  async questionnaires(): Promise<Questionnaire[]> {
    const uid = this.moi();
    return this.jeu.questionnaires
      .filter((q) => q.therapeute_id === uid)
      .sort((a, b) => a.ordre - b.ordre)
      .map(({ therapeute_id: _, ...q }) => copie(q));
  }

  async enregistrerQuestionnaire(saisi: QuestionnaireModifiable): Promise<Questionnaire> {
    await attendre();
    verifierQuestionnaire(saisi);
    const uid = this.moi();
    const questions = saisi.questions.map((q, i) => ({
      ...q,
      options: q.options.map((o) => o.trim()).filter(Boolean),
      id: q.id ?? crypto.randomUUID(),
      ordre: i + 1,
    }));
    let cible: QuestionnaireDemo;
    if (saisi.id) {
      cible = this.questionnaire(saisi.id);
      Object.assign(cible, {
        titre: saisi.titre.trim(),
        introduction: saisi.introduction,
        remerciement: saisi.remerciement,
        questions,
      });
    } else {
      const miens = this.jeu.questionnaires.filter((q) => q.therapeute_id === uid);
      cible = {
        id: crypto.randomUUID(),
        therapeute_id: uid,
        titre: saisi.titre.trim(),
        introduction: saisi.introduction,
        remerciement: saisi.remerciement,
        par_defaut: miens.length === 0,
        ordre: Math.max(0, ...miens.map((q) => q.ordre)) + 1,
        questions,
      };
      this.jeu.questionnaires.push(cible);
    }
    this.sauver();
    const { therapeute_id: _, ...q } = cible;
    return copie(q);
  }

  async supprimerQuestionnaire(id: string) {
    const q = this.questionnaire(id);
    if (q.par_defaut)
      throw new ErreurDonnees(
        "Le questionnaire par défaut ne peut pas être supprimé : choisissez-en d'abord un autre.",
      );
    this.jeu.questionnaires = this.jeu.questionnaires.filter((x) => x.id !== id);
    for (const e of this.jeu.envois) if (e.questionnaire_id === id) e.questionnaire_id = null;
    this.sauver();
  }

  async definirQuestionnaireParDefaut(id: string) {
    this.questionnaire(id);
    const uid = this.moi();
    for (const q of this.jeu.questionnaires) if (q.therapeute_id === uid) q.par_defaut = q.id === id;
    this.sauver();
  }

  // --- clients --------------------------------------------------------------
  private resumes(dansCorbeille: boolean): ClientResume[] {
    const uid = this.moi();
    return this.jeu.clients
      .filter((c) => c.therapeute_id === uid && Boolean(c.supprime_le) === dansCorbeille)
      .map((c) =>
        versResume(
          c,
          this.seancesDe(c.id),
          this.jeu.client_problematiques
            .filter((x) => x.client_id === c.id)
            .map((x) => x.problematique_id)
            .sort((a, b) => a - b),
        ),
      );
  }

  /** Équivalent de `purger_corbeille()` : 30 jours après, l'effacement est définitif. */
  private purgerCorbeille() {
    const limite = new Date(Date.now() - CORBEILLE_MS).toISOString();
    const uid = this.moi();
    for (const c of this.jeu.clients.filter((x) => x.therapeute_id === uid && x.supprime_le && x.supprime_le < limite))
      this.effacer(c.id);
    // Équivalent de `purger_journal_connexions()` : journal gardé 12 mois (RGPD)
    const debutJournal = new Date();
    debutJournal.setMonth(debutJournal.getMonth() - DUREE_JOURNAL_CONNEXIONS_MOIS);
    const avant = this.jeu.journal.length;
    this.jeu.journal = this.jeu.journal.filter((j) => j.therapeute_id !== uid || j.le >= debutJournal.toISOString());
    if (this.jeu.journal.length !== avant) this.sauver();
  }

  private effacer(id: string) {
    this.jeu.clients = this.jeu.clients.filter((c) => c.id !== id);
    this.jeu.seances = this.jeu.seances.filter((s) => s.client_id !== id);
    this.jeu.client_problematiques = this.jeu.client_problematiques.filter((x) => x.client_id !== id);
    this.jeu.envois = this.jeu.envois.filter((e) => e.client_id !== id);
    this.jeu.rendez_vous = this.jeu.rendez_vous.filter((r) => r.client_id !== id);
    this.jeu.notes = this.jeu.notes.filter((n) => n.client_id !== id);
    this.jeu.remises = this.jeu.remises.filter((r) => r.client_id !== id);
    this.jeu.taches_perso = this.jeu.taches_perso.filter((t) => t.client_id !== id);
    // les reçus sont des pièces comptables : conservés, sans lien vers le client
    for (const r of this.jeu.recus) if (r.client_id === id) r.client_id = null;
    this.sauver();
  }

  /** Clients de la corbeille : invisibles partout sauf dans la corbeille et leur fiche. */
  private supprimes() {
    return new Set(this.jeu.clients.filter((c) => c.supprime_le).map((c) => c.id));
  }

  async listerClients(): Promise<ClientResume[]> {
    await attendre();
    this.purgerCorbeille();
    return this.resumes(false);
  }

  async listerCorbeille(): Promise<ClientResume[]> {
    await attendre();
    return this.resumes(true).sort((a, b) => (b.supprime_le ?? '').localeCompare(a.supprime_le ?? ''));
  }

  async lireClient(id: string) {
    await attendre();
    return copie(this.client(id));
  }

  async creerClient(nouveau: NouveauClient) {
    await attendre();
    verifierSuivi(nouveau);
    const client: Client = {
      id: crypto.randomUUID(),
      therapeute_id: this.moi(),
      nom: nouveau.nom.trim(),
      prenom: nouveau.prenom.trim(),
      annee_naissance: nouveau.annee_naissance,
      synthese_ia: null,
      synthese_ia_maj_le: null,
      cree_le: maintenant(),
      email: nouveau.email?.trim() || null,
      telephone: nouveau.telephone?.trim() || null,
      prix_seance: nouveau.prix_seance ?? null,
      relances_actives: nouveau.relances_actives ?? true,
      relance_reportee_au: null,
      accord_relance_le: nouveau.accord_relance_le ?? null,
      consentement_le: nouveau.consentement_le ?? null,
      supprime_le: null,
    };
    if (!client.nom || !client.prenom) throw new ErreurDonnees('Le nom et le prénom sont obligatoires.');
    this.jeu.clients.push(client);
    this.sauver();
    return copie(client);
  }

  async modifierClient(id: string, champs: Partial<NouveauClient>) {
    verifierSuivi(champs);
    const propres = Object.fromEntries(
      Object.entries(champs).map(([k, v]) => [
        k,
        typeof v === 'string' && ['email', 'telephone'].includes(k) ? v.trim() || null : v,
      ]),
    );
    Object.assign(this.client(id), propres);
    this.sauver();
  }

  async supprimerClient(id: string) {
    this.client(id).supprime_le = maintenant();
    this.sauver();
  }

  async restaurerClient(id: string) {
    this.client(id).supprime_le = null;
    this.sauver();
  }

  async supprimerClientDefinitivement(id: string) {
    this.client(id);
    this.effacer(id);
  }

  // --- problématiques ---------------------------------------------------------
  async listerProblematiquesClient(clientId: string): Promise<ClientProblematique[]> {
    this.client(clientId);
    return copie(this.jeu.client_problematiques.filter((x) => x.client_id === clientId));
  }

  async ajouterProblematique(clientId: string, problematiqueId: number, source: SourceProblematique) {
    this.client(clientId);
    if (this.jeu.client_problematiques.some((x) => x.client_id === clientId && x.problematique_id === problematiqueId))
      return;
    this.jeu.client_problematiques.push({
      client_id: clientId,
      therapeute_id: this.moi(),
      problematique_id: problematiqueId,
      source,
      ajoute_le: maintenant(),
    });
    this.sauver();
  }

  async retirerProblematique(clientId: string, problematiqueId: number) {
    this.client(clientId);
    this.jeu.client_problematiques = this.jeu.client_problematiques.filter(
      (x) => !(x.client_id === clientId && x.problematique_id === problematiqueId),
    );
    this.sauver();
  }

  // --- séances ------------------------------------------------------------------
  async listerSeances(clientId: string) {
    await attendre();
    this.client(clientId);
    return copie(this.seancesDe(clientId));
  }

  async lireSeance(id: string) {
    await attendre();
    return copie(this.seance(id));
  }

  async creerSeance(clientId: string, date = dateDuJour()) {
    const client = this.client(clientId);
    const existantes = this.seancesDe(clientId);
    const deja = existantes.length;
    const precedente = existantes[deja - 1];
    const type: TypeSeance =
      deja < SEANCES_INITIALES ? 'initiale' : deja + 1 === NUMERO_BILAN ? 'bilan' : 'supplementaire';
    const p = this.param();
    const seance: Seance = {
      id: crypto.randomUUID(),
      client_id: client.id,
      therapeute_id: this.moi(),
      numero: deja + 1,
      type,
      date_seance: date,
      lignee: precedente?.lignee ?? null,
      objectif: precedente?.objectif ?? '',
      tim: '',
      notes: '',
      cases: [],
      prix: p.tarifs_actifs ? (client.prix_seance ?? p.prix_defaut) : null,
      analyse_ia: null,
      analyse_ia_le: null,
    };
    this.jeu.seances.push(seance);
    this.sauver();
    return copie(seance);
  }

  async enregistrerSeance(id: string, fiche: FicheSeance) {
    await attendre();
    if (fiche.prix !== null && !(fiche.prix >= 0)) throw new ErreurDonnees('Tarif invalide.');
    Object.assign(this.seance(id), copie(fiche));
    this.sauver();
  }

  async supprimerSeance(id: string) {
    const s = this.seance(id);
    if (this.jeu.seances.some((x) => x.client_id === s.client_id && x.numero > s.numero))
      throw new ErreurDonnees('Seule la dernière séance du parcours peut être supprimée.');
    this.jeu.seances = this.jeu.seances.filter((x) => x.id !== id);
    // comme « on delete set null » : le rendez-vous reste, sans lien vers la séance
    for (const r of this.jeu.rendez_vous) if (r.seance_id === id) r.seance_id = null;
    this.sauver();
  }

  // --- journal ------------------------------------------------------------------------
  private sans<T extends { therapeute_id: string }>(x: T): Omit<T, 'therapeute_id'> {
    const { therapeute_id: _, ...reste } = x;
    return copie(reste);
  }
  private clientActif(id: string | null) {
    return !id || !this.supprimes().has(id);
  }

  async notes(): Promise<Note[]> {
    await attendre(60);
    const uid = this.moi();
    return this.jeu.notes
      .filter((n) => n.therapeute_id === uid && this.clientActif(n.client_id))
      .sort((a, b) => Number(b.epinglee) - Number(a.epinglee) || b.maj_le.localeCompare(a.maj_le))
      .map((n) => this.sans(n));
  }

  async enregistrerNote(id: string | null, champs: NoteModifiable): Promise<Note> {
    await attendre();
    if (!champs.titre.trim() && !champs.contenu.trim()) throw new ErreurDonnees('La note est vide.');
    if (champs.titre.length > 120 || champs.contenu.length > 20000) throw new ErreurDonnees('Note trop longue.');
    if (champs.client_id) this.client(champs.client_id);
    const uid = this.moi();
    let n = id ? this.jeu.notes.find((x) => x.id === id && x.therapeute_id === uid) : undefined;
    if (id && !n) throw new ErreurDonnees('Note introuvable.');
    if (n) Object.assign(n, champs, { maj_le: maintenant() });
    else {
      n = { id: crypto.randomUUID(), therapeute_id: uid, ...champs, cree_le: maintenant(), maj_le: maintenant() };
      this.jeu.notes.push(n);
    }
    this.sauver();
    return this.sans(n);
  }

  async supprimerNote(id: string) {
    const uid = this.moi();
    this.jeu.notes = this.jeu.notes.filter((n) => !(n.id === id && n.therapeute_id === uid));
    this.sauver();
  }

  // --- exercices et documents ------------------------------------------------------------
  async ressources(): Promise<Ressource[]> {
    await attendre(60);
    const uid = this.moi();
    return this.jeu.ressources
      .filter((d) => d.therapeute_id === uid)
      .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
      .map((d) => this.sans(d));
  }

  async enregistrerRessource(id: string | null, champs: RessourceModifiable): Promise<Ressource> {
    await attendre();
    if (!champs.titre.trim() || champs.titre.length > 120)
      throw new ErreurDonnees('Donnez un titre (120 caractères au plus).');
    if (champs.resume.length > 300 || champs.contenu.length > 20000) throw new ErreurDonnees('Texte trop long.');
    const uid = this.moi();
    let d = id ? this.jeu.ressources.find((x) => x.id === id && x.therapeute_id === uid) : undefined;
    if (id && !d) throw new ErreurDonnees('Document introuvable.');
    const propres = { ...champs, titre: champs.titre.trim() };
    if (d) Object.assign(d, propres, { maj_le: maintenant() });
    else {
      d = { id: crypto.randomUUID(), therapeute_id: uid, ...propres, cree_le: maintenant(), maj_le: maintenant() };
      this.jeu.ressources.push(d);
    }
    this.sauver();
    return this.sans(d);
  }

  async supprimerRessource(id: string) {
    const uid = this.moi();
    this.jeu.ressources = this.jeu.ressources.filter((d) => !(d.id === id && d.therapeute_id === uid));
    for (const r of this.jeu.remises) if (r.document_id === id) r.document_id = null; // « on delete set null »
    this.sauver();
  }

  async preparerRemise(ressourceId: string, clientId: string, mode: 'lien' | 'imprime'): Promise<RemisePreparee> {
    const uid = this.moi();
    const d = this.jeu.ressources.find((x) => x.id === ressourceId && x.therapeute_id === uid);
    if (!d) throw new ErreurDonnees('Document introuvable.');
    if (this.client(clientId).supprime_le) throw new ErreurDonnees('Client introuvable.');
    const jeton = mode === 'lien' ? genererJeton() : null;
    const expire_le = jeton ? new Date(Date.now() + 90 * 86_400_000).toISOString() : null;
    const remise: RemiseDemo = {
      id: crypto.randomUUID(),
      therapeute_id: uid,
      client_id: clientId,
      document_id: d.id,
      mode,
      titre: d.titre,
      contenu: d.contenu,
      jeton_hash: jeton ? await empreinteJeton(jeton) : null,
      cree_le: maintenant(),
      expire_le,
      ouvert_le: null,
      reponses: null,
      repondu_le: null,
      consulte_le: null,
      nb_questions: questionsDocument(d.contenu).length,
      rappel_le: null,
    };
    this.jeu.remises.push(remise);
    this.sauver();
    return { id: remise.id, jeton, expire_le };
  }

  async listerRemises(clientId?: string): Promise<Remise[]> {
    const uid = this.moi();
    return this.jeu.remises
      .filter(
        (x) => x.therapeute_id === uid && (!clientId || x.client_id === clientId) && this.clientActif(x.client_id),
      )
      .sort((a, b) => b.cree_le.localeCompare(a.cree_le))
      .map(({ therapeute_id: _t, contenu: _c, jeton_hash: _h, ...x }) => copie(x));
  }

  async supprimerRemise(id: string) {
    const uid = this.moi();
    this.jeu.remises = this.jeu.remises.filter((x) => !(x.id === id && x.therapeute_id === uid));
    this.sauver();
  }

  async documentPublic(jeton: string): Promise<DocumentPublic> {
    await attendre();
    this.jeu = this.charger() ?? this.jeu;
    const hash = await empreinteJeton(jeton);
    const r = this.jeu.remises.find((x) => x.jeton_hash === hash);
    if (!r || this.supprimes().has(r.client_id)) return { valide: false, raison: 'inconnu' };
    const p = this.jeu.parametres[r.therapeute_id];
    if (r.expire_le && r.expire_le < maintenant())
      return { valide: false, raison: 'expire', nom_site: p.nom_site, couleur: p.couleur };
    if (!r.ouvert_le) {
      r.ouvert_le = maintenant();
      this.sauver();
    }
    const t = this.jeu.therapeutes.find((x) => x.id === r.therapeute_id)!;
    return {
      valide: true,
      titre: r.titre,
      contenu: r.contenu,
      therapeute: `${t.prenom} ${t.nom}`.trim(),
      nom_site: p.nom_site,
      couleur: p.couleur,
      expire_le: r.expire_le!,
      repondu_le: r.repondu_le,
    };
  }

  /** Miroir de `repondre_document()`. */
  async repondreDocument(jeton: string, reponses: string[]) {
    await attendre();
    this.jeu = this.charger() ?? this.jeu;
    const hash = await empreinteJeton(jeton);
    const r = this.jeu.remises.find((x) => x.jeton_hash === hash);
    if (!r || this.supprimes().has(r.client_id)) throw new ErreurDonnees('Lien introuvable.');
    if (r.expire_le && r.expire_le < maintenant()) throw new ErreurDonnees('Ce lien a expiré.');
    if (r.repondu_le) throw new ErreurDonnees('Vos réponses ont déjà été envoyées.');
    try {
      r.reponses = validerReponsesDocument(questionsDocument(r.contenu), reponses);
    } catch (e) {
      throw new ErreurDonnees((e as Error).message);
    }
    r.repondu_le = maintenant();
    r.ouvert_le ??= r.repondu_le;
    this.sauver();
  }

  /** Miroir de `relancer_remise()`. */
  async relancerRemise(id: string) {
    await attendre();
    const r = this.jeu.remises.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!r) throw new ErreurDonnees('Document introuvable.');
    if (this.supprimes().has(r.client_id)) throw new ErreurDonnees('Client introuvable.');
    if (r.mode !== 'lien') throw new ErreurDonnees('Ce document a été remis sur papier.');
    if (r.repondu_le) throw new ErreurDonnees('Le client a déjà répondu.');
    const jeton = genererJeton();
    r.jeton_hash = await empreinteJeton(jeton);
    r.expire_le = new Date(Date.now() + 90 * 86_400_000).toISOString();
    r.rappel_le = maintenant();
    this.sauver();
    return { jeton, expire_le: r.expire_le };
  }

  async marquerRemiseConsultee(id: string) {
    const r = this.jeu.remises.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (r && !r.consulte_le) {
      r.consulte_le = maintenant();
      this.sauver();
    }
  }

  // --- reçus ------------------------------------------------------------------------------
  async listerRecus(): Promise<Recu[]> {
    await attendre(60);
    const uid = this.moi();
    return this.jeu.recus
      .filter((r) => r.therapeute_id === uid)
      .sort((a, b) => b.annee - a.annee || b.numero - a.numero)
      .map(({ jeton_hash: _, ...r }) => this.sans(r));
  }

  /** Miroir de `emettre_recu()` : numéro suivant de l'année, un seul reçu valide par séance. */
  async emettreRecu(seanceId: string, mode: ModeReglement, dateEmission: string): Promise<Recu> {
    await attendre();
    const uid = this.moi();
    const s = this.seance(seanceId);
    if (s.prix === null) throw new ErreurDonnees("Indiquez d'abord le tarif de cette séance.");
    if (this.dejaRecue(s.id)) throw new ErreurDonnees('Un reçu a déjà été émis pour cette séance.');
    const demain = dateDuJour(new Date(Date.now() + 86_400_000));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEmission) || dateEmission < s.date_seance || dateEmission > demain)
      throw new ErreurDonnees("La date du reçu doit être comprise entre la séance et aujourd'hui.");
    const c = this.client(s.client_id);
    if (c.supprime_le) throw new ErreurDonnees('Client introuvable.');
    const t = this.therapeute();
    const p = this.param();
    const annee = Number(dateEmission.slice(0, 4));
    const recu: RecuDemo = {
      id: crypto.randomUUID(),
      therapeute_id: uid,
      annee,
      numero:
        Math.max(
          0,
          ...this.jeu.recus.filter((r) => r.therapeute_id === uid && r.annee === annee).map((r) => r.numero),
        ) + 1,
      client_id: c.id,
      seance_id: s.id,
      client_nom: `${c.prenom} ${c.nom}`.trim(),
      date_seance: s.date_seance,
      date_emission: dateEmission,
      prestation: `Séance d'accompagnement comportemental et émotionnel n° ${s.numero}${s.type === 'bilan' ? ' (bilan)' : ''}`,
      montant: Number(s.prix),
      mode_reglement: mode,
      emetteur: {
        nom: `${t.prenom} ${t.nom}`.trim(),
        specialite: p.specialite,
        adresse: p.adresse_pro,
        telephone: p.telephone_pro,
        siret: p.siret,
        mention: p.mention_recu,
      },
      annule_le: null,
      motif_annulation: '',
      cree_le: maintenant(),
      jeton_hash: null,
      lien_expire_le: null,
      lien_ouvert_le: null,
      lignes: [],
    };
    recu.lignes = [{ seance_id: s.id, date_seance: s.date_seance, prestation: recu.prestation, montant: recu.montant }];
    this.jeu.recus.push(recu);
    this.sauver();
    const { jeton_hash: _, ...sans } = recu;
    return this.sans(sans);
  }

  async annulerRecu(id: string, motif: string) {
    if (!motif.trim()) throw new ErreurDonnees("Indiquez le motif de l'annulation.");
    const r = this.jeu.recus.find((x) => x.id === id && x.therapeute_id === this.moi() && !x.annule_le);
    if (!r) throw new ErreurDonnees('Reçu introuvable ou déjà annulé.');
    r.annule_le = maintenant();
    r.motif_annulation = motif.trim().slice(0, 300);
    this.sauver();
  }

  /** Une séance ne figure que sur un seul reçu valide (seul ou groupé). */
  private dejaRecue(seanceId: string) {
    return this.jeu.recus.some((r) => !r.annule_le && r.lignes.some((l) => l.seance_id === seanceId));
  }

  /** Miroir de `emettre_recu_groupe()`. */
  async emettreRecuGroupe(seanceIds: string[], mode: ModeReglement, dateEmission: string): Promise<Recu> {
    await attendre();
    const uid = this.moi();
    const ids = [...new Set(seanceIds)];
    if (ids.length < 2 || ids.length > 31) throw new ErreurDonnees('Choisissez de 2 à 31 séances pour un reçu groupé.');
    const seances = ids
      .map((id) => this.seance(id))
      .sort((a, b) => a.date_seance.localeCompare(b.date_seance) || a.numero - b.numero);
    if (new Set(seances.map((s) => s.client_id)).size !== 1)
      throw new ErreurDonnees('Un reçu groupé concerne un seul client.');
    if (seances.some((s) => s.prix === null)) throw new ErreurDonnees("Indiquez d'abord le tarif de chaque séance.");
    if (seances.some((s) => this.dejaRecue(s.id)))
      throw new ErreurDonnees("Un reçu a déjà été émis pour l'une de ces séances.");
    const derniere = seances[seances.length - 1].date_seance;
    const demain = dateDuJour(new Date(Date.now() + 86_400_000));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEmission) || dateEmission < derniere || dateEmission > demain)
      throw new ErreurDonnees("La date du reçu doit être comprise entre la dernière séance et aujourd'hui.");
    const c = this.client(seances[0].client_id);
    if (c.supprime_le) throw new ErreurDonnees('Client introuvable.');
    const t = this.therapeute();
    const p = this.param();
    const annee = Number(dateEmission.slice(0, 4));
    const lignes = seances.map((s) => ({
      seance_id: s.id,
      date_seance: s.date_seance,
      prestation: `Séance d'accompagnement comportemental et émotionnel n° ${s.numero}${s.type === 'bilan' ? ' (bilan)' : ''}`,
      montant: Number(s.prix),
    }));
    const recu: RecuDemo = {
      id: crypto.randomUUID(),
      therapeute_id: uid,
      annee,
      numero:
        Math.max(
          0,
          ...this.jeu.recus.filter((r) => r.therapeute_id === uid && r.annee === annee).map((r) => r.numero),
        ) + 1,
      client_id: c.id,
      seance_id: null,
      client_nom: `${c.prenom} ${c.nom}`.trim(),
      date_seance: derniere,
      date_emission: dateEmission,
      prestation: `Séances d'accompagnement comportemental et émotionnel (${lignes.length})`,
      montant: lignes.reduce((s, l) => s + Math.round(l.montant * 100), 0) / 100,
      mode_reglement: mode,
      emetteur: {
        nom: `${t.prenom} ${t.nom}`.trim(),
        specialite: p.specialite,
        adresse: p.adresse_pro,
        telephone: p.telephone_pro,
        siret: p.siret,
        mention: p.mention_recu,
      },
      annule_le: null,
      motif_annulation: '',
      cree_le: maintenant(),
      jeton_hash: null,
      lien_expire_le: null,
      lien_ouvert_le: null,
      lignes,
    };
    this.jeu.recus.push(recu);
    this.sauver();
    const { jeton_hash: _, ...sans } = recu;
    return this.sans(sans);
  }

  /** Miroir de `preparer_lien_recu()`. */
  async preparerLienRecu(id: string) {
    await attendre();
    const r = this.jeu.recus.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!r) throw new ErreurDonnees('Reçu introuvable.');
    if (r.annule_le) throw new ErreurDonnees('Ce reçu est annulé : émettez-en un nouveau.');
    if (!r.client_id || this.supprimes().has(r.client_id)) throw new ErreurDonnees('Client introuvable.');
    const jeton = genererJeton();
    r.jeton_hash = await empreinteJeton(jeton);
    r.lien_expire_le = new Date(Date.now() + 90 * 86_400_000).toISOString();
    r.lien_ouvert_le = null;
    this.sauver();
    return { jeton, expire_le: r.lien_expire_le };
  }

  /** Miroir de `recu_public()`. */
  async recuPublic(jeton: string): Promise<RecuPublic> {
    await attendre();
    this.jeu = this.charger() ?? this.jeu;
    const hash = await empreinteJeton(jeton);
    const r = this.jeu.recus.find((x) => x.jeton_hash === hash);
    if (!r || !r.client_id || this.supprimes().has(r.client_id)) return { valide: false, raison: 'inconnu' };
    const p = this.jeu.parametres[r.therapeute_id];
    if (r.lien_expire_le && r.lien_expire_le < maintenant())
      return { valide: false, raison: 'expire', nom_site: p.nom_site, couleur: p.couleur };
    if (!r.lien_ouvert_le) {
      r.lien_ouvert_le = maintenant();
      this.sauver();
    }
    return {
      valide: true,
      nom_site: p.nom_site,
      couleur: p.couleur,
      expire_le: r.lien_expire_le!,
      recu: copie({
        annee: r.annee,
        numero: r.numero,
        client_nom: r.client_nom,
        date_seance: r.date_seance,
        date_emission: r.date_emission,
        prestation: r.prestation,
        montant: r.montant,
        mode_reglement: r.mode_reglement,
        emetteur: r.emetteur,
        annule_le: r.annule_le,
        motif_annulation: r.motif_annulation,
        lignes: r.lignes.map(({ seance_id: _, ...l }) => l),
      }),
    };
  }

  // --- tâches personnelles et « plus tard » -----------------------------------------------
  async tachesPerso(): Promise<TachePerso[]> {
    const uid = this.moi();
    return this.jeu.taches_perso
      .filter((x) => x.therapeute_id === uid && this.clientActif(x.client_id))
      .sort((a, b) => a.cree_le.localeCompare(b.cree_le))
      .map(({ precedente: _, ...x }) => this.sans(x));
  }

  async enregistrerTachePerso(id: string | null, champs: TachePersoModifiable): Promise<TachePerso> {
    const uid = this.moi();
    if (champs.client_id) this.client(champs.client_id);
    let x = id ? this.jeu.taches_perso.find((t) => t.id === id && t.therapeute_id === uid) : undefined;
    if (id && !x) throw new ErreurDonnees('Tâche introuvable.');
    const suivant = {
      titre: '',
      echeance: null,
      client_id: null,
      faite_le: null,
      recurrence: 'aucune' as const,
      precedente: null,
      ...x,
      ...champs,
    };
    if (!suivant.titre.trim() || suivant.titre.length > 200)
      throw new ErreurDonnees('Décrivez la tâche (200 caractères au plus).');
    const avant = x?.faite_le ?? null;
    if (x) Object.assign(x, champs);
    else {
      x = {
        id: crypto.randomUUID(),
        therapeute_id: uid,
        ...suivant,
        titre: suivant.titre.trim(),
        cree_le: maintenant(),
      };
      this.jeu.taches_perso.push(x);
    }
    // miroir du déclencheur tache_recurrente : cochée → la suivante ; décochée → la suivante retirée
    if (id && 'faite_le' in champs) {
      const t = x;
      if (!avant && t.faite_le && t.recurrence !== 'aucune')
        this.jeu.taches_perso.push({
          id: crypto.randomUUID(),
          therapeute_id: uid,
          client_id: t.client_id,
          titre: t.titre,
          echeance: echeanceSuivante(t.echeance, t.recurrence, dateDuJour(new Date(t.faite_le))),
          faite_le: null,
          recurrence: t.recurrence,
          precedente: t.id,
          cree_le: maintenant(),
        });
      else if (avant && !t.faite_le)
        this.jeu.taches_perso = this.jeu.taches_perso.filter((y) => !(y.precedente === t.id && !y.faite_le));
    }
    this.sauver();
    const { precedente: _, ...sans } = x;
    return this.sans(sans);
  }

  async supprimerTachePerso(id: string) {
    const uid = this.moi();
    this.jeu.taches_perso = this.jeu.taches_perso.filter((x) => !(x.id === id && x.therapeute_id === uid));
    for (const x of this.jeu.taches_perso) if (x.precedente === id) x.precedente = null; // « on delete set null »
    this.sauver();
  }

  async reportsTaches(): Promise<ReportTache[]> {
    const uid = this.moi();
    return this.jeu.reports.filter((x) => x.therapeute_id === uid).map(({ cle, jusqua }) => ({ cle, jusqua }));
  }

  async reporterTache(cle: string, jusqua: string | null) {
    const uid = this.moi();
    this.jeu.reports = this.jeu.reports.filter((x) => !(x.therapeute_id === uid && x.cle === cle));
    if (jusqua) this.jeu.reports.push({ therapeute_id: uid, cle, jusqua });
    this.sauver();
  }

  // --- emploi du temps ------------------------------------------------------------
  private rendezVous(id: string): RendezVousDemo {
    const r = this.jeu.rendez_vous.find((x) => x.id === id && x.therapeute_id === this.moi());
    if (!r) throw new ErreurDonnees('Rendez-vous introuvable.');
    return r;
  }

  async listerRendezVous(de: string, a: string): Promise<RendezVous[]> {
    await attendre(60);
    const uid = this.moi();
    const supprimes = this.supprimes();
    return this.jeu.rendez_vous
      .filter(
        (r) => r.therapeute_id === uid && r.debut >= de && r.debut < a && !(r.client_id && supprimes.has(r.client_id)),
      )
      .sort((x, y) => x.debut.localeCompare(y.debut))
      .map(({ therapeute_id: _, ...r }) => copie(r));
  }

  async creerRendezVous(nouveau: NouveauRendezVous): Promise<RendezVous> {
    await attendre();
    const r: RendezVousDemo = {
      id: crypto.randomUUID(),
      therapeute_id: this.moi(),
      client_id: nouveau.client_id ?? null,
      categorie: nouveau.categorie,
      statut: nouveau.statut ?? 'prevu',
      modalite: nouveau.modalite ?? 'cabinet',
      debut: new Date(nouveau.debut).toISOString(),
      fin: new Date(nouveau.fin).toISOString(),
      titre: nouveau.titre ?? '',
      note: nouveau.note ?? '',
      seance_id: null,
      rappel_envoye_le: null,
      cree_le: maintenant(),
    };
    this.verifierRendezVous(r);
    this.jeu.rendez_vous.push(r);
    this.sauver();
    const { therapeute_id: _, ...sortie } = r;
    return copie(sortie);
  }

  async modifierRendezVous(id: string, champs: ChampsRendezVous): Promise<RendezVous> {
    await attendre();
    const r = this.rendezVous(id);
    const suivant: RendezVousDemo = { ...r, ...champs, id: r.id, therapeute_id: r.therapeute_id };
    if (champs.debut) suivant.debut = new Date(champs.debut).toISOString();
    if (champs.fin) suivant.fin = new Date(champs.fin).toISOString();
    this.verifierRendezVous(suivant);
    Object.assign(r, suivant);
    this.sauver();
    const { therapeute_id: _, ...sortie } = r;
    return copie(sortie);
  }

  async supprimerRendezVous(id: string) {
    this.rendezVous(id);
    this.jeu.rendez_vous = this.jeu.rendez_vous.filter((r) => r.id !== id);
    this.sauver();
  }

  /** Mêmes règles que les contraintes de la table `rendez_vous`. */
  private verifierRendezVous(r: RendezVousDemo) {
    const duree = Date.parse(r.fin) - Date.parse(r.debut);
    if (!(duree > 0)) throw new ErreurDonnees('La fin du rendez-vous doit suivre son début.');
    if (duree > 12 * 3_600_000) throw new ErreurDonnees('Un rendez-vous dure 12 heures au plus.');
    if ((r.categorie === 'seance' || r.categorie === 'bilan') && !r.client_id)
      throw new ErreurDonnees('Une séance ou un bilan concerne un client : choisissez-le.');
    if (!r.client_id && !r.titre.trim()) throw new ErreurDonnees('Donnez un intitulé à ce créneau.');
    if (r.titre.length > 120) throw new ErreurDonnees('Intitulé : 120 caractères au plus.');
    if (r.note.length > 1000) throw new ErreurDonnees('Note : 1000 caractères au plus.');
    if (r.client_id) this.client(r.client_id); // équivalent de la clé étrangère (client du thérapeute)
  }

  async listerSeancesTarifs() {
    const uid = this.moi();
    const supprimes = this.supprimes();
    return this.jeu.seances
      .filter((s) => s.therapeute_id === uid && !supprimes.has(s.client_id))
      .map(({ id, client_id, date_seance, prix }) => ({ id, client_id, date_seance, prix }));
  }

  // --- relances et questionnaires ------------------------------------------------
  async listerEnvois(clientId?: string): Promise<Envoi[]> {
    const uid = this.moi();
    const supprimes = this.supprimes();
    return this.jeu.envois
      .filter((e) => e.therapeute_id === uid && (clientId ? e.client_id === clientId : !supprimes.has(e.client_id)))
      .sort((a, b) => b.cree_le.localeCompare(a.cree_le))
      .map(({ therapeute_id: _t, jeton_hash: _h, ...e }) => copie(e));
  }

  async preparerEnvoi(clientId: string, canal: CanalEnvoi, questionnaireId?: string) {
    const client = this.client(clientId);
    if (client.supprime_le) throw new ErreurDonnees('Client introuvable.');
    const destinataire = canal === 'email' ? client.email : client.telephone;
    if (!destinataire) throw new ErreurDonnees("Ce client n'a pas de coordonnées pour ce canal.");
    const uid = this.moi();
    // liens préparés mais jamais sortis de l'application : inutiles
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    this.jeu.envois = this.jeu.envois.filter(
      (e) => !(e.therapeute_id === uid && !e.envoye_le && !e.lien_sorti_le && e.cree_le < hier),
    );
    const modele = questionnaireId
      ? this.questionnaire(questionnaireId)
      : this.jeu.questionnaires.find((q) => q.therapeute_id === uid && q.par_defaut);
    if (!modele) throw new ErreurDonnees('Questionnaire introuvable.');
    const questions = modele.questions.filter((q) => q.active).map(({ ordre: _o, active: _a, ...q }) => copie(q));
    if (!questions.length) throw new ErreurDonnees('Ce questionnaire ne contient aucune question active.');
    const jeton = genererJeton();
    const expire_le = new Date(Date.now() + this.param().lien_validite_jours * 86_400_000).toISOString();
    const envoi: EnvoiDemo = {
      id: crypto.randomUUID(),
      therapeute_id: uid,
      client_id: clientId,
      questionnaire_id: modele.id,
      canal,
      destinataire,
      jeton_hash: await empreinteJeton(jeton),
      objet: '',
      corps: '',
      questionnaire: { titre: modele.titre, introduction: modele.introduction, remerciement: modele.remerciement },
      questions,
      cree_le: maintenant(),
      expire_le,
      envoye_le: null,
      lien_sorti_le: null,
      reponses: null,
      repondu_le: null,
      consulte_le: null,
      analyse_ia: null,
    };
    this.jeu.envois.push(envoi);
    this.sauver();
    return { id: envoi.id, jeton, expire_le, destinataire };
  }

  async confirmerEnvoi(id: string, objet: string, corps: string) {
    const e = this.envoi(id);
    if (e.envoye_le) throw new ErreurDonnees('Envoi déjà confirmé.');
    e.objet = objet.slice(0, 300);
    e.corps = corps.slice(0, 5000).replace(/[0-9a-f]{64}/g, '[jeton masqué]');
    e.envoye_le = maintenant();
    this.sauver();
  }

  async marquerLienSorti(id: string) {
    const e = this.envoi(id);
    if (!e.lien_sorti_le) {
      e.lien_sorti_le = maintenant();
      this.sauver();
    }
  }

  async annulerEnvoi(id: string) {
    this.envoi(id);
    this.jeu.envois = this.jeu.envois.filter((e) => e.id !== id);
    this.sauver();
  }

  async marquerConsulte(id: string) {
    const e = this.envoi(id);
    if (!e.consulte_le) {
      e.consulte_le = maintenant();
      this.sauver();
    }
  }

  // Accessible sans session (lien du client) : relit le stockage, le lien
  // ayant pu être créé dans un autre onglet.
  async questionnairePublic(jeton: string): Promise<QuestionnairePublic> {
    await attendre();
    this.jeu = this.charger() ?? this.jeu;
    const e = await this.envoiParJeton(jeton);
    if (!e) return { valide: false, raison: 'inconnu' };
    const p = this.jeu.parametres[e.therapeute_id];
    if (e.repondu_le) return { valide: false, raison: 'deja_repondu', nom_site: p.nom_site, couleur: p.couleur };
    if (!e.envoye_le && !e.lien_sorti_le)
      return { valide: false, raison: 'non_envoye', nom_site: p.nom_site, couleur: p.couleur };
    if (e.expire_le < maintenant())
      return { valide: false, raison: 'expire', nom_site: p.nom_site, couleur: p.couleur };
    const t = this.jeu.therapeutes.find((x) => x.id === e.therapeute_id)!;
    return {
      valide: true,
      therapeute: `${t.prenom} ${t.nom}`.trim(),
      nom_site: p.nom_site,
      couleur: p.couleur,
      expire_le: e.expire_le,
      titre: e.questionnaire.titre ?? 'Questionnaire de suivi',
      introduction: e.questionnaire.introduction ?? '',
      remerciement: e.questionnaire.remerciement ?? '',
      questions: copie(e.questions),
      emotions: LIBELLES_EMOTIONS,
    };
  }

  async repondreQuestionnaire(jeton: string, reponses: Record<string, ValeurReponse>) {
    await attendre(300);
    this.jeu = this.charger() ?? this.jeu;
    const e = await this.envoiParJeton(jeton);
    if (!e) throw new ErreurDonnees('Lien inconnu.');
    if (e.repondu_le) throw new ErreurDonnees('Ce questionnaire a déjà été rempli.');
    if (!e.envoye_le && !e.lien_sorti_le) throw new ErreurDonnees("Ce lien n'est pas encore actif.");
    if (e.expire_le < maintenant()) throw new ErreurDonnees('Ce lien a expiré.');
    try {
      e.reponses = validerReponses(e.questions, reponses, LIBELLES_EMOTIONS);
    } catch (err) {
      throw new ErreurDonnees((err as Error).message);
    }
    e.repondu_le = maintenant();
    // une réponse prouve que le message est parti (oubli de « J'ai envoyé »)
    e.envoye_le ??= e.lien_sorti_le;
    this.sauver();
  }

  /** Envoi désigné par un lien ; celui d'un client mis à la corbeille n'existe plus pour le public. */
  private async envoiParJeton(jeton: string) {
    const hash = await empreinteJeton(jeton);
    const e = this.jeu.envois.find((x) => x.jeton_hash === hash);
    const client = e && this.jeu.clients.find((c) => c.id === e.client_id);
    return e && client && !client.supprime_le ? e : null;
  }

  // --- IA -------------------------------------------------------------------------
  async analyserSeance(id: string): Promise<AnalyseIA> {
    const s = this.seance(id);
    const client = this.client(s.client_id);
    const seances = this.seancesDe(client.id);
    const ctx = contexteAnalyse(client, s, synthesePrecedente(seances, s.numero));

    let resultat: AnalyseIA | null = null;
    const cle = this.reserverGemini();
    if (cle) {
      try {
        resultat = lireReponseGemini(
          await this.appelerGemini(cle, construireRequeteGemini(ctx)),
          ctx,
          GEMINI_MODELE_PAR_DEFAUT,
        );
      } catch {
        resultat = null; // repli local ci-dessous
      }
    }
    if (!resultat) {
      await attendre(500);
      resultat = {
        ...analyseSimulee(ctx),
        modele: cle ? `${MODELE_SIMULATION} (Gemini indisponible)` : MODELE_SIMULATION,
      };
    }

    const horodatage = maintenant();
    s.analyse_ia = resultat;
    s.analyse_ia_le = horodatage;
    if (estDerniereAnalysee(seances, s.numero)) {
      client.synthese_ia = resultat.synthese;
      client.synthese_ia_maj_le = horodatage;
    }
    this.sauver();
    return copie(resultat);
  }

  async lireQuestionnaireIA(envoiId: string): Promise<LectureQuestionnaire> {
    const e = this.envoi(envoiId);
    if (!e.reponses) throw new ErreurDonnees("Ce questionnaire n'a pas encore été rempli.");
    if (e.analyse_ia) return copie(e.analyse_ia);
    const client = this.client(e.client_id);
    const precedent = this.jeu.envois
      .filter((x) => x.client_id === e.client_id && x.reponses && x.repondu_le && x.repondu_le < e.repondu_le!)
      .sort((a, b) => b.repondu_le!.localeCompare(a.repondu_le!))[0];
    const courant = { questions: e.questions, reponses: e.reponses };
    const avant = precedent ? { questions: precedent.questions, reponses: precedent.reponses! } : null;
    const locale = lectureLocale(courant, avant);
    const identite = { nom: client.nom, prenom: client.prenom };

    const cle = this.param().ia_taches ? this.reserverGemini() : null;
    if (!cle) return locale; // rien à conserver : la lecture locale se recalcule à l'affichage
    let lecture = locale;
    try {
      lecture = lireReponseLecture(
        await this.appelerGemini(cle, construireRequeteLecture(courant, avant, locale, identite)),
        locale,
        GEMINI_MODELE_PAR_DEFAUT,
        identite,
      );
    } catch {
      return locale;
    }
    e.analyse_ia = lecture;
    this.sauver();
    return copie(lecture);
  }

  // --- statistiques -------------------------------------------------------------
  async statistiques(perimetre: Perimetre, periode: PeriodeStatistiques = 'tout'): Promise<Statistiques> {
    await attendre();
    return calculerStatistiques(this.jeu, this.moi(), perimetre, dateDuJour(), periode);
  }
}

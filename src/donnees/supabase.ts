// Source de données « production » : Supabase (Postgres + RLS).
// La sécurité ne repose PAS sur ce fichier : même un client modifié ne
// peut lire que les lignes que la RLS lui autorise.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dateDuJour } from '../domaine/format';
import { decrireAppareil, problemeMotDePasse } from '../domaine/securite';
import type {
  AnalyseIA,
  CanalEnvoi,
  CaseFiche,
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
  LectureQuestionnaire,
  NouveauClient,
  NouveauRendezVous,
  Parametres,
  PeriodeStatistiques,
  Perimetre,
  Question,
  Questionnaire,
  QuestionnaireModifiable,
  QuestionnairePublic,
  QuotaIA,
  RendezVous,
  ResultatConnexion,
  Seance,
  SeanceTarif,
  SourceProblematique,
  Statistiques,
  Therapeute,
  ValeurReponse,
} from '../domaine/types';
import { memoriserSession, stockageSession } from './memoireSession';
import { ErreurDonnees, type SourceDonnees } from './source';

const COLONNES_SEANCE = `
  id, client_id, therapeute_id, numero, type, date_seance, lignee, objectif, tim, notes, prix,
  analyse_ia, analyse_ia_le,
  seance_cases ( zone, position, emotion_id )`;

const COLONNES_ENVOI =
  'id, client_id, questionnaire_id, canal, destinataire, objet, corps, questionnaire, questions, cree_le, expire_le, envoye_le, lien_sorti_le, reponses, repondu_le, consulte_le, analyse_ia';

/** Retire la jointure technique `clients` (filtre « hors corbeille ») des lignes reçues. */
const sansJointure = <T extends { clients?: unknown }>(lignes: T[]) => lignes.map(({ clients: _, ...l }) => l);

const COLONNES_PARAMETRES = [
  'nom_site',
  'couleur',
  'taille_texte',
  'densite',
  'vision',
  'reduire_animations',
  'page_accueil',
  'specialite',
  'telephone_pro',
  'signature',
  'photo',
  'tarifs_actifs',
  'prix_defaut',
  'relances_actives',
  'relance_delai_jours',
  'relance_intervalle_jours',
  'relance_max',
  'lien_validite_jours',
  'modele_email_objet',
  'modele_email',
  'modele_sms',
  'deconnexion_minutes',
  'ia_taches',
  'ia_quota_jour',
  'agenda_heure_debut',
  'agenda_heure_fin',
  'agenda_jours',
  'duree_rdv_minutes',
  'agenda_couleurs',
  'modele_rappel',
  'adresse_pro',
  'siret',
  'mention_recu',
  'exercice_rappel_jours',
].join(', ');

const COLONNES_NOTE = 'id, client_id, titre, contenu, epinglee, cree_le, maj_le';
const COLONNES_RESSOURCE = 'id, titre, categorie, resume, contenu, cree_le, maj_le';
const COLONNES_TACHE_PERSO = 'id, client_id, titre, echeance, faite_le, cree_le, recurrence';
// jamais `jeton_hash` : l'empreinte du lien reste en base
const COLONNES_RECU =
  'id, annee, numero, client_id, seance_id, client_nom, date_seance, date_emission, prestation, montant, mode_reglement, emetteur, annule_le, motif_annulation, cree_le, lien_expire_le, lien_ouvert_le, lignes:recus_lignes(seance_id, date_seance, prestation, montant, ordre)';
type LigneLue = Recu['lignes'][number] & { ordre: number };
const versRecu = (r: Omit<Recu, 'lignes'> & { lignes: LigneLue[] }): Recu => ({
  ...r,
  montant: Number(r.montant),
  lignes: [...r.lignes]
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ ordre: _, ...l }) => ({ ...l, montant: Number(l.montant) })),
});

const COLONNES_RDV =
  'id, client_id, categorie, statut, modalite, debut, fin, titre, note, seance_id, rappel_envoye_le, cree_le';

/** Horodatages au format `toISOString()` (Postgres renvoie « +00:00 ») : comparables entre eux. */
const versRendezVous = (r: RendezVous): RendezVous => ({
  ...r,
  debut: new Date(r.debut).toISOString(),
  fin: new Date(r.fin).toISOString(),
});

const COLONNES_QUESTION =
  'id, ordre, libelle, type, aide, obligatoire, options, minimum, maximum, sens, libelle_min, libelle_max, active';

type LigneSeance = Omit<Seance, 'cases'> & { seance_cases: CaseFiche[] };

const versSeance = ({ seance_cases, ...s }: LigneSeance): Seance => ({ ...s, cases: seance_cases });

/** Traduit les erreurs Postgres / PostgREST en messages lisibles. */
function verifier<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    if (r.error.code === 'PGRST301' || /JWT expired/i.test(r.error.message))
      throw new ErreurDonnees('Session expirée : reconnectez-vous.');
    const messages: Record<string, string> = {
      PGRST116: 'Élément introuvable.',
      '42501': 'Accès refusé.',
      '23514': r.error.message,
      '22023': r.error.message,
      '23505': r.error.message,
      P0002: r.error.message,
    };
    throw new ErreurDonnees(messages[r.error.code ?? ''] ?? `Erreur serveur : ${r.error.message}`);
  }
  return r.data;
}

export class SourceSupabase implements SourceDonnees {
  readonly mode = 'supabase' as const;
  private db: SupabaseClient;
  private corbeillePurgee = false;

  constructor(url: string, clePublique: string) {
    this.db = createClient(url, clePublique, {
      auth: {
        // Session limitée à l'onglet, ou gardée 8 h si « rester connecté »
        // (voir memoireSession.ts).
        storage: stockageSession,
        persistSession: true,
        // Pas de connexion par lien reçu par e-mail : ni inscription, ni
        // « mot de passe oublié » dans cette application.
        detectSessionInUrl: false,
      },
    });
  }

  // --- compte et sécurité ---------------------------------------------------
  private async profil(id: string, email: string): Promise<Therapeute> {
    const t = verifier(await this.db.from('therapeutes').select('id, nom, prenom').eq('id', id).single()) as Omit<
      Therapeute,
      'email'
    >;
    return { ...t, email };
  }

  /** Vrai si le compte exige un code et que la session ne l'a pas encore fourni. */
  private async codeManquant() {
    const { data } = await this.db.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  }

  private async ouvrirSession(): Promise<Therapeute> {
    const { data } = await this.db.auth.getUser();
    if (!data.user) throw new ErreurDonnees('Session invalide.');
    await this.db.from('journal_connexions').insert({ appareil: decrireAppareil() });
    return this.profil(data.user.id, data.user.email ?? '');
  }

  async sessionCourante() {
    const { data } = await this.db.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    if (await this.codeManquant()) return null; // session à demi ouverte : on redemande tout
    return this.profil(u.id, u.email ?? '');
  }

  async connexion(email: string, motDePasse: string, memoriser = false): Promise<ResultatConnexion> {
    memoriserSession(memoriser); // avant la connexion : décide où la session est écrite
    const { data, error } = await this.db.auth.signInWithPassword({ email, password: motDePasse });
    if (error || !data.user)
      throw new ErreurDonnees(
        error?.status === 429 ? "Trop d'essais : patientez avant de réessayer." : 'Adresse ou mot de passe incorrect.',
      );
    if (await this.codeManquant()) return { etape: 'double_authentification' };
    return { etape: 'ok', therapeute: await this.ouvrirSession() };
  }

  async verifierCodeConnexion(code: string) {
    const { data } = await this.db.auth.mfa.listFactors();
    const facteur = data?.totp[0];
    if (!facteur) throw new ErreurDonnees('Aucune double authentification active.');
    const { error } = await this.db.auth.mfa.challengeAndVerify({
      factorId: facteur.id,
      code: code.replace(/\s/g, ''),
    });
    if (error) throw new ErreurDonnees('Code incorrect.');
    return this.ouvrirSession();
  }

  async deconnexion() {
    // « local » : ferme cette session seulement, pas celles des autres appareils
    await this.db.auth.signOut({ scope: 'local' });
    memoriserSession(false);
    this.corbeillePurgee = false;
  }

  async changerMotDePasse(actuel: string, nouveau: string) {
    const { data } = await this.db.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new ErreurDonnees('Session invalide.');
    const { error } = await this.db.auth.signInWithPassword({ email, password: actuel });
    if (error) throw new ErreurDonnees('Mot de passe actuel incorrect.');
    const probleme = problemeMotDePasse(nouveau);
    if (probleme) throw new ErreurDonnees(probleme);
    const { error: e2 } = await this.db.auth.updateUser({ password: nouveau });
    if (e2) throw new ErreurDonnees(e2.message);
  }

  async modifierProfil(prenom: string, nom: string) {
    if (!prenom.trim() || !nom.trim()) throw new ErreurDonnees('Le prénom et le nom sont obligatoires.');
    const { data } = await this.db.auth.getUser();
    if (!data.user) throw new ErreurDonnees('Session invalide.');
    verifier(
      await this.db.from('therapeutes').update({ prenom: prenom.trim(), nom: nom.trim() }).eq('id', data.user.id),
    );
    return this.profil(data.user.id, data.user.email ?? '');
  }

  async journalConnexions() {
    return verifier(
      await this.db.from('journal_connexions').select('le, appareil').order('le', { ascending: false }).limit(20),
    ) as Connexion[];
  }

  async mfaActive() {
    const { data } = await this.db.auth.mfa.listFactors();
    return (data?.totp.length ?? 0) > 0;
  }

  async mfaCommencer() {
    // nettoie une activation abandonnée
    const { data: existants } = await this.db.auth.mfa.listFactors();
    for (const f of existants?.all ?? [])
      if (f.status === 'unverified') await this.db.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await this.db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Application' });
    if (error || !data) throw new ErreurDonnees('Activation impossible pour le moment.');
    return { id: data.id, secret: data.totp.secret, uri: data.totp.uri, qr: data.totp.qr_code };
  }

  async mfaActiver(id: string, code: string) {
    const { error } = await this.db.auth.mfa.challengeAndVerify({ factorId: id, code: code.replace(/\s/g, '') });
    if (error) throw new ErreurDonnees('Code incorrect.');
  }

  async mfaDesactiver(code: string) {
    const { data } = await this.db.auth.mfa.listFactors();
    const facteur = data?.totp[0];
    if (!facteur) return;
    const { error } = await this.db.auth.mfa.challengeAndVerify({
      factorId: facteur.id,
      code: code.replace(/\s/g, ''),
    });
    if (error) throw new ErreurDonnees('Code incorrect.');
    const { error: e2 } = await this.db.auth.mfa.unenroll({ factorId: facteur.id });
    if (e2) throw new ErreurDonnees(e2.message);
  }

  // --- paramètres et questionnaires --------------------------------------------
  async parametres() {
    return verifier(await this.db.from('parametres').select(COLONNES_PARAMETRES).single()) as unknown as Parametres;
  }

  async enregistrerParametres(champs: Partial<Parametres>) {
    const { data } = await this.db.auth.getUser();
    return verifier(
      await this.db
        .from('parametres')
        .update(champs)
        .eq('therapeute_id', data.user?.id ?? '')
        .select(COLONNES_PARAMETRES)
        .single(),
    ) as unknown as Parametres;
  }

  async questionnaires() {
    const lignes = verifier(
      await this.db
        .from('questionnaires')
        .select(`id, titre, introduction, remerciement, par_defaut, ordre, questions ( ${COLONNES_QUESTION} )`)
        .order('ordre'),
    ) as unknown as (Omit<Questionnaire, 'questions'> & { questions: Question[] })[];
    return lignes.map((q) => ({ ...q, questions: [...q.questions].sort((a, b) => a.ordre - b.ordre) }));
  }

  async enregistrerQuestionnaire(questionnaire: QuestionnaireModifiable) {
    const id = verifier(await this.db.rpc('enregistrer_questionnaire', { p_questionnaire: questionnaire })) as string;
    const tous = await this.questionnaires();
    const enregistre = tous.find((q) => q.id === id);
    if (!enregistre) throw new ErreurDonnees('Questionnaire introuvable après enregistrement.');
    return enregistre;
  }

  async supprimerQuestionnaire(id: string) {
    verifier(await this.db.from('questionnaires').delete().eq('id', id));
  }

  async definirQuestionnaireParDefaut(id: string) {
    verifier(await this.db.rpc('definir_questionnaire_par_defaut', { p_id: id }));
  }

  // --- clients ------------------------------------------------------------------
  async listerClients() {
    if (!this.corbeillePurgee) {
      // une fois par session : efface la corbeille de plus de 30 jours
      verifier(await this.db.rpc('purger_corbeille'));
      this.corbeillePurgee = true;
    }
    return verifier(
      await this.db.from('clients_resume').select('*').is('supprime_le', null).order('nom'),
    ) as ClientResume[];
  }

  async listerCorbeille() {
    return verifier(
      await this.db
        .from('clients_resume')
        .select('*')
        .not('supprime_le', 'is', null)
        .order('supprime_le', { ascending: false }),
    ) as ClientResume[];
  }

  async lireClient(id: string) {
    return verifier(await this.db.from('clients').select('*').eq('id', id).single()) as Client;
  }

  async creerClient(client: NouveauClient) {
    return verifier(await this.db.from('clients').insert(client).select().single()) as Client;
  }

  async modifierClient(id: string, champs: Partial<NouveauClient>) {
    verifier(await this.db.from('clients').update(champs).eq('id', id));
  }

  async supprimerClient(id: string) {
    verifier(await this.db.from('clients').update({ supprime_le: new Date().toISOString() }).eq('id', id));
  }

  async restaurerClient(id: string) {
    verifier(await this.db.from('clients').update({ supprime_le: null }).eq('id', id));
  }

  async supprimerClientDefinitivement(id: string) {
    verifier(await this.db.from('clients').delete().eq('id', id));
  }

  async listerProblematiquesClient(clientId: string) {
    return verifier(
      await this.db.from('client_problematiques').select('*').eq('client_id', clientId),
    ) as ClientProblematique[];
  }

  async ajouterProblematique(clientId: string, problematiqueId: number, source: SourceProblematique) {
    verifier(
      await this.db
        .from('client_problematiques')
        .upsert({ client_id: clientId, problematique_id: problematiqueId, source }, { ignoreDuplicates: true }),
    );
  }

  async retirerProblematique(clientId: string, problematiqueId: number) {
    verifier(
      await this.db
        .from('client_problematiques')
        .delete()
        .eq('client_id', clientId)
        .eq('problematique_id', problematiqueId),
    );
  }

  // --- séances --------------------------------------------------------------------
  async listerSeances(clientId: string) {
    const lignes = verifier(
      await this.db.from('seances').select(COLONNES_SEANCE).eq('client_id', clientId).order('numero'),
    ) as unknown as LigneSeance[];
    return lignes.map(versSeance);
  }

  async lireSeance(id: string) {
    const ligne = verifier(await this.db.from('seances').select(COLONNES_SEANCE).eq('id', id).single());
    return versSeance(ligne as unknown as LigneSeance);
  }

  async creerSeance(clientId: string, date = dateDuJour()) {
    // Pré-remplit lignée et objectif depuis la séance précédente ; numéro,
    // type et tarif sont attribués par les déclencheurs de la base. La date
    // est celle du jour EN HEURE LOCALE (la base est en UTC), ou celle du rendez-vous.
    const { data: precedente } = await this.db
      .from('seances')
      .select('lignee, objectif')
      .eq('client_id', clientId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle();
    const ligne = verifier(
      await this.db
        .from('seances')
        .insert({
          client_id: clientId,
          date_seance: date,
          lignee: precedente?.lignee ?? null,
          objectif: precedente?.objectif ?? '',
        })
        .select(COLONNES_SEANCE)
        .single(),
    );
    return versSeance(ligne as unknown as LigneSeance);
  }

  async enregistrerSeance(id: string, fiche: FicheSeance) {
    verifier(await this.db.rpc('enregistrer_seance', { p_seance_id: id, p_fiche: fiche }));
  }

  async supprimerSeance(id: string) {
    verifier(await this.db.from('seances').delete().eq('id', id));
  }

  // --- journal -----------------------------------------------------------------------------
  async notes() {
    return verifier(
      await this.db
        .from('journal')
        .select(COLONNES_NOTE)
        .order('epinglee', { ascending: false })
        .order('maj_le', { ascending: false }),
    ) as Note[];
  }

  async enregistrerNote(id: string | null, champs: NoteModifiable) {
    const requete = id ? this.db.from('notes').update(champs).eq('id', id) : this.db.from('notes').insert(champs);
    return verifier(await requete.select(COLONNES_NOTE).single()) as Note;
  }

  async supprimerNote(id: string) {
    verifier(await this.db.from('notes').delete().eq('id', id));
  }

  // --- exercices et documents ---------------------------------------------------------------
  async ressources() {
    return verifier(await this.db.from('documents').select(COLONNES_RESSOURCE).order('titre')) as Ressource[];
  }

  async enregistrerRessource(id: string | null, champs: RessourceModifiable) {
    const requete = id
      ? this.db.from('documents').update(champs).eq('id', id)
      : this.db.from('documents').insert(champs);
    return verifier(await requete.select(COLONNES_RESSOURCE).single()) as Ressource;
  }

  async supprimerRessource(id: string) {
    verifier(await this.db.from('documents').delete().eq('id', id));
  }

  async preparerRemise(ressourceId: string, clientId: string, mode: 'lien' | 'imprime') {
    return verifier(
      await this.db.rpc('preparer_remise', { p_document: ressourceId, p_client: clientId, p_mode: mode }),
    ) as RemisePreparee;
  }

  async listerRemises(clientId?: string) {
    let requete = this.db.from('remises_actives').select('*').order('cree_le', { ascending: false });
    if (clientId) requete = requete.eq('client_id', clientId);
    return verifier(await requete) as Remise[];
  }

  async supprimerRemise(id: string) {
    verifier(await this.db.from('remises').delete().eq('id', id));
  }

  async documentPublic(jeton: string) {
    return verifier(await this.db.rpc('document_public', { p_jeton: jeton })) as DocumentPublic;
  }

  async repondreDocument(jeton: string, reponses: string[]) {
    verifier(await this.db.rpc('repondre_document', { p_jeton: jeton, p_reponses: reponses }));
  }

  async relancerRemise(id: string) {
    return verifier(await this.db.rpc('relancer_remise', { p_id: id })) as { jeton: string; expire_le: string };
  }

  async marquerRemiseConsultee(id: string) {
    verifier(
      await this.db
        .from('remises')
        .update({ consulte_le: new Date().toISOString() })
        .eq('id', id)
        .is('consulte_le', null),
    );
  }

  // --- reçus ----------------------------------------------------------------------------------
  async listerRecus() {
    const lignes = verifier(
      await this.db
        .from('recus')
        .select(COLONNES_RECU)
        .order('annee', { ascending: false })
        .order('numero', { ascending: false }),
    ) as unknown as Parameters<typeof versRecu>[0][];
    return lignes.map(versRecu);
  }

  /** Reçu tel qu'il vient d'être émis, avec ses lignes. */
  private async lireRecu(id: string) {
    return versRecu(
      verifier(await this.db.from('recus').select(COLONNES_RECU).eq('id', id).single()) as unknown as Parameters<
        typeof versRecu
      >[0],
    );
  }

  async emettreRecu(seanceId: string, mode: ModeReglement, dateEmission: string) {
    const r = verifier(
      await this.db.rpc('emettre_recu', { p_seance: seanceId, p_mode: mode, p_date_emission: dateEmission }),
    ) as { id: string };
    return this.lireRecu(r.id);
  }

  async emettreRecuGroupe(seanceIds: string[], mode: ModeReglement, dateEmission: string) {
    const r = verifier(
      await this.db.rpc('emettre_recu_groupe', { p_seances: seanceIds, p_mode: mode, p_date_emission: dateEmission }),
    ) as { id: string };
    return this.lireRecu(r.id);
  }

  async annulerRecu(id: string, motif: string) {
    verifier(await this.db.rpc('annuler_recu', { p_id: id, p_motif: motif }));
  }

  async preparerLienRecu(id: string) {
    return verifier(await this.db.rpc('preparer_lien_recu', { p_id: id })) as { jeton: string; expire_le: string };
  }

  async recuPublic(jeton: string) {
    const r = verifier(await this.db.rpc('recu_public', { p_jeton: jeton })) as RecuPublic;
    return r.valide
      ? {
          ...r,
          recu: {
            ...r.recu,
            montant: Number(r.recu.montant),
            lignes: r.recu.lignes.map((l) => ({ ...l, montant: Number(l.montant) })),
          },
        }
      : r;
  }

  // --- tâches personnelles et « plus tard » ---------------------------------------------------
  async tachesPerso() {
    return verifier(await this.db.from('mes_taches').select(COLONNES_TACHE_PERSO).order('cree_le')) as TachePerso[];
  }

  async enregistrerTachePerso(id: string | null, champs: TachePersoModifiable) {
    const requete = id
      ? this.db.from('taches_perso').update(champs).eq('id', id)
      : this.db.from('taches_perso').insert(champs);
    return verifier(await requete.select(COLONNES_TACHE_PERSO).single()) as TachePerso;
  }

  async supprimerTachePerso(id: string) {
    verifier(await this.db.from('taches_perso').delete().eq('id', id));
  }

  async reportsTaches() {
    return verifier(await this.db.from('reports_taches').select('cle, jusqua')) as ReportTache[];
  }

  async reporterTache(cle: string, jusqua: string | null) {
    if (jusqua === null) verifier(await this.db.from('reports_taches').delete().eq('cle', cle));
    else verifier(await this.db.from('reports_taches').upsert({ cle, jusqua }, { onConflict: 'therapeute_id,cle' }));
  }

  // --- emploi du temps ------------------------------------------------------------------
  async listerRendezVous(de: string, a: string) {
    const lignes = verifier(
      await this.db.from('agenda').select(COLONNES_RDV).gte('debut', de).lt('debut', a).order('debut'),
    ) as RendezVous[];
    return lignes.map(versRendezVous);
  }

  async creerRendezVous(rdv: NouveauRendezVous) {
    return versRendezVous(
      verifier(await this.db.from('rendez_vous').insert(rdv).select(COLONNES_RDV).single()) as RendezVous,
    );
  }

  async modifierRendezVous(id: string, champs: ChampsRendezVous) {
    return versRendezVous(
      verifier(
        await this.db.from('rendez_vous').update(champs).eq('id', id).select(COLONNES_RDV).single(),
      ) as RendezVous,
    );
  }

  async supprimerRendezVous(id: string) {
    verifier(await this.db.from('rendez_vous').delete().eq('id', id));
  }

  async listerSeancesTarifs() {
    const lignes = verifier(
      await this.db
        .from('seances')
        .select('id, client_id, date_seance, prix, clients!inner ( supprime_le )')
        .is('clients.supprime_le', null),
    ) as unknown as (SeanceTarif & { clients: unknown })[];
    return sansJointure(lignes);
  }

  // --- relances et questionnaires -----------------------------------------------------
  async listerEnvois(clientId?: string) {
    if (clientId)
      return verifier(
        await this.db
          .from('envois')
          .select(COLONNES_ENVOI)
          .eq('client_id', clientId)
          .order('cree_le', { ascending: false }),
      ) as unknown as Envoi[];
    // tous les envois, hors clients de la corbeille
    const lignes = verifier(
      await this.db
        .from('envois')
        .select(`${COLONNES_ENVOI}, clients!inner ( supprime_le )`)
        .is('clients.supprime_le', null)
        .order('cree_le', { ascending: false }),
    ) as unknown as (Envoi & { clients: unknown })[];
    return sansJointure(lignes);
  }

  async preparerEnvoi(clientId: string, canal: CanalEnvoi, questionnaireId?: string) {
    return verifier(
      await this.db.rpc('preparer_envoi', {
        p_client_id: clientId,
        p_canal: canal,
        p_questionnaire_id: questionnaireId ?? null,
      }),
    ) as EnvoiPrepare;
  }

  async marquerLienSorti(id: string) {
    verifier(
      await this.db
        .from('envois')
        .update({ lien_sorti_le: new Date().toISOString() })
        .eq('id', id)
        .is('lien_sorti_le', null),
    );
  }

  async confirmerEnvoi(id: string, objet: string, corps: string) {
    verifier(await this.db.rpc('confirmer_envoi', { p_envoi_id: id, p_objet: objet, p_corps: corps }));
  }

  async annulerEnvoi(id: string) {
    verifier(await this.db.from('envois').delete().eq('id', id).is('envoye_le', null));
  }

  async marquerConsulte(id: string) {
    verifier(await this.db.from('envois').update({ consulte_le: new Date().toISOString() }).eq('id', id));
  }

  async questionnairePublic(jeton: string) {
    return verifier(await this.db.rpc('questionnaire_public', { p_jeton: jeton })) as QuestionnairePublic;
  }

  async repondreQuestionnaire(jeton: string, reponses: Record<string, ValeurReponse>) {
    verifier(await this.db.rpc('repondre_questionnaire', { p_jeton: jeton, p_reponses: reponses }));
  }

  // --- IA et statistiques -------------------------------------------------------------
  /** Fonction Edge `assistant-ia` : Gemini si possible, sinon repli local côté serveur. */
  private async assistant<T>(corps: { type: 'seance' | 'questionnaire'; id: string }): Promise<T> {
    const { data, error } = await this.db.functions.invoke<T | { erreur: string }>('assistant-ia', { body: corps });
    if (error) {
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new ErreurDonnees(detail?.erreur ?? "L'analyse a échoué.");
    }
    if (!data || (typeof data === 'object' && 'erreur' in (data as object)))
      throw new ErreurDonnees((data as { erreur?: string } | null)?.erreur ?? "L'analyse a échoué.");
    return data as T;
  }

  async analyserSeance(id: string) {
    return this.assistant<AnalyseIA>({ type: 'seance', id });
  }

  async lireQuestionnaireIA(envoiId: string) {
    return this.assistant<LectureQuestionnaire>({ type: 'questionnaire', id: envoiId });
  }

  async quotaIA() {
    return verifier(await this.db.rpc('quota_ia')) as QuotaIA;
  }

  async statistiques(perimetre: Perimetre, periode: PeriodeStatistiques = 'tout') {
    return verifier(
      await this.db.rpc('statistiques', { p_perimetre: perimetre, p_reference: dateDuJour(), p_periode: periode }),
    ) as Statistiques;
  }
}

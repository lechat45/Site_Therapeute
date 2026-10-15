// Fonction Edge Supabase (Deno) : assistant IA.
//
//  POST /functions/v1/assistant-ia
//    { "type": "seance",        "id": "<uuid de séance>" }  → AnalyseIA (catégorisation + synthèse)
//    { "type": "questionnaire", "id": "<uuid d'envoi>" }    → LectureQuestionnaire (onglet Tâches)
//
//  * Une seule clé Gemini pour toute la plateforme (secret GEMINI_API_KEY),
//    jamais transmise au navigateur. Chaque thérapeute a un quota quotidien
//    (paramètre ia_quota_jour, fonction SQL consommer_quota_ia).
//  * TOUJOURS une réponse : sans clé, quota atteint ou Gemini en panne,
//    l'analyse locale prend le relais (modele = « simulation-locale » ou
//    « lecture-locale »).
//  * La base est lue AU NOM du thérapeute (son jeton) : la RLS s'applique.
//  * Le nom et le prénom du client sont retirés du texte avant l'envoi.
//  * Aucun contenu clinique n'est écrit dans les journaux.
//
//  * Seules les adresses du site sont acceptées (CORS) : ORIGINE_AUTORISEE,
//    une ou plusieurs séparées par des virgules ; sans elle, développement
//    local seulement (voir _shared/cors.ts).
//
//  Secrets : supabase secrets set GEMINI_API_KEY=... ORIGINE_AUTORISEE=https://... [GEMINI_MODEL=...]

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  analyseSimulee,
  type ContexteAnalyse,
  construireRequeteGemini,
  GEMINI_MODELE_PAR_DEFAUT,
  lireReponseGemini,
  MODELE_SIMULATION,
  urlGemini,
} from '../_shared/analyse.ts';
import { entetesCors, originesAutorisees } from '../_shared/cors.ts';
import { trierCases } from '../_shared/fiche.ts';
import { construireRequeteLecture, type EnvoiLu, lectureLocale, lireReponseLecture } from '../_shared/questionnaire.ts';

// Adresses du site autorisées (CORS). Sans réglage : développement local seulement.
const AUTORISEES = originesAutorisees(Deno.env.get('ORIGINE_AUTORISEE'));
if (!Deno.env.get('ORIGINE_AUTORISEE'))
  console.warn('ORIGINE_AUTORISEE non défini : seules les adresses de développement local sont acceptées.');

interface Resultat {
  corps: unknown;
  statut: number;
}
const repondre = (corps: unknown, statut = 200): Resultat => ({ corps, statut });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODELE = Deno.env.get('GEMINI_MODEL') ?? GEMINI_MODELE_PAR_DEFAUT;

/** Appelle Gemini si une clé existe et que le quota du jour le permet ; sinon `null`. */
async function gemini(db: SupabaseClient, requete: unknown): Promise<unknown | null> {
  const cle = Deno.env.get('GEMINI_API_KEY');
  if (!cle) return null;
  const { data: autorise } = await db.rpc('consommer_quota_ia');
  if (!autorise) return null;
  try {
    const reponse = await fetch(urlGemini(MODELE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify(requete),
      signal: AbortSignal.timeout(45_000),
    });
    if (!reponse.ok) {
      console.error('Gemini a répondu', reponse.status); // statut seulement, jamais le contenu
      return null;
    }
    return await reponse.json();
  } catch (e) {
    console.error("Échec de l'appel Gemini", (e as Error).name);
    return null;
  }
}

// ---------------------------------------------------------------------
// Séance : catégorisation de la problématique et synthèse évolutive
// ---------------------------------------------------------------------
async function analyserSeance(db: SupabaseClient, id: string) {
  const { data: seance } = await db
    .from('seances')
    .select(
      `id, client_id, numero, type, date_seance, objectif, tim, notes,
             seance_cases ( zone, position, emotion_id ),
             clients ( nom, prenom, annee_naissance )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!seance) return repondre({ erreur: 'Séance introuvable.' }, 404);

  const [{ data: emotions }, { data: problematiques }, { data: precedente }, { data: posterieure }] = await Promise.all(
    [
      db.from('emotions').select('id, libelle').order('ordre'),
      db.from('problematiques').select('code, libelle').order('ordre'),
      db
        .from('seances')
        .select('analyse_ia')
        .eq('client_id', seance.client_id)
        .lt('numero', seance.numero)
        .not('analyse_ia', 'is', null)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('seances')
        .select('id')
        .eq('client_id', seance.client_id)
        .gt('numero', seance.numero)
        .not('analyse_ia', 'is', null)
        .limit(1)
        .maybeSingle(),
    ],
  );
  if (!emotions || !problematiques) return repondre({ erreur: 'Référentiels indisponibles.' }, 500);

  const client = seance.clients as unknown as { nom: string; prenom: string; annee_naissance: number };
  const libelle = (eid: number | null) => emotions.find((e) => e.id === eid)?.libelle ?? null;
  const ctx: ContexteAnalyse = {
    identite: { nom: client.nom, prenom: client.prenom },
    numero: seance.numero,
    type: seance.type,
    age: Number(String(seance.date_seance).slice(0, 4)) - client.annee_naissance,
    objectif: seance.objectif,
    tim: seance.tim,
    notes: seance.notes,
    cases: trierCases(seance.seance_cases as { zone: string; position: number; emotion_id: number }[]).map((c) => ({
      zone: c.zone,
      position: c.position,
      emotion: libelle(c.emotion_id) ?? '?',
    })),
    synthese_precedente: (precedente?.analyse_ia as { synthese?: string } | null)?.synthese ?? null,
    problematiques,
    emotions: emotions.map((e) => e.libelle),
  };
  if (!ctx.notes.trim() && !ctx.objectif.trim())
    return repondre({ erreur: "Rédigez des notes de séance avant de lancer l'analyse." }, 422);

  let resultat;
  const brut = await gemini(db, construireRequeteGemini(ctx));
  try {
    resultat = brut ? lireReponseGemini(brut, ctx, MODELE) : null;
  } catch {
    resultat = null; // réponse inexploitable : repli local
  }
  resultat ??= analyseSimulee(ctx);
  if (resultat.modele === MODELE_SIMULATION && Deno.env.get('GEMINI_API_KEY'))
    resultat.modele = `${MODELE_SIMULATION} (Gemini indisponible ou quota atteint)`;

  const horodatage = new Date().toISOString();
  const { error: e1 } = await db
    .from('seances')
    .update({ analyse_ia: resultat, analyse_ia_le: horodatage })
    .eq('id', seance.id);
  // La synthèse du client suit la séance analysée la plus avancée du parcours.
  const { error: e2 } = posterieure
    ? { error: null }
    : await db
        .from('clients')
        .update({ synthese_ia: resultat.synthese, synthese_ia_maj_le: horodatage })
        .eq('id', seance.client_id);
  if (e1 || e2) return repondre({ erreur: 'Analyse produite mais non enregistrée.' }, 500);
  return repondre(resultat);
}

// ---------------------------------------------------------------------
// Questionnaire reçu : lecture rapide pour l'onglet Tâches
// ---------------------------------------------------------------------
async function lireQuestionnaire(db: SupabaseClient, id: string) {
  const { data: envoi } = await db
    .from('envois')
    .select('id, client_id, questions, reponses, repondu_le, analyse_ia, clients ( nom, prenom )')
    .eq('id', id)
    .maybeSingle();
  if (!envoi) return repondre({ erreur: 'Questionnaire introuvable.' }, 404);
  if (!envoi.reponses) return repondre({ erreur: "Ce questionnaire n'a pas encore été rempli." }, 422);
  if (envoi.analyse_ia) return repondre(envoi.analyse_ia); // déjà lu : pas de nouvel appel

  const { data: precedent } = await db
    .from('envois')
    .select('questions, reponses')
    .eq('client_id', envoi.client_id)
    .lt('repondu_le', envoi.repondu_le)
    .not('reponses', 'is', null)
    .order('repondu_le', { ascending: false })
    .limit(1)
    .maybeSingle();
  const courant: EnvoiLu = { questions: envoi.questions, reponses: envoi.reponses };
  const avant: EnvoiLu | null = precedent ? { questions: precedent.questions, reponses: precedent.reponses } : null;
  const locale = lectureLocale(courant, avant);

  const { data: reglages } = await db.from('parametres').select('ia_taches').maybeSingle();
  if (!reglages?.ia_taches) return repondre(locale);
  const client = envoi.clients as unknown as { nom: string; prenom: string };
  const identite = { nom: client.nom, prenom: client.prenom };
  const brut = await gemini(db, construireRequeteLecture(courant, avant, locale, identite));
  if (!brut) return repondre(locale);
  const lecture = lireReponseLecture(brut, locale, MODELE, identite);
  if (lecture.modele !== locale.modele)
    await db.from('envois').update({ analyse_ia: lecture, analyse_ia_le: new Date().toISOString() }).eq('id', envoi.id);
  return repondre(lecture);
}

Deno.serve(async (req) => {
  const cors = entetesCors(req.headers.get('Origin'), AUTORISEES);
  if (!cors)
    return new Response(JSON.stringify({ erreur: 'Origine non autorisée.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', Vary: 'Origin' },
    });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { corps, statut } = await traiter(req);
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});

async function traiter(req: Request): Promise<Resultat> {
  if (req.method !== 'POST') return repondre({ erreur: 'Méthode non autorisée.' }, 405);

  const jeton = req.headers.get('Authorization');
  if (!jeton) return repondre({ erreur: 'Authentification requise.' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: jeton } },
    auth: { persistSession: false },
  });
  const { data: utilisateur } = await db.auth.getUser(jeton.replace(/^Bearer\s+/i, ''));
  if (!utilisateur.user) return repondre({ erreur: 'Session invalide.' }, 401);

  const { type, id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !UUID.test(id)) return repondre({ erreur: 'Identifiant invalide.' }, 400);
  if (type === 'seance') return analyserSeance(db, id);
  if (type === 'questionnaire') return lireQuestionnaire(db, id);
  return repondre({ erreur: 'Type de demande inconnu.' }, 400);
}

// Jeu de données FICTIF et déterministe pour le mode démo et les tests.
// Toute ressemblance avec des personnes réelles serait fortuite.
//
// Généré à partir d'une graine (mêmes données à chaque fois) et de la date du
// jour : genererJeuDemo() → clients, séances, envois (genererClient,
// genererEnvois), puis pour le compte de démonstration genererAgenda (3
// semaines autour d'aujourd'hui), genererHistoriqueAgenda (l'année écoulée),
// genererOutils (journal, documents remis, reçus, tâches personnelles).
// Changer la FORME du jeu ⇒ incrémenter VERSION_JEU_DEMO (régénération chez
// tout le monde). Les tests e2e s'appuient sur ce jeu (voir e2e/AGENTS.md).

import {
  EMOTIONS,
  NUMERO_BILAN,
  POSITION_MERE,
  POSITION_PERE,
  PROBLEMATIQUES,
  SEANCES_INITIALES,
  TRANCHES_AGE,
  ZONES_CROISEES,
} from '../config/referentiels';
import { analyseSimulee } from '../../supabase/functions/_shared/analyse.ts';
import { PARAMETRES_PAR_DEFAUT, QUESTIONNAIRE_BILAN, QUESTIONNAIRE_PAR_DEFAUT } from '../config/parametresDefaut';
import { MODELES_RESSOURCES } from '../config/ressources';
import { categorieSuggeree, decalerJour, horodatage, jourSemaine, lundiDe } from '../domaine/agenda';
import { contexteAnalyse } from '../domaine/contexteAnalyse';
import { dateDuJour, dateLongue } from '../domaine/format';
import { remplirModele } from '../domaine/messages';
import { questionsDocument } from '../domaine/texte';
import type {
  CanalEnvoi,
  CaseFiche,
  Client,
  ClientProblematique,
  Connexion,
  Envoi,
  Lignee,
  Parametres,
  Note,
  QuestionEnvoyee,
  Questionnaire,
  Recu,
  Remise,
  RendezVous,
  ReportTache,
  Reponse,
  Ressource,
  TachePerso,
  Seance,
  Therapeute,
  TypeSeance,
  ZoneFiche,
} from '../domaine/types';

export interface TherapeuteDemo extends Therapeute {
  mot_de_passe: string;
  /** Clé de double authentification (TOTP), si activée. */
  mfa_secret: string | null;
}
export interface EnvoiDemo extends Envoi {
  therapeute_id: string;
  jeton_hash: string;
}

export type QuestionnaireDemo = Questionnaire & { therapeute_id: string };
export type RendezVousDemo = RendezVous & { therapeute_id: string };
export type NoteDemo = Note & { therapeute_id: string };
export type RessourceDemo = Ressource & { therapeute_id: string };
export type RemiseDemo = Remise & { therapeute_id: string; contenu: string; jeton_hash: string | null };
export type RecuDemo = Recu & { therapeute_id: string; jeton_hash: string | null };
export type TachePersoDemo = TachePerso & { therapeute_id: string; precedente: string | null };

/** À incrémenter quand la forme du jeu change : il est alors régénéré chez tout le monde. */
export const VERSION_JEU_DEMO = 16;

export interface JeuDemo {
  version: typeof VERSION_JEU_DEMO;
  therapeutes: TherapeuteDemo[];
  parametres: Record<string, Parametres>;
  questionnaires: QuestionnaireDemo[];
  clients: Client[];
  client_problematiques: ClientProblematique[];
  seances: Seance[];
  envois: EnvoiDemo[];
  rendez_vous: RendezVousDemo[];
  notes: NoteDemo[];
  ressources: RessourceDemo[];
  remises: RemiseDemo[];
  recus: RecuDemo[];
  taches_perso: TachePersoDemo[];
  reports: (ReportTache & { therapeute_id: string })[];
  journal: (Connexion & { therapeute_id: string })[];
}

export const DATE_REFERENCE_DEMO = '2026-09-30';
export const ID_THERAPEUTE_DEMO = '00000000-0000-4000-8000-000000000001';
export { EMAIL_DEMO, MOT_DE_PASSE_DEMO } from './cleDemo';
import { EMAIL_DEMO, MOT_DE_PASSE_DEMO } from './cleDemo';

// ---------------------------------------------------------------------
// Aléa reproductible
// ---------------------------------------------------------------------
function mulberry32(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Alea = () => number;
const entier = (r: Alea, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const choix = <T>(r: Alea, liste: readonly T[]) => liste[Math.floor(r() * liste.length)];
function pondere<T>(r: Alea, poids: [T, number][]): T {
  const total = poids.reduce((a, [, p]) => a + p, 0);
  let x = r() * total;
  for (const [v, p] of poids) if ((x -= p) < 0) return v;
  return poids[poids.length - 1][0];
}
function uuid(r: Alea) {
  const h = () => Math.floor(r() * 16).toString(16);
  const bloc = (n: number) => Array.from({ length: n }, h).join('');
  return `${bloc(8)}-${bloc(4)}-4${bloc(3)}-${choix(r, ['8', '9', 'a', 'b'])}${bloc(3)}-${bloc(12)}`;
}
const ajouterJours = (iso: string, jours: number) =>
  new Date(Date.parse(iso) + jours * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------
// Vocabulaire
// ---------------------------------------------------------------------
const PRENOMS = [
  'Léa',
  'Hugo',
  'Chloé',
  'Lucas',
  'Manon',
  'Nathan',
  'Inès',
  'Jules',
  'Sarah',
  'Thomas',
  'Emma',
  'Arthur',
  'Zoé',
  'Paul',
  'Julie',
  'Antoine',
  'Clara',
  'Maxime',
  'Anaïs',
  'Nicolas',
  'Élodie',
  'Julien',
  'Pauline',
  'Mathieu',
  'Laura',
  'Romain',
  'Marion',
  'Vincent',
  'Céline',
  'Olivier',
  'Sophie',
  'Philippe',
  'Isabelle',
  'Bernard',
  'Monique',
  'Gérard',
  'Nathalie',
  'Sylvie',
];
const NOMS = [
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
  'Morel',
  'Girard',
  'André',
  'Mercier',
  'Dupont',
  'Lambert',
  'Bonnet',
  'François',
  'Legrand',
  'Garnier',
  'Faure',
  'Rousseau',
  'Blanc',
  'Guérin',
  'Muller',
  'Henry',
  'Roussel',
  'Perrin',
  'Morin',
  'Mathieu',
];

const e = (libelle: string) => EMOTIONS.find((x) => x.libelle === libelle)!.id;
const p = (code: string) => PROBLEMATIQUES.find((x) => x.code === code)!.id;

/** Problématiques probables selon la tranche d'âge (identifiant de tranche → [code, poids]). */
const PROBLEMATIQUES_PAR_TRANCHE: Record<number, [string, number][]> = {
  1: [
    ['scolarite', 3],
    ['phobies', 2],
    ['famille', 2],
    ['colere_impulsivite', 2],
    ['sommeil', 1],
  ],
  2: [
    ['scolarite', 3],
    ['estime_de_soi', 3],
    ['famille', 2],
    ['anxiete_stress', 2],
    ['alimentation', 1],
  ],
  3: [
    ['anxiete_stress', 3],
    ['estime_de_soi', 3],
    ['couple', 2],
    ['alimentation', 1],
    ['dependances', 1],
  ],
  4: [
    ['anxiete_stress', 3],
    ['couple', 3],
    ['epuisement_professionnel', 2],
    ['estime_de_soi', 2],
    ['parentalite', 1],
  ],
  5: [
    ['epuisement_professionnel', 3],
    ['parentalite', 2],
    ['couple', 2],
    ['anxiete_stress', 2],
    ['traumatisme', 1],
  ],
  6: [
    ['epuisement_professionnel', 3],
    ['deuil_separation', 2],
    ['couple', 2],
    ['sommeil', 1],
    ['famille', 1],
  ],
  7: [
    ['deuil_separation', 3],
    ['sommeil', 2],
    ['famille', 2],
    ['anxiete_stress', 1],
    ['traumatisme', 1],
  ],
  8: [
    ['deuil_separation', 4],
    ['sommeil', 2],
    ['famille', 2],
    ['anxiete_stress', 1],
  ],
};

const EMOTIONS_PAR_PROBLEMATIQUE: Record<string, [string, number][]> = {
  anxiete_stress: [
    ['Peur', 4],
    ['Impuissance', 2],
    ['Culpabilité', 1],
  ],
  estime_de_soi: [
    ['Dévalorisation', 4],
    ['Honte', 2],
    ['Rejet', 2],
  ],
  couple: [
    ['Trahison', 2],
    ['Abandon', 2],
    ['Colère', 2],
    ['Tristesse', 1],
  ],
  famille: [
    ['Colère', 2],
    ['Injustice', 2],
    ['Rejet', 2],
    ['Culpabilité', 1],
  ],
  deuil_separation: [
    ['Tristesse', 4],
    ['Abandon', 2],
    ['Solitude', 3],
    ['Culpabilité', 1],
  ],
  sommeil: [
    ['Peur', 2],
    ['Impuissance', 1],
    ['Tristesse', 1],
  ],
  phobies: [
    ['Peur', 5],
    ['Impuissance', 1],
  ],
  dependances: [
    ['Honte', 2],
    ['Culpabilité', 2],
    ['Impuissance', 2],
  ],
  alimentation: [
    ['Honte', 2],
    ['Dévalorisation', 2],
    ['Culpabilité', 1],
    ['Rejet', 1],
  ],
  epuisement_professionnel: [
    ['Impuissance', 3],
    ['Injustice', 2],
    ['Colère', 1],
    ['Dévalorisation', 1],
  ],
  colere_impulsivite: [
    ['Colère', 5],
    ['Injustice', 2],
    ['Humiliation', 1],
  ],
  traumatisme: [
    ['Peur', 3],
    ['Humiliation', 2],
    ['Impuissance', 2],
  ],
  parentalite: [
    ['Culpabilité', 3],
    ['Impuissance', 1],
    ['Peur', 1],
  ],
  scolarite: [
    ['Humiliation', 2],
    ['Rejet', 2],
    ['Peur', 1],
    ['Dévalorisation', 2],
  ],
};

const OBJECTIFS: Record<string, string[]> = {
  anxiete_stress: ['Retrouver du calme au quotidien', "Ne plus subir les crises d'angoisse"],
  estime_de_soi: ['Oser prendre la parole', 'Se sentir légitime dans ses choix'],
  couple: ['Apaiser les conflits dans le couple', 'Comprendre la répétition des ruptures'],
  famille: ['Poser des limites avec la famille', 'Apaiser la relation avec sa mère'],
  deuil_separation: ['Traverser le deuil', 'Accepter la séparation'],
  sommeil: ['Retrouver un sommeil réparateur'],
  phobies: ["Reprendre l'avion", 'Conduire sur autoroute sans panique'],
  dependances: ['Arrêter le tabac', "Réduire la consommation d'alcool"],
  alimentation: ['Sortir des crises de grignotage', 'Apaiser la relation à la nourriture'],
  epuisement_professionnel: ['Préparer la reprise du travail', "Sortir de l'épuisement"],
  colere_impulsivite: ['Canaliser les accès de colère'],
  traumatisme: ["Se libérer du choc de l'accident"],
  parentalite: ['Se sentir apaisé(e) dans son rôle de parent', 'Retrouver de la patience avec ses enfants'],
  scolarite: ["Retrouver le goût de l'école", 'Dépasser la peur des évaluations'],
};

const CONSTATS: Record<string, string[]> = {
  anxiete_stress: [
    'décrit une tension permanente et une grande difficulté à se détendre le soir',
    "évoque des crises d'angoisse en voiture, surtout sur autoroute",
  ],
  estime_de_soi: [
    'dit ne jamais se sentir à la hauteur au travail comme en famille',
    "se dévalorise dès qu'un compliment lui est adressé",
  ],
  couple: [
    'rapporte des disputes répétées avec son conjoint, souvent autour de la jalousie',
    "revient sur la rupture récente et le sentiment d'avoir été trompé(e)",
  ],
  famille: [
    'évoque un conflit ancien avec sa sœur au sujet des parents',
    'se sent toujours comparé(e) à son frère aîné',
  ],
  deuil_separation: [
    'parle du décès de son père il y a huit mois, sans avoir pu lui dire au revoir',
    'vit mal la séparation et le départ des enfants une semaine sur deux',
  ],
  sommeil: ['se réveille chaque nuit vers trois heures sans parvenir à se rendormir'],
  phobies: ["évite l'avion depuis dix ans ; la seule évocation du voyage déclenche une panique"],
  dependances: ['fume un paquet par jour et associe la cigarette aux moments de stress'],
  alimentation: ['décrit des crises de grignotage le soir, suivies de culpabilité'],
  epuisement_professionnel: [
    'est en arrêt depuis deux mois après un épuisement professionnel',
    'se sent vidé(e) par une hiérarchie jamais satisfaite',
  ],
  colere_impulsivite: ['raconte des accès de colère soudains, surtout à la maison'],
  traumatisme: ["revient sur l'accident de voiture de l'an dernier et les images qui reviennent"],
  parentalite: ['culpabilise de manquer de patience avec son enfant'],
  scolarite: ["a peur des contrôles au collège et a été mis(e) à l'écart par un groupe"],
};

const EVENEMENTS_TRANSGEN = [
  'Deuil non fait',
  'Séparation précoce',
  'Exil',
  'Secret de famille',
  'Naissance difficile',
  'Enfant non désiré',
  'Faillite',
  'Guerre',
  'Placement',
  'Maladie longue',
  'Enfant perdu',
];

// ---------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------
const AUTRES_THERAPEUTES: [string, string][] = [
  ['Aubert', 'Hélène'],
  ['Chevalier', 'Marc'],
  ['Colin', 'Nadia'],
  ['Lemoine', 'Yann'],
  ['Marchand', 'Sabine'],
  ['Renaud', 'Karim'],
  ['Vidal', 'Agnès'],
];

/** Un espace neuf : paramètres et questionnaire par défaut. */
export function initialiserEspace(jeu: JeuDemo, therapeuteId: string, nouvelId: () => string) {
  jeu.parametres[therapeuteId] = { ...PARAMETRES_PAR_DEFAUT };
  ajouterQuestionnaire(jeu, therapeuteId, QUESTIONNAIRE_PAR_DEFAUT, nouvelId);
}

function ajouterQuestionnaire(
  jeu: JeuDemo,
  therapeuteId: string,
  modele: typeof QUESTIONNAIRE_PAR_DEFAUT,
  nouvelId: () => string,
) {
  jeu.questionnaires.push({
    ...modele,
    id: nouvelId(),
    therapeute_id: therapeuteId,
    questions: modele.questions.map((q) => ({ ...q, options: [...q.options], id: nouvelId() })),
  });
}

/**
 * `aujourdhui` ne sert qu'à l'emploi du temps (rendez-vous autour de la date
 * du jour, avec leur propre aléa) : le reste du jeu ne dépend que de `graine`.
 */
export function genererJeuDemo(graine = 20260930, aujourdhui = dateDuJour()): JeuDemo {
  const r = mulberry32(graine);
  const jeu: JeuDemo = {
    version: VERSION_JEU_DEMO,
    therapeutes: [],
    parametres: {},
    questionnaires: [],
    clients: [],
    client_problematiques: [],
    seances: [],
    envois: [],
    rendez_vous: [],
    notes: [],
    ressources: [],
    remises: [],
    recus: [],
    taches_perso: [],
    reports: [],
    journal: [],
  };

  jeu.therapeutes.push({
    id: ID_THERAPEUTE_DEMO,
    email: EMAIL_DEMO,
    mot_de_passe: MOT_DE_PASSE_DEMO,
    mfa_secret: null,
    nom: 'Laurent',
    prenom: 'Camille',
  });
  AUTRES_THERAPEUTES.forEach(([nom, prenom], i) =>
    jeu.therapeutes.push({
      id: `00000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}`,
      email: `confrere${i + 2}@exemple.fr`,
      mot_de_passe: MOT_DE_PASSE_DEMO,
      mfa_secret: null,
      nom,
      prenom,
    }),
  );
  for (const t of jeu.therapeutes) {
    initialiserEspace(jeu, t.id, () => uuid(r));
    jeu.parametres[t.id].prix_defaut = choix(r, [50, 55, 60, 65, 70]);
  }
  Object.assign(jeu.parametres[ID_THERAPEUTE_DEMO], {
    prix_defaut: 60,
    specialite: 'Thérapeute comportementaliste émotionnelle',
    // plage 01 99 00 réservée aux œuvres de fiction
    telephone_pro: '01 99 00 12 34',
    signature: 'Camille Laurent\nThérapeute comportementaliste émotionnelle',
  });
  ajouterQuestionnaire(jeu, ID_THERAPEUTE_DEMO, QUESTIONNAIRE_BILAN, () => uuid(r));
  jeu.journal = [
    ['2026-09-29T08:12:00.000Z', 'Chrome · Windows'],
    ['2026-09-26T13:40:00.000Z', 'Safari · iPad'],
    ['2026-09-24T08:05:00.000Z', 'Chrome · Windows'],
    ['2026-09-19T17:22:00.000Z', 'Safari · iPad'],
  ].map(([le, appareil]) => ({ le, appareil, therapeute_id: ID_THERAPEUTE_DEMO }));

  for (const t of jeu.therapeutes) {
    const estDemo = t.id === ID_THERAPEUTE_DEMO;
    const nbClients = estDemo ? 26 : entier(r, 12, 20);
    for (let i = 0; i < nbClients; i++) genererClient(r, jeu, t.id, estDemo);
  }
  genererAgenda(mulberry32(graine + 1), jeu, ID_THERAPEUTE_DEMO, aujourdhui);
  genererHistoriqueAgenda(mulberry32(graine + 3), jeu, ID_THERAPEUTE_DEMO, aujourdhui);
  genererOutils(mulberry32(graine + 2), jeu, ID_THERAPEUTE_DEMO, aujourdhui);
  return jeu;
}

/** Journal, bibliothèque d'exercices, reçus et tâches personnelles du compte de démonstration. */
function genererOutils(r: Alea, jeu: JeuDemo, therapeuteId: string, aujourdhui: string) {
  const clients = jeu.clients.filter((c) => c.therapeute_id === therapeuteId);
  const il_y_a = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();
  const p = jeu.parametres[therapeuteId];
  p.adresse_pro = '12 rue des Lilas\n75000 Paris'; // adresse fictive
  p.siret = '000 000 000 00000';

  const note = (titre: string, contenu: string, jours: number, client_id: string | null = null, epinglee = false) =>
    jeu.notes.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      client_id,
      titre,
      contenu,
      epinglee,
      cree_le: il_y_a(jours),
      maj_le: il_y_a(jours),
    });
  note(
    'Supervision de jeudi',
    'Revoir la gestion des silences en séance. Lire le chapitre conseillé avant le prochain point.',
    2,
    null,
    true,
  );
  note(
    'Idée d’atelier',
    'Atelier collectif « émotions et sommeil » au printemps : vérifier la salle et le nombre de places.',
    9,
  );
  note('', 'A évoqué un déménagement prévu en décembre : prévoir des séances en visio.', 4, clients[0]?.id ?? null);
  note(
    'Entre deux séances',
    'Message reçu : souhaite avancer le prochain rendez-vous d’une semaine.',
    1,
    clients[1]?.id ?? null,
  );

  for (const [i, modele] of MODELES_RESSOURCES.entries())
    jeu.ressources.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      ...modele,
      cree_le: il_y_a(60 - i),
      maj_le: il_y_a(60 - i),
    });
  for (const [i, c] of clients.slice(0, 5).entries()) {
    const doc = jeu.ressources[i % jeu.ressources.length];
    const lien = i % 2 === 0;
    jeu.remises.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      client_id: c.id,
      document_id: doc.id,
      mode: lien ? 'lien' : 'imprime',
      titre: doc.titre,
      contenu: doc.contenu,
      jeton_hash: lien ? hex64(r) : null,
      cree_le: il_y_a(20 - i * 3),
      expire_le: lien ? new Date(Date.now() + 70 * 86_400_000).toISOString() : null,
      ouvert_le: lien && i < 3 ? il_y_a(18 - i * 3) : null,
      reponses: null,
      repondu_le: null,
      consulte_le: null,
      nb_questions: questionsDocument(doc.contenu).length,
      rappel_le: null,
    });
  }
  // un exercice à compléter, rendu hier par le client (réponses fictives) : tâche « Exercice complété »
  const journal = jeu.ressources.find((d) => questionsDocument(d.contenu).length > 0);
  const auteur = clients[5];
  if (journal && auteur) {
    const exemples = [
      'De l’agacement, presque de la colère.',
      'Une remarque d’un collègue en réunion, devant tout le monde.',
      'Dans la mâchoire et les épaules.',
      'Je n’ai rien dit, puis j’y ai repensé toute la soirée. J’aurais aimé lui répondre calmement.',
    ];
    jeu.remises.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      client_id: auteur.id,
      document_id: journal.id,
      mode: 'lien',
      titre: journal.titre,
      contenu: journal.contenu,
      jeton_hash: hex64(r),
      cree_le: il_y_a(6),
      expire_le: new Date(Date.now() + 84 * 86_400_000).toISOString(),
      ouvert_le: il_y_a(5),
      reponses: questionsDocument(journal.contenu).map((question, i) => ({
        question,
        reponse: exemples[i] ?? '',
      })),
      repondu_le: il_y_a(1),
      consulte_le: null,
      nb_questions: questionsDocument(journal.contenu).length,
      rappel_le: null,
    });
  }
  // un exercice à compléter remis il y a 10 jours, toujours sans réponse : tâche « Rappeler l'exercice »
  const oublieux = clients[6];
  if (journal && oublieux)
    jeu.remises.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      client_id: oublieux.id,
      document_id: journal.id,
      mode: 'lien',
      titre: journal.titre,
      contenu: journal.contenu,
      jeton_hash: hex64(r),
      cree_le: il_y_a(10),
      expire_le: new Date(Date.now() + 80 * 86_400_000).toISOString(),
      ouvert_le: il_y_a(9),
      reponses: null,
      repondu_le: null,
      consulte_le: null,
      nb_questions: questionsDocument(journal.contenu).length,
      rappel_le: null,
    });

  // reçus des séances tarifées des 4 derniers mois (numérotation continue par année)
  const limite = decalerJour(aujourdhui, -120);
  const aFacturer = jeu.seances
    .filter(
      (s) =>
        s.therapeute_id === therapeuteId && s.prix !== null && s.date_seance >= limite && s.date_seance <= aujourdhui,
    )
    .sort((a, b) => a.date_seance.localeCompare(b.date_seance))
    .slice(0, -3); // quelques séances récentes restent « à facturer »
  const t = jeu.therapeutes.find((x) => x.id === therapeuteId)!;
  for (const s of aFacturer) {
    const c = clients.find((x) => x.id === s.client_id)!;
    const annee = Number(s.date_seance.slice(0, 4));
    jeu.recus.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      annee,
      numero: jeu.recus.filter((x) => x.annee === annee).length + 1,
      client_id: c.id,
      seance_id: s.id,
      client_nom: `${c.prenom} ${c.nom}`,
      date_seance: s.date_seance,
      date_emission: s.date_seance,
      prestation: `Séance d'accompagnement comportemental et émotionnel n° ${s.numero}${s.type === 'bilan' ? ' (bilan)' : ''}`,
      montant: Number(s.prix),
      mode_reglement: choix(r, ['cheque', 'virement', 'especes', 'carte'] as const),
      emetteur: {
        nom: `${t.prenom} ${t.nom}`,
        specialite: p.specialite,
        adresse: p.adresse_pro,
        telephone: p.telephone_pro,
        siret: p.siret,
        mention: p.mention_recu,
      },
      annule_le: null,
      motif_annulation: '',
      cree_le: `${s.date_seance}T18:00:00.000Z`,
      jeton_hash: null,
      lien_expire_le: null,
      lien_ouvert_le: null,
      lignes: [
        {
          seance_id: s.id,
          date_seance: s.date_seance,
          prestation: `Séance d'accompagnement comportemental et émotionnel n° ${s.numero}${s.type === 'bilan' ? ' (bilan)' : ''}`,
          montant: Number(s.prix),
        },
      ],
    });
  }
  // un reçu annulé (il reste visible, barré ; sa séance redevient « sans reçu »)
  const annule = jeu.recus.find((x) => x.therapeute_id === therapeuteId && x.numero === 2);
  if (annule) {
    annule.annule_le = `${annule.date_emission}T19:00:00.000Z`;
    annule.motif_annulation = 'Erreur sur le mode de règlement';
  }

  const tache = (
    titre: string,
    echeance: string | null,
    client_id: string | null = null,
    recurrence: TachePersoDemo['recurrence'] = 'aucune',
  ) =>
    jeu.taches_perso.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      client_id,
      titre,
      echeance,
      faite_le: null,
      cree_le: il_y_a(3),
      recurrence,
      precedente: null,
    });
  tache('Renouveler l’assurance responsabilité civile professionnelle', decalerJour(aujourdhui, -1));
  tache('Préparer le support de l’atelier « émotions et sommeil »', decalerJour(aujourdhui, 4));
  tache('Rappeler pour confirmer le changement d’horaire', aujourdhui, clients[1]?.id ?? null);
  tache('Commander des carnets pour le journal des émotions', null);
  tache('Saisir les recettes du mois (comptabilité)', decalerJour(aujourdhui, 3), null, 'mois');
}

/**
 * Trois semaines d'emploi du temps autour d'aujourd'hui pour le compte de
 * démonstration : séances (passées : honorées, quelques absences ou
 * annulations, deux encore à compléter), bilans, premiers rendez-vous,
 * créneaux administratifs et personnels.
 */
function genererAgenda(r: Alea, jeu: JeuDemo, therapeuteId: string, aujourdhui: string) {
  const clients = jeu.clients.filter((c) => c.therapeute_id === therapeuteId);
  const nbSeances = (id: string) => jeu.seances.filter((s) => s.client_id === id).length;
  const maintenant = Date.now();
  const ajouter = (
    rdv: Omit<RendezVousDemo, 'id' | 'therapeute_id' | 'cree_le' | 'seance_id' | 'rappel_envoye_le'> &
      Partial<RendezVousDemo>,
  ) =>
    jeu.rendez_vous.push({
      id: uuid(r),
      therapeute_id: therapeuteId,
      seance_id: null,
      rappel_envoye_le: null,
      cree_le: new Date(maintenant - 20 * 86_400_000).toISOString(),
      ...rdv,
    });
  const lundi = decalerJour(lundiDe(aujourdhui), -7);
  let aCompleter = 2; // rendez-vous passés laissés « prévus » : tâches « à compléter »

  for (let j = 0; j < 21; j++) {
    const jour = decalerJour(lundi, j);
    const js = jourSemaine(jour);
    if (js > 5) continue;
    for (const h of [9, 10, 11, 14, 15, 16, 17]) {
      if (r() > 0.6) continue;
      const c = choix(r, clients);
      const categorie = r() < 0.08 ? 'premier' : categorieSuggeree(nbSeances(c.id)) === 'bilan' ? 'bilan' : 'seance';
      const debut = horodatage(jour, `${String(h).padStart(2, '0')}:${r() < 0.25 ? '30' : '00'}`);
      const duree = categorie === 'bilan' ? 90 : 60;
      const fin = new Date(Date.parse(debut) + duree * 60_000).toISOString();
      const passe = Date.parse(fin) < maintenant;
      let statut: RendezVousDemo['statut'] = 'prevu';
      if (passe) {
        const x = r();
        statut = x < 0.08 ? 'absent' : x < 0.16 ? 'annule' : 'honore';
        if (statut === 'honore' && jour >= decalerJour(aujourdhui, -3) && aCompleter > 0) {
          statut = 'prevu';
          aCompleter--;
        }
      } else if (r() < 0.06) statut = 'annule';
      const proche = !passe && Date.parse(debut) - maintenant < 48 * 3_600_000;
      ajouter({
        client_id: categorie === 'premier' && r() < 0.5 ? null : c.id,
        titre: categorie === 'premier' ? 'Premier contact (appel du cabinet)' : '',
        categorie,
        statut,
        modalite: pondere(r, [
          ['cabinet', 7],
          ['visio', 2],
          ['telephone', 1],
        ] as [RendezVousDemo['modalite'], number][]),
        debut,
        fin,
        note: '',
        // un rappel déjà envoyé sur certains rendez-vous proches
        rappel_envoye_le: proche && r() < 0.4 ? new Date(maintenant - 3_600_000).toISOString() : null,
      });
    }
    // créneaux sans client
    if (js === 3)
      ajouter({
        client_id: null,
        titre: 'Supervision',
        categorie: 'administratif',
        statut: 'prevu',
        modalite: 'visio',
        debut: horodatage(jour, '13:00'),
        fin: horodatage(jour, '14:00'),
        note: '',
      });
    if (js === 5)
      ajouter({
        client_id: null,
        titre: 'Comptabilité et dossiers',
        categorie: 'administratif',
        statut: 'prevu',
        modalite: 'cabinet',
        debut: horodatage(jour, '18:00'),
        fin: horodatage(jour, '19:00'),
        note: '',
      });
    if (js === 4)
      ajouter({
        client_id: null,
        titre: 'Pause déjeuner prolongée',
        categorie: 'personnel',
        statut: 'prevu',
        modalite: 'cabinet',
        debut: horodatage(jour, '12:00'),
        fin: horodatage(jour, '13:30'),
        note: '',
      });
  }
}

/**
 * Historique de l'emploi du temps (de la 2e à la 51e semaine passée), pour
 * l'onglet Activité : séances tenues, quelques absences et annulations,
 * créneaux préférés en fin d'après-midi. Générateur séparé : le reste du
 * jeu de démonstration ne change pas.
 */
function genererHistoriqueAgenda(r: Alea, jeu: JeuDemo, therapeuteId: string, aujourdhui: string) {
  const clients = jeu.clients.filter((c) => c.therapeute_id === therapeuteId);
  const debutAgenda = decalerJour(lundiDe(aujourdhui), -7);
  const premier = decalerJour(debutAgenda, -7 * 50);
  for (let j = 0; j < 7 * 50; j++) {
    const jour = decalerJour(premier, j);
    const js = jourSemaine(jour);
    if (js > 5) continue;
    // vacances d'été : trois semaines presque vides
    const ete = jour.slice(5, 7) === '08' && Number(jour.slice(8, 10)) <= 21;
    for (const [h, proba] of [
      [9, 0.3],
      [10, 0.4],
      [11, 0.35],
      [14, 0.35],
      [15, 0.4],
      [16, 0.5],
      [17, 0.65],
      [18, 0.55],
    ] as const) {
      if (r() > (ete ? proba / 6 : proba)) continue;
      const c = choix(r, clients);
      const bilan = r() < 0.1;
      const debut = horodatage(jour, `${String(h).padStart(2, '0')}:00`);
      const x = r();
      jeu.rendez_vous.push({
        id: uuid(r),
        therapeute_id: therapeuteId,
        client_id: c.id,
        titre: '',
        categorie: r() < 0.05 ? 'premier' : bilan ? 'bilan' : 'seance',
        statut: x < 0.06 ? 'absent' : x < 0.13 ? 'annule' : 'honore',
        modalite: pondere(r, [
          ['cabinet', 7],
          ['visio', 2],
          ['telephone', 1],
        ] as [RendezVousDemo['modalite'], number][]),
        debut,
        fin: new Date(Date.parse(debut) + (bilan ? 90 : 60) * 60_000).toISOString(),
        note: '',
        seance_id: null,
        rappel_envoye_le: null,
        cree_le: new Date(Date.parse(debut) - 10 * 86_400_000).toISOString(),
      });
    }
  }
}

const minuscules = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function genererClient(r: Alea, jeu: JeuDemo, therapeuteId: string, detaille: boolean) {
  const tranche = pondere(
    r,
    TRANCHES_AGE.map((t, i) => [t, [6, 10, 14, 20, 20, 15, 10, 5][i]]),
  );
  const age = entier(r, Math.max(tranche.age_min, 6), tranche.age_max ?? 82);
  const nom = choix(r, NOMS);
  const prenom = choix(r, PRENOMS);
  const client: Client = {
    id: uuid(r),
    therapeute_id: therapeuteId,
    nom,
    prenom,
    annee_naissance: Number(DATE_REFERENCE_DEMO.slice(0, 4)) - age,
    synthese_ia: null,
    synthese_ia_maj_le: null,
    cree_le: '',
    // adresses et numéros fictifs (plage 06 39 98 réservée aux œuvres de fiction)
    email: r() < 0.85 ? `${minuscules(prenom)}.${minuscules(nom)}@exemple.fr` : null,
    telephone: r() < 0.7 ? `06 39 98 ${String(entier(r, 10, 99))} ${String(entier(r, 10, 99))}` : null,
    prix_seance: r() < 0.2 ? choix(r, [50, 70, 80]) : null,
    relances_actives: r() > 0.05,
    relance_reportee_au: null,
    accord_relance_le: null,
    consentement_le: null,
    supprime_le: null,
  };
  const reglages = jeu.parametres[therapeuteId];
  const prix = reglages.tarifs_actifs ? (client.prix_seance ?? reglages.prix_defaut) : null;

  const principale = pondere(r, PROBLEMATIQUES_PAR_TRANCHE[tranche.id]);
  const codes = [principale];
  if (r() < 0.35) {
    const seconde = pondere(r, PROBLEMATIQUES_PAR_TRANCHE[tranche.id]);
    if (seconde !== principale) codes.push(seconde);
  }

  const nbSeances = pondere(r, [
    [1, 8],
    [2, 8],
    [3, 10],
    [4, 34],
    [5, 16],
    [6, 12],
    [7, 7],
    [8, 5],
  ]);
  let date = ajouterJours('2025-09-01', entier(r, 0, 370));
  client.cree_le = `${date}T09:00:00.000Z`;
  // accord de relance noté à la première séance pour environ 5 clients sur 6
  // (dérivé de l'identifiant : la suite aléatoire du jeu reste inchangée)
  if ((client.email || client.telephone) && parseInt(client.id.slice(-2), 16) % 6 !== 0)
    client.accord_relance_le = date;
  // consentement au traitement des données noté à la première séance, sauf pour environ un
  // client sur cinq (pour montrer l'alerte de la fiche) ; dérivé de l'identifiant, comme ci-dessus
  if (parseInt(client.id.slice(-3), 16) % 5 !== 0) client.consentement_le = date;
  const lignee: Lignee = r() < 0.5 ? 'pere' : 'mere';
  const objectif = choix(r, OBJECTIFS[principale]);
  const poidsEmotions = new Map<number, number>(EMOTIONS.map((x) => [x.id, 0.3]));
  for (const code of codes)
    for (const [libelle, poids] of EMOTIONS_PAR_PROBLEMATIQUE[code])
      poidsEmotions.set(e(libelle), poidsEmotions.get(e(libelle))! + poids);

  const seances: Seance[] = [];
  for (let numero = 1; numero <= nbSeances && date <= DATE_REFERENCE_DEMO; numero++) {
    const type: TypeSeance =
      numero <= SEANCES_INITIALES ? 'initiale' : numero === NUMERO_BILAN ? 'bilan' : 'supplementaire';
    // La joie gagne du terrain au fil du parcours.
    const poids: [number, number][] = [...poidsEmotions].map(([id, w]) => [
      id,
      id === e('Joie') ? w + Math.max(0, numero - 2) * 0.9 : w,
    ]);
    // Remplissage des cases de la feuille
    const tirer = () => pondere(r, poids);
    const cases: CaseFiche[] = [];
    const poser = (zone: ZoneFiche, position: number, emotion_id: number) => cases.push({ zone, position, emotion_id });

    // Émotion temps présent (1) : en-tête en deux moitiés, empilement, case du bas
    const pile = [tirer()];
    poser('present1_haut', 1, pile[0]);
    if (r() < 0.7) poser('present1_haut', 2, tirer());
    const hauteur = pondere(r, [
      [0, 10],
      [1, 20],
      [2, 30],
      [3, 25],
      [4, 10],
      [5, 5],
    ]);
    for (let k = 1; k <= hauteur; k++) {
      let id = tirer();
      if (id === pile[pile.length - 1]) id = tirer();
      poser('present1_pile', k, id);
      pile.push(id);
    }
    if (hauteur > 0 && r() < 0.75) poser('present1_bas', 1, tirer());
    // Émotion temps présent (2), plus rarement
    if (r() < 0.35) {
      poser('present2_haut', 1, tirer());
      if (r() < 0.5) poser('present2_haut', 2, tirer());
      if (r() < 0.6) poser('present2_bas', 1, tirer());
    }
    // Suivi croisé Père / Mère et grilles de 4 cases
    let evenement = '';
    if (detaille && (numero === 2 || numero === 3 || r() < 0.25)) {
      for (const z of ZONES_CROISEES) {
        if (r() < 0.35) poser(z, POSITION_PERE, tirer());
        if (r() < 0.35) poser(z, POSITION_MERE, tirer());
      }
      for (const z of ['grille_generation_3', 'grille_generation_2'] as const)
        for (let k = 1; k <= 4; k++) if (r() < 0.25) poser(z, k, tirer());
      evenement = ` Travail transgénérationnel : « ${choix(r, EVENEMENTS_TRANSGEN).toLowerCase()} » du côté ${
        r() < 0.5 ? 'paternel' : 'maternel'
      }.`;
    }

    seances.push({
      id: uuid(r),
      client_id: client.id,
      therapeute_id: therapeuteId,
      numero,
      type,
      date_seance: date,
      lignee,
      objectif,
      tim: '',
      notes: detaille ? rediger(r, client.prenom, codes, pile, type, numero) + evenement : '',
      cases,
      prix,
      analyse_ia: null,
      analyse_ia_le: null,
    });
    date = ajouterJours(date, entier(r, 8, 28));
  }

  jeu.clients.push(client);
  jeu.seances.push(...seances);
  for (const code of codes)
    jeu.client_problematiques.push({
      client_id: client.id,
      therapeute_id: therapeuteId,
      problematique_id: p(code),
      source: detaille && r() < 0.4 ? 'ia' : 'therapeute',
      ajoute_le: client.cree_le,
    });

  // Synthèse évolutive déjà produite pour les séances passées (la dernière
  // séance reste parfois « à analyser », pour montrer l'écran).
  if (detaille) {
    const aAnalyser = seances.length > 1 && r() < 0.5 ? seances.slice(0, -1) : seances;
    let synthese: string | null = null;
    for (const s of aAnalyser) {
      const resultat = analyseSimulee(contexteAnalyse(client, s, synthese));
      s.analyse_ia = resultat;
      s.analyse_ia_le = `${s.date_seance}T18:00:00.000Z`;
      synthese = resultat.synthese;
    }
    const derniere = aAnalyser[aAnalyser.length - 1];
    client.synthese_ia = synthese;
    client.synthese_ia_maj_le = derniere?.analyse_ia_le ?? null;
    if (seances.length) genererEnvois(r, jeu, client, seances);
  }
}

// ---------------------------------------------------------------------
// Relances déjà envoyées et questionnaires remplis (thérapeute de démo)
// ---------------------------------------------------------------------
const COMMENTAIRES = [
  'Ça va mieux, merci.',
  'Je dors un peu mieux depuis la dernière séance.',
  "J'aimerais reprendre rendez-vous.",
  'Semaine difficile au travail, mais je tiens bon.',
  'Merci pour votre message.',
];

const hex64 = (r: Alea) => (uuid(r) + uuid(r)).replace(/-/g, '');
const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(x)));

function genererEnvois(r: Alea, jeu: JeuDemo, client: Client, seances: Seance[]) {
  const p = jeu.parametres[client.therapeute_id];
  const t = jeu.therapeutes.find((x) => x.id === client.therapeute_id)!;
  const canaux = [client.email ? 'email' : null, client.telephone ? 'sms' : null].filter(Boolean) as CanalEnvoi[];
  if (!canaux.length) return;
  const modele = jeu.questionnaires.find((q) => q.therapeute_id === client.therapeute_id && q.par_defaut)!;
  const questions: QuestionEnvoyee[] = modele.questions
    .filter((q) => q.active)
    .map(({ ordre: _o, active: _a, ...q }) => ({ ...q, options: [...q.options] }));
  // émotions réellement travaillées en séance : le client les cite plus volontiers
  const emotionsDuClient = [
    ...new Set(seances.flatMap((s) => s.cases.map((c) => EMOTIONS.find((e) => e.id === c.emotion_id)!.libelle))),
  ];
  // les réponses des quatre derniers jours n'ont pas encore été lues
  const limiteConsultation = ajouterJours(DATE_REFERENCE_DEMO, -4);

  const envoyer = (jour: string, progres: number) => {
    const canal = choix(r, canaux);
    const vars = {
      prenom: client.prenom,
      nom: client.nom,
      therapeute: `${t.prenom} ${t.nom}`,
      signature: p.signature,
      lien: '[lien du questionnaire]',
      expiration: dateLongue(ajouterJours(jour, p.lien_validite_jours)),
      site: p.nom_site,
    };
    const envoi: EnvoiDemo = {
      id: uuid(r),
      therapeute_id: client.therapeute_id,
      client_id: client.id,
      questionnaire_id: modele.id,
      canal,
      destinataire: canal === 'email' ? client.email! : client.telephone!,
      jeton_hash: hex64(r),
      objet: canal === 'email' ? remplirModele(p.modele_email_objet, vars) : '',
      corps: remplirModele(canal === 'email' ? p.modele_email : p.modele_sms, vars),
      questionnaire: { titre: modele.titre, introduction: modele.introduction, remerciement: modele.remerciement },
      questions,
      cree_le: `${jour}T09:30:00.000Z`,
      expire_le: `${ajouterJours(jour, p.lien_validite_jours)}T09:30:00.000Z`,
      envoye_le: `${jour}T09:31:00.000Z`,
      lien_sorti_le: `${jour}T09:30:30.000Z`,
      reponses: null,
      repondu_le: null,
      consulte_le: null,
      analyse_ia: null,
    };
    const jourReponse = ajouterJours(jour, entier(r, 0, 6));
    if (r() < 0.65 && jourReponse <= DATE_REFERENCE_DEMO) {
      // de 0 (mal) à 1 (bien) : progresse avec le nombre de séances
      const niveau = Math.min(1, (3 + Math.min(progres, 6) * 0.8) / 10);
      const valeur = (q: QuestionEnvoyee): Reponse['valeur'] => {
        const bruit = (r() * 2 - 1) * 0.1;
        switch (q.type) {
          case 'curseur': {
            const s = Math.min(1, Math.max(0, niveau + bruit));
            return borner(q.minimum + (q.sens === 'bas' ? 1 - s : s) * (q.maximum - q.minimum), q.minimum, q.maximum);
          }
          case 'etoiles':
            return borner(1 + (niveau + bruit) * (q.maximum - 1), 1, q.maximum);
          case 'emotions':
            return emotionsDuClient.length && r() < 0.8
              ? [...new Set(Array.from({ length: entier(r, 1, 3) }, () => choix(r, emotionsDuClient)))]
              : null;
          case 'oui_non':
            return r() < 0.7 ? r() < 0.4 + (1 - niveau) * 0.4 : null;
          case 'choix_unique':
            return choix(r, q.options);
          case 'choix_multiple':
            return q.options.filter(() => r() < 0.4);
          default:
            return r() < 0.5 ? choix(r, COMMENTAIRES) : null;
        }
      };
      envoi.reponses = questions.map((q) => ({
        question_id: q.id,
        libelle: q.libelle,
        type: q.type,
        valeur: valeur(q),
      }));
      envoi.repondu_le = `${jourReponse}T19:30:00.000Z`;
      if (jourReponse < limiteConsultation) envoi.consulte_le = `${jourReponse}T21:00:00.000Z`;
    }
    jeu.envois.push(envoi);
  };

  // questionnaires envoyés entre deux séances
  for (const s of seances.slice(0, -1)) {
    const jour = ajouterJours(s.date_seance, entier(r, 2, 6));
    if (r() < 0.35 && jour <= DATE_REFERENCE_DEMO) envoyer(jour, s.numero);
  }
  // Cycle de relance après la dernière séance : le thérapeute a suivi ses
  // tâches, sauf celles de la dernière semaine, qui restent « à faire ».
  const derniere = seances[seances.length - 1];
  let echeance = ajouterJours(derniere.date_seance, p.relance_delai_jours);
  for (let k = 0; k < p.relance_max; k++) {
    if (!client.relances_actives || echeance > ajouterJours(DATE_REFERENCE_DEMO, -6)) break;
    const jour = ajouterJours(echeance, entier(r, 0, 3));
    if (jour > DATE_REFERENCE_DEMO) break;
    envoyer(jour, derniere.numero);
    echeance = ajouterJours(jour, p.relance_intervalle_jours);
  }
}

const SUIVIS = [
  (p: string, e: string) => `${p} dit avoir mieux dormi cette semaine, mais l'émotion de ${e} reste présente.`,
  (p: string, e: string) => `${p} arrive tendu(e) après un épisode de ${e} survenu au travail.`,
  (p: string, e: string) => `Semaine plus calme : ${p} a fait l'exercice proposé et repéré trois moments de ${e}.`,
  (p: string, e: string) => `${p} évoque un souvenir d'enfance lié à l'émotion de ${e}.`,
  (p: string, e: string) => `${p} relate une dispute familiale qui a ravivé l'émotion de ${e}.`,
];

function rediger(r: Alea, prenom: string, codes: string[], pile: number[], type: TypeSeance, numero: number) {
  const lib = (id: number) => EMOTIONS.find((x) => x.id === id)!.libelle.toLowerCase();
  const phrases = [
    numero === 1 ? `${prenom} ${choix(r, CONSTATS[codes[0]])}.` : choix(r, SUIVIS)(prenom, lib(pile[0])),
  ];
  if (numero > 1 && r() < 0.5) phrases.push(`Rappel du motif : ${choix(r, CONSTATS[codes[0]])}.`);
  if (pile.length > 1)
    phrases.push(`Travail sur l'émotion de ${lib(pile[0])} ; en remontant la chronologie apparaît ${lib(pile[1])}.`);
  else phrases.push(`L'émotion de ${lib(pile[0])} est au premier plan.`);
  if (codes[1]) phrases.push(`${choix(r, CONSTATS[codes[1]]).replace(/^./, (c) => c.toUpperCase())}.`);
  phrases.push(
    type === 'bilan'
      ? "Bilan : l'intensité ressentie a nettement diminué depuis la première séance. Souhaite poursuivre."
      : type === 'supplementaire'
        ? 'Séance de consolidation ; les situations difficiles sont mieux traversées.'
        : `Exercice proposé pour la semaine : noter les moments de ${lib(pile[0])} et ce qui les précède.`,
  );
  return phrases.join(' ');
}

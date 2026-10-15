// Socle SQL dans un vrai PostgreSQL (PGlite, voir supabaseLocal.ts) :
// référentiels, cloisonnement (RLS), parcours, statistiques (égales à la
// démo), paramètres par défaut, questionnaires, liens, corbeille, quota IA,
// emploi du temps, tarifs, double authentification.

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReponseInvalide, validerReponses } from '../supabase/functions/_shared/questionnaire.ts';
import { PARAMETRES_PAR_DEFAUT, QUESTIONNAIRE_PAR_DEFAUT } from '../src/config/parametresDefaut';
import { EMOTIONS, PROBLEMATIQUES, TRANCHES_AGE, ZONES } from '../src/config/referentiels';
import { empreinteJeton } from '../src/domaine/securite';
import { genererJeuDemo, ID_THERAPEUTE_DEMO, type JeuDemo } from '../src/donnees/jeuDemo';
import { calculerStatistiques } from '../src/domaine/statistiques';
import type { QuestionEnvoyee, Statistiques, ValeurReponse } from '../src/domaine/types';
import { baseSupabase, commeUtilisateur, creerCompte } from './supabaseLocal';

const A = '0000000a-0000-4000-8000-000000000001';
const B = '0000000b-0000-4000-8000-000000000002';

async function creerClient(db: PGlite, uid: string, nom = 'Durand') {
  return commeUtilisateur(db, uid, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.clients (nom, prenom, annee_naissance) values ($1, 'Alice', 1985) returning id`,
      [nom],
    );
    return r.rows[0].id;
  });
}
async function creerSeance(db: PGlite, uid: string, clientId: string) {
  return commeUtilisateur(db, uid, async (tx) => {
    const r = await tx.query<{ id: string; numero: number; type: string }>(
      `insert into public.seances (client_id) values ($1) returning id, numero, type`,
      [clientId],
    );
    return r.rows[0];
  });
}

describe('schéma et référentiels', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseSupabase();
  });

  it('les référentiels SQL sont identiques à src/config/referentiels.ts', async () => {
    const emotions = await db.query(`select id, libelle from public.emotions order by ordre`);
    expect(emotions.rows).toEqual(EMOTIONS);
    const problematiques = await db.query(`select id, code, libelle from public.problematiques order by ordre`);
    expect(problematiques.rows).toEqual(PROBLEMATIQUES);
    const tranches = await db.query(`select id, libelle, age_min, age_max from public.tranches_age order by age_min`);
    expect(tranches.rows).toEqual(TRANCHES_AGE);
  });

  it("crée le profil thérapeute à l'inscription", async () => {
    await creerCompte(db, A, 'Camille', 'Laurent');
    const r = await db.query(`select prenom, nom from public.therapeutes where id = $1`, [A]);
    expect(r.rows).toEqual([{ prenom: 'Camille', nom: 'Laurent' }]);
  });
});

describe('confidentialité : cloisonnement par thérapeute (RLS)', () => {
  let db: PGlite;
  let clientA: string;
  let seanceA: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    clientA = await creerClient(db, A);
    seanceA = (await creerSeance(db, A, clientA)).id;
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`select public.enregistrer_seance($1, $2)`, [
        seanceA,
        JSON.stringify({
          date_seance: '2026-09-01',
          lignee: 'mere',
          objectif: 'Apaiser les crises',
          tim: 'x',
          notes: 'Notes confidentielles',
          cases: [
            { zone: 'present1_haut', position: 1, emotion_id: 1 },
            { zone: 'present1_pile', position: 1, emotion_id: 3 },
            { zone: 'present1_pile', position: 2, emotion_id: 1 },
            { zone: 'generation_2', position: 2, emotion_id: 7 },
            { zone: 'grille_generation_3', position: 4, emotion_id: 8 },
            { zone: 'naissance', position: 1, emotion_id: null },
          ],
        }),
      ]),
    );
  });

  it('le propriétaire lit sa fiche complète', async () => {
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query(`select notes, lignee, objectif from public.seances where id = $1`, [seanceA]),
    );
    expect(r.rows).toEqual([{ notes: 'Notes confidentielles', lignee: 'mere', objectif: 'Apaiser les crises' }]);
    // la case vide n'est pas conservée
    const cases = await commeUtilisateur(db, A, (tx) =>
      tx.query(
        `select zone, position, emotion_id from public.seance_cases where seance_id = $1 order by zone, position`,
        [seanceA],
      ),
    );
    expect(cases.rows).toEqual([
      { zone: 'present1_haut', position: 1, emotion_id: 1 },
      { zone: 'present1_pile', position: 1, emotion_id: 3 },
      { zone: 'present1_pile', position: 2, emotion_id: 1 },
      { zone: 'generation_2', position: 2, emotion_id: 7 },
      { zone: 'grille_generation_3', position: 4, emotion_id: 8 },
    ]);
  });

  it('la base accepte exactement les cases de la fiche papier (fiche.ts)', async () => {
    for (const z of ZONES) {
      await commeUtilisateur(db, A, (tx) =>
        tx.query(`insert into public.seance_cases values ($1, $2, $3, 1) on conflict do nothing`, [
          seanceA,
          z.zone,
          z.cases,
        ]),
      );
      await expect(
        commeUtilisateur(db, A, (tx) =>
          tx.query(`insert into public.seance_cases values ($1, $2, $3, 1)`, [seanceA, z.zone, z.cases + 1]),
        ),
        z.zone,
      ).rejects.toThrow(/check/);
    }
    const r = await db.query<{ zones: string[] }>(`select enum_range(null::public.zone_fiche)::text[] as zones`);
    expect(r.rows[0].zones).toEqual(ZONES.map((z) => z.zone));
  });

  it('un autre thérapeute ne voit rien', async () => {
    for (const table of ['clients', 'seances', 'client_problematiques', 'clients_resume']) {
      const r = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.${table}`));
      expect(r.rows, table).toEqual([]);
    }
    const cases = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.seance_cases`));
    expect(cases.rows).toEqual([]);
  });

  it('un autre thérapeute ne peut ni modifier, ni supprimer, ni enregistrer', async () => {
    const maj = await commeUtilisateur(db, B, (tx) =>
      tx.query(`update public.clients set nom = 'Piraté' where id = $1`, [clientA]),
    );
    expect(maj.affectedRows).toBe(0);
    const sup = await commeUtilisateur(db, B, (tx) => tx.query(`delete from public.seances where id = $1`, [seanceA]));
    expect(sup.affectedRows).toBe(0);
    await expect(
      commeUtilisateur(db, B, (tx) =>
        tx.query(`select public.enregistrer_seance($1, '{"notes":"écrasé"}')`, [seanceA]),
      ),
    ).rejects.toThrow(/introuvable/);
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query(`select notes from public.seances where id = $1`, [seanceA]),
    );
    expect(r.rows).toEqual([{ notes: 'Notes confidentielles' }]);
  });

  it("un autre thérapeute ne peut rien rattacher au client d'autrui", async () => {
    await expect(creerSeance(db, B, clientA)).rejects.toThrow();
    await expect(
      commeUtilisateur(db, B, (tx) =>
        tx.query(`insert into public.client_problematiques (client_id, problematique_id) values ($1, 1)`, [clientA]),
      ),
    ).rejects.toThrow();
    await expect(
      commeUtilisateur(db, B, (tx) =>
        tx.query(`insert into public.seance_cases values ($1, 'present1_pile', 9, 2)`, [seanceA]),
      ),
    ).rejects.toThrow();
    await expect(
      commeUtilisateur(db, B, (tx) =>
        tx.query(
          `insert into public.clients (therapeute_id, nom, prenom, annee_naissance) values ($1, 'X', 'Y', 1990)`,
          [A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('les champs structurels de la séance ne sont pas modifiables', async () => {
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.seances set numero = 9 where id = $1`, [seanceA])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      commeUtilisateur(db, A, (tx) =>
        tx.query(`update public.seances set therapeute_id = $2 where id = $1`, [seanceA, B]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("un visiteur anonyme n'a accès à rien", async () => {
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.clients`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.emotions`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select public.statistiques('groupe')`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("parcours : 3 séances, bilan, puis séances à l'unité", () => {
  it('numérote et type automatiquement, et protège la numérotation', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    const client = await creerClient(db, A);
    const seances: { id: string; numero: number; type: string }[] = [];
    for (let i = 0; i < 6; i++) seances.push(await creerSeance(db, A, client));
    expect(seances.map((s) => [s.numero, s.type])).toEqual([
      [1, 'initiale'],
      [2, 'initiale'],
      [3, 'initiale'],
      [4, 'bilan'],
      [5, 'supplementaire'],
      [6, 'supplementaire'],
    ]);

    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`delete from public.seances where id = $1`, [seances[1].id])),
    ).rejects.toThrow(/dernière séance/);
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.seances where id = $1`, [seances[5].id]));
    expect((await creerSeance(db, A, client)).numero).toBe(6);

    // supprimer le client emporte tout le parcours
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.clients where id = $1`, [client]));
    const reste = await db.query(`select count(*)::int as n from public.seances`);
    expect(reste.rows).toEqual([{ n: 0 }]);
  });
});

// ---------------------------------------------------------------------
// Statistiques : la fonction SQL et le calcul du mode démo doivent
// donner exactement les mêmes chiffres sur le même jeu de données.
// ---------------------------------------------------------------------
async function chargerJeu(db: PGlite, jeu: JeuDemo) {
  await db.exec(`set session_replication_role = replica`); // charge brute, sans déclencheurs
  await db.query(
    `insert into auth.users (id, email) select (x->>'id')::uuid, x->>'email' from jsonb_array_elements($1::jsonb) x`,
    [JSON.stringify(jeu.therapeutes)],
  );
  await db.query(
    `insert into public.therapeutes select * from jsonb_populate_recordset(null::public.therapeutes, $1)`,
    [JSON.stringify(jeu.therapeutes.map(({ id, nom, prenom }) => ({ id, nom, prenom, cree_le: '2025-09-01' })))],
  );
  await db.query(`insert into public.clients select * from jsonb_populate_recordset(null::public.clients, $1)`, [
    JSON.stringify(jeu.clients.map((c) => ({ ...c, maj_le: c.cree_le }))),
  ]);
  await db.query(
    `insert into public.client_problematiques select * from jsonb_populate_recordset(null::public.client_problematiques, $1)`,
    [JSON.stringify(jeu.client_problematiques)],
  );
  await db.query(`insert into public.seances select * from jsonb_populate_recordset(null::public.seances, $1)`, [
    JSON.stringify(jeu.seances.map((s) => ({ ...s, cree_le: s.date_seance, maj_le: s.date_seance }))),
  ]);
  await db.query(
    `insert into public.seance_cases select * from jsonb_populate_recordset(null::public.seance_cases, $1)`,
    [JSON.stringify(jeu.seances.flatMap((s) => s.cases.map((c) => ({ seance_id: s.id, ...c }))))],
  );
  await db.exec(`set session_replication_role = origin`);
}

const REFERENCE = '2026-09-30';

async function statsSql(db: PGlite, uid: string, perimetre: string, periode = 'tout') {
  const r = await commeUtilisateur(db, uid, (tx) =>
    tx.query<{ s: Statistiques }>(`select public.statistiques($1, $2::date, $3) as s`, [perimetre, REFERENCE, periode]),
  );
  return r.rows[0].s;
}

describe('statistiques', () => {
  const jeu = genererJeuDemo();
  let db: PGlite;
  beforeAll(async () => {
    db = await baseSupabase();
    await chargerJeu(db, jeu);
  });

  it('le jeu de démonstration est chargé en entier', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.seances`);
    expect(r.rows[0].n).toBe(jeu.seances.length);
    expect(jeu.seances.length).toBeGreaterThan(400);
  });

  for (const perimetre of ['personnel', 'groupe'] as const) {
    for (const uid of [ID_THERAPEUTE_DEMO, jeu.therapeutes[3].id]) {
      it(`SQL = mode démo (${perimetre}, thérapeute ${uid.slice(-2)})`, async () => {
        const sql = await statsSql(db, uid, perimetre);
        const demo = calculerStatistiques(jeu, uid, perimetre, REFERENCE);
        expect(sql).toEqual(demo);
      });
    }
  }

  for (const periode of ['3mois', '12mois'] as const)
    it(`SQL = mode démo sur une période (${periode})`, async () => {
      const sql = await statsSql(db, ID_THERAPEUTE_DEMO, 'personnel', periode);
      expect(sql).toEqual(calculerStatistiques(jeu, ID_THERAPEUTE_DEMO, 'personnel', REFERENCE, periode));
      const tout = await statsSql(db, ID_THERAPEUTE_DEMO, 'personnel');
      if (!sql.disponible || !tout.disponible) throw new Error('indisponible');
      expect(sql.kpis.nb_seances).toBeLessThan(tout.kpis.nb_seances);
      expect(sql.par_mois).toEqual(tout.par_mois); // la courbe garde ses 12 mois
    });

  it("l'espace de groupe ignore la période (pas de fenêtres de dates au choix)", async () => {
    expect(await statsSql(db, ID_THERAPEUTE_DEMO, 'groupe', '3mois')).toEqual(
      await statsSql(db, ID_THERAPEUTE_DEMO, 'groupe'),
    );
    await expect(statsSql(db, ID_THERAPEUTE_DEMO, 'personnel', '2jours')).rejects.toThrow(/Période inconnue/);
  });

  it("l'espace personnel ne compte que ses propres clients", async () => {
    const s = await statsSql(db, ID_THERAPEUTE_DEMO, 'personnel');
    expect(s.disponible && s.kpis.nb_clients).toBe(
      new Set(jeu.seances.filter((x) => x.therapeute_id === ID_THERAPEUTE_DEMO).map((x) => x.client_id)).size,
    );
    expect(s.disponible && s.kpis.nb_therapeutes).toBe(1);
  });

  it("l'espace de groupe agrège tous les thérapeutes et ne publie que des agrégats", async () => {
    const s = await statsSql(db, ID_THERAPEUTE_DEMO, 'groupe');
    expect(s.disponible).toBe(true);
    if (!s.disponible) return;
    expect(s.kpis.nb_therapeutes).toBe(jeu.therapeutes.length);
    const texte = JSON.stringify(s);
    for (const c of jeu.clients.slice(0, 50)) expect(texte).not.toContain(c.id);
    for (const t of jeu.therapeutes) expect(texte).not.toContain(t.id);
  });

  it("masque toute case où moins de 5 clients d'autres thérapeutes contribuent", async () => {
    const s = await statsSql(db, ID_THERAPEUTE_DEMO, 'groupe');
    if (!s.disponible) throw new Error('indisponible');
    const autres = (ids: Set<string>) =>
      [...ids].filter((id) => jeu.clients.find((c) => c.id === id)!.therapeute_id !== ID_THERAPEUTE_DEMO).length;
    for (const p of s.problematiques) {
      const ids = new Set(
        jeu.client_problematiques
          .filter(
            (x) => x.problematique_id === p.problematique_id && jeu.seances.some((y) => y.client_id === x.client_id),
          )
          .map((x) => x.client_id),
      );
      expect(p.masque, p.libelle).toBe(autres(ids) < 5);
      if (p.masque) expect(p.nb_clients).toBeNull();
    }
    expect(s.problematiques.some((p) => p.masque)).toBe(true); // le jeu contient des cas masqués
  });

  it("l'espace de groupe reste fermé sous 3 thérapeutes contributeurs", async () => {
    const petit = await baseSupabase();
    const deux = { ...jeu, seances: jeu.seances.filter((s) => s.therapeute_id <= jeu.therapeutes[1].id) };
    await chargerJeu(petit, deux);
    const s = await statsSql(petit, ID_THERAPEUTE_DEMO, 'groupe');
    expect(s).toEqual({
      perimetre: 'groupe',
      disponible: false,
      seuils: { clients: 5, therapeutes: 3 },
      kpis: { nb_therapeutes: 2 },
    });
    expect(calculerStatistiques(deux, ID_THERAPEUTE_DEMO, 'groupe', REFERENCE)).toEqual(s);
  });

  it('compte les séances des 12 derniers mois', async () => {
    const s = await statsSql(db, ID_THERAPEUTE_DEMO, 'personnel');
    if (!s.disponible) throw new Error('indisponible');
    expect(s.par_mois.map((m) => m.mois)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(s.par_mois.reduce((t, m) => t + m.nb_seances, 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------
// Relances, questionnaire de suivi, tarifs, double authentification
// ---------------------------------------------------------------------
describe('espace du thérapeute : paramètres et questionnaire par défaut', () => {
  it('sont créés avec le compte, identiques à src/config/parametresDefaut.ts', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    const p = await commeUtilisateur(db, A, (tx) =>
      tx.query<Record<string, unknown>>(
        `select ${Object.keys(PARAMETRES_PAR_DEFAUT).join(', ')} from public.parametres`,
      ),
    );
    expect(p.rows).toEqual([PARAMETRES_PAR_DEFAUT]);
    const { questions, ...entete } = QUESTIONNAIRE_PAR_DEFAUT;
    const qr = await commeUtilisateur(db, A, (tx) =>
      tx.query(`select titre, introduction, remerciement, par_defaut, ordre from public.questionnaires`),
    );
    expect(qr.rows).toEqual([entete]);
    const q = await commeUtilisateur(db, A, (tx) =>
      tx.query(
        `select ordre, libelle, type, aide, obligatoire, options, minimum, maximum, sens, libelle_min, libelle_max, active
         from public.questions order by ordre`,
      ),
    );
    expect(q.rows).toEqual(questions);
  });
});

describe('questionnaires : édition, questionnaire par défaut, cloisonnement', () => {
  let db: PGlite;
  let client: string;
  let parDefaut: string;
  const enregistrer = (uid: string, q: unknown) =>
    commeUtilisateur(
      db,
      uid,
      async (tx) =>
        (await tx.query<{ id: string }>(`select public.enregistrer_questionnaire($1) as id`, [JSON.stringify(q)]))
          .rows[0].id,
    );
  const lire = (uid: string, id: string) =>
    commeUtilisateur(
      db,
      uid,
      async (tx) =>
        (
          await tx.query<{ id: string; libelle: string; type: string; options: string[] }>(
            `select id, libelle, type, options from public.questions where questionnaire_id = $1 order by ordre`,
            [id],
          )
        ).rows,
    );

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set email = 'alice@exemple.fr' where id = $1`, [client]),
    );
    parDefaut = (await db.query<{ id: string }>(`select id from public.questionnaires where therapeute_id = $1`, [A]))
      .rows[0].id;
  });

  it('crée, modifie (et retire) des questions en une fois', async () => {
    const id = await enregistrer(A, {
      titre: 'Bilan',
      questions: [
        { libelle: 'Évolution ?', type: 'choix_unique', options: ['Mieux', 'Pareil'] },
        {
          libelle: 'Domaines ?',
          type: 'choix_multiple',
          options: ['Sommeil', 'Travail', 'Famille'],
          obligatoire: false,
        },
        { libelle: 'Note', type: 'etoiles', minimum: 1, maximum: 7 },
      ],
    });
    const avant = await lire(A, id);
    expect(avant.map((q) => q.type)).toEqual(['choix_unique', 'choix_multiple', 'etoiles']);
    expect(avant[1].options).toEqual(['Sommeil', 'Travail', 'Famille']);

    // on garde la 3e (même id), on supprime la 1re, on en ajoute une
    await enregistrer(A, {
      id,
      titre: 'Bilan v2',
      questions: [
        { ...avant[2], minimum: 1, maximum: 7 },
        { libelle: 'Un mot ?', type: 'texte' },
      ],
    });
    const apres = await lire(A, id);
    expect(apres.map((q) => q.libelle)).toEqual(['Note', 'Un mot ?']);
    expect(apres[0].id).toBe(avant[2].id);
  });

  it("refuse les questions mal formées (mêmes règles que l'éditeur)", async () => {
    await expect(
      enregistrer(A, { titre: 'X', questions: [{ libelle: 'Q', type: 'choix_unique', options: ['Seule'] }] }),
    ).rejects.toThrow(/check/);
    await expect(
      enregistrer(A, { titre: 'X', questions: [{ libelle: 'Q', type: 'etoiles', minimum: 1, maximum: 12 }] }),
    ).rejects.toThrow(/check/);
    await expect(
      enregistrer(A, { titre: 'X', questions: [{ libelle: 'Q', type: 'curseur', minimum: 5, maximum: 5 }] }),
    ).rejects.toThrow(/check/);
    await expect(enregistrer(A, { titre: ' ', questions: [] })).rejects.toThrow(/check/);
  });

  it('un seul questionnaire par défaut, qui ne se supprime pas', async () => {
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`delete from public.questionnaires where id = $1`, [parDefaut])),
    ).rejects.toThrow(/par défaut/);
    const autre = await enregistrer(A, { titre: 'Autre', questions: [{ libelle: 'Q', type: 'oui_non' }] });
    await commeUtilisateur(db, A, (tx) => tx.query(`select public.definir_questionnaire_par_defaut($1)`, [autre]));
    const defauts = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ id: string }>(`select id from public.questionnaires where par_defaut`),
    );
    expect(defauts.rows).toEqual([{ id: autre }]);
    // l'ancien peut maintenant être supprimé
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.questionnaires where id = $1`, [parDefaut]));
    await commeUtilisateur(db, A, (tx) => tx.query(`select public.definir_questionnaire_par_defaut($1)`, [autre]));
  });

  it("l'envoi copie le questionnaire choisi (titre et questions actives)", async () => {
    const id = await enregistrer(A, {
      titre: 'Point rapide',
      introduction: 'Deux questions.',
      questions: [
        { libelle: 'Humeur', type: 'curseur' },
        { libelle: 'Inactive', type: 'texte', active: false },
      ],
    });
    const e = await commeUtilisateur(
      db,
      A,
      async (tx) =>
        (await tx.query<{ e: { id: string } }>(`select public.preparer_envoi($1, 'email', $2) as e`, [client, id]))
          .rows[0].e,
    );
    const stocke = await db.query<{
      questionnaire_id: string;
      questionnaire: { titre: string };
      questions: { libelle: string }[];
    }>(`select questionnaire_id, questionnaire, questions from public.envois where id = $1`, [e.id]);
    expect(stocke.rows[0].questionnaire_id).toBe(id);
    expect(stocke.rows[0].questionnaire.titre).toBe('Point rapide');
    expect(stocke.rows[0].questions.map((q) => q.libelle)).toEqual(['Humeur']);
  });

  it('le serveur et le navigateur valident les réponses exactement de la même façon', async () => {
    const id = await enregistrer(A, {
      titre: 'Tous les types',
      questions: [
        { libelle: 'Curseur', type: 'curseur', minimum: 1, maximum: 5 },
        { libelle: 'Étoiles', type: 'etoiles', minimum: 1, maximum: 4, obligatoire: false },
        { libelle: 'Choix', type: 'choix_unique', options: ['A', 'B'], obligatoire: false },
        { libelle: 'Plusieurs', type: 'choix_multiple', options: ['X', 'Y', 'Z'], obligatoire: false },
        { libelle: 'Oui ?', type: 'oui_non', obligatoire: false },
        { libelle: 'Émotions', type: 'emotions', obligatoire: false },
        { libelle: 'Mot', type: 'texte', obligatoire: false },
      ],
    });
    const emotions = EMOTIONS.map((e) => e.libelle);
    const cas: Record<string, unknown>[] = [
      { Curseur: 3 },
      {},
      { Curseur: null },
      { Curseur: 0 },
      { Curseur: 6 },
      { Curseur: 3.5 },
      { Curseur: '3' },
      { Curseur: true },
      { Curseur: 3, Étoiles: 5 },
      {
        Curseur: 3,
        Étoiles: 4,
        Choix: 'A',
        Plusieurs: ['X', 'Z'],
        'Oui ?': false,
        Émotions: [emotions[2]],
        Mot: 'Bien',
      },
      { Curseur: 3, Choix: 'C' },
      { Curseur: 3, Choix: ['A'] },
      { Curseur: 3, Plusieurs: ['X', 'X'] },
      { Curseur: 3, Plusieurs: 'X' },
      { Curseur: 3, Plusieurs: [1] },
      { Curseur: 3, Plusieurs: [] },
      { Curseur: 3, 'Oui ?': 1 },
      { Curseur: 3, Émotions: ['Inventée'] },
      { Curseur: 3, Mot: '   ' },
      { Curseur: 3, Mot: 'x'.repeat(2001) },
    ];
    for (const saisie of cas) {
      const e = await commeUtilisateur(
        db,
        A,
        async (tx) =>
          (
            await tx.query<{ e: { id: string; jeton: string } }>(`select public.preparer_envoi($1, 'email', $2) as e`, [
              client,
              id,
            ])
          ).rows[0].e,
      );
      // le lien quitte l'application (messagerie ouverte) : il devient actif
      await commeUtilisateur(db, A, (tx) =>
        tx.query(`update public.envois set lien_sorti_le = now() where id = $1`, [e.id]),
      );
      const qs = (
        await db.query<{ questions: QuestionEnvoyee[] }>(`select questions from public.envois where id = $1`, [e.id])
      ).rows[0].questions;
      const parId = Object.fromEntries(
        Object.entries(saisie).map(([libelle, v]) => [qs.find((q) => q.libelle === libelle)!.id, v]),
      );
      let attendu = 'acceptée';
      try {
        validerReponses(qs, parId as Record<string, ValeurReponse>, emotions);
      } catch (err) {
        if (!(err instanceof ReponseInvalide)) throw err;
        attendu = err.message;
      }
      const obtenu = await commeUtilisateur(db, null, (tx) =>
        tx.query(`select public.repondre_questionnaire($1, $2)`, [e.jeton, JSON.stringify(parId)]),
      ).then(
        () => 'acceptée',
        (err: Error) => err.message,
      );
      expect(obtenu, JSON.stringify(saisie)).toBe(attendu);
    }
  });

  it("un autre thérapeute ne voit ni n'utilise les questionnaires d'autrui", async () => {
    const a = (await commeUtilisateur(db, A, (tx) => tx.query<{ id: string }>(`select id from public.questionnaires`)))
      .rows;
    expect(a.length).toBeGreaterThan(0);
    const b = await commeUtilisateur(db, B, (tx) => tx.query<{ id: string }>(`select id from public.questionnaires`));
    expect(b.rows.map((x) => x.id)).not.toContain(a[0].id);
    expect(await lire(B, a[0].id)).toEqual([]);
    await expect(enregistrer(B, { id: a[0].id, titre: 'Piraté', questions: [] })).rejects.toThrow(/introuvable/);
    await expect(
      commeUtilisateur(db, B, (tx) => tx.query(`select public.definir_questionnaire_par_defaut($1)`, [a[0].id])),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("lien du questionnaire : actif une fois sorti de l'application", () => {
  it("inactif après préparation, actif une fois sorti ; une réponse confirme l'envoi", async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    const client = await creerClient(db, A);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set email = 'a@exemple.fr' where id = $1`, [client]),
    );
    const e = await commeUtilisateur(
      db,
      A,
      async (tx) =>
        (
          await tx.query<{ e: { id: string; jeton: string } }>(`select public.preparer_envoi($1, 'email') as e`, [
            client,
          ])
        ).rows[0].e,
    );
    const ouvrir = async () =>
      (
        await commeUtilisateur(db, null, (tx) =>
          tx.query<{ q: { valide: boolean; raison?: string } }>(`select public.questionnaire_public($1) as q`, [
            e.jeton,
          ]),
        )
      ).rows[0].q;
    const repondre = () =>
      commeUtilisateur(db, null, (tx) =>
        tx.query(`select public.repondre_questionnaire($1, $2)`, [
          e.jeton,
          JSON.stringify(Object.fromEntries(qs.map((q) => [q.id, 5]))),
        ]),
      );
    const qs = (
      await db.query<{ questions: { id: string; type: string }[] }>(
        `select questions from public.envois where id = $1`,
        [e.id],
      )
    ).rows[0].questions.filter((q) => q.type === 'curseur');

    expect((await ouvrir()).raison).toBe('non_envoye');
    await expect(repondre()).rejects.toThrow(/pas encore actif/);

    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.envois set lien_sorti_le = now() where id = $1`, [e.id]),
    );
    expect((await ouvrir()).valide).toBe(true);
    await repondre();
    // le thérapeute n'avait pas cliqué sur « J'ai envoyé » : la réponse confirme l'envoi
    const r = await db.query<{ envoye_le: string | null }>(`select envoye_le from public.envois where id = $1`, [e.id]);
    expect(r.rows[0].envoye_le).not.toBeNull();
  });
});

describe('corbeille des clients', () => {
  it('un client supprimé disparaît des statistiques et des liens, puis est effacé après 30 jours', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    const garde = await creerClient(db, A, 'Garde');
    const jete = await creerClient(db, A, 'Jete');
    for (const c of [garde, jete]) await creerSeance(db, A, c);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set email = 'j@exemple.fr' where id = $1`, [jete]),
    );
    const e = await commeUtilisateur(
      db,
      A,
      async (tx) =>
        (await tx.query<{ e: { id: string; jeton: string } }>(`select public.preparer_envoi($1, 'email') as e`, [jete]))
          .rows[0].e,
    );
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.envois set lien_sorti_le = now() where id = $1`, [e.id]),
    );

    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set supprime_le = now() where id = $1`, [jete]),
    );
    const stats = (
      await commeUtilisateur(db, A, (tx) =>
        tx.query<{ s: Statistiques }>(`select public.statistiques('personnel') as s`),
      )
    ).rows[0].s;
    expect(stats.disponible && stats.kpis.nb_clients).toBe(1);
    const q = (
      await commeUtilisateur(db, null, (tx) =>
        tx.query<{ q: { raison: string } }>(`select public.questionnaire_public($1) as q`, [e.jeton]),
      )
    ).rows[0].q;
    expect(q.raison).toBe('inconnu');
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`select public.preparer_envoi($1, 'email')`, [jete])),
    ).rejects.toThrow(/introuvable/);

    // restaurable tant que les 30 jours ne sont pas écoulés
    const purger = async (uid: string) =>
      (await commeUtilisateur(db, uid, (tx) => tx.query<{ n: number }>(`select public.purger_corbeille() as n`)))
        .rows[0].n;
    expect(await purger(A)).toBe(0);
    await db.query(`update public.clients set supprime_le = now() - interval '31 days' where id = $1`, [jete]);
    expect(await purger(B)).toBe(0); // chacun ne purge que sa corbeille
    expect(await purger(A)).toBe(1);
    const reste = await db.query<{ id: string }>(`select id from public.clients where therapeute_id = $1`, [A]);
    expect(reste.rows).toEqual([{ id: garde }]);
    const seances = await db.query<{ n: number }>(
      `select count(*)::int as n from public.seances where client_id = $1`,
      [jete],
    );
    expect(seances.rows[0].n).toBe(0);
  });

  it('les statistiques SQL et démo excluent pareillement la corbeille', async () => {
    const jeu = genererJeuDemo();
    const supprime = jeu.clients.find((c) => c.therapeute_id === ID_THERAPEUTE_DEMO)!;
    supprime.supprime_le = '2026-09-20T10:00:00.000Z';
    const db = await baseSupabase();
    await chargerJeu(db, jeu);
    for (const perimetre of ['personnel', 'groupe'] as const)
      expect(await statsSql(db, ID_THERAPEUTE_DEMO, perimetre)).toEqual(
        calculerStatistiques(jeu, ID_THERAPEUTE_DEMO, perimetre, REFERENCE),
      );
  });
});

describe("quota quotidien d'appels à Gemini", () => {
  it('plafond commun à toute la plateforme (une seule clé)', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    await db.query(`update public.plateforme set ia_quota_jour_total = 3`);
    const reserver = async (uid: string) =>
      (await commeUtilisateur(db, uid, (tx) => tx.query<{ ok: boolean }>(`select public.consommer_quota_ia() as ok`)))
        .rows[0].ok;
    expect([await reserver(A), await reserver(A), await reserver(B), await reserver(B)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const q = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ q: { plateforme_epuisee: boolean } }>(`select public.quota_ia() as q`),
    );
    expect(q.rows[0].q.plateforme_epuisee).toBe(true);
    // les thérapeutes ne voient ni ne changent ce plafond
    await expect(commeUtilisateur(db, A, (tx) => tx.query(`select * from public.plateforme`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.plateforme set ia_quota_jour_total = 1000`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('réserve au plus `ia_quota_jour` appels par jour et par thérapeute', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set ia_quota_jour = 2`));
    const reserver = async (uid: string) =>
      (await commeUtilisateur(db, uid, (tx) => tx.query<{ ok: boolean }>(`select public.consommer_quota_ia() as ok`)))
        .rows[0].ok;
    expect([await reserver(A), await reserver(A), await reserver(A)]).toEqual([true, true, false]);
    expect(await reserver(B)).toBe(true); // quota propre à chacun
    const q = await commeUtilisateur(db, A, (tx) => tx.query<{ q: unknown }>(`select public.quota_ia() as q`));
    expect(q.rows[0].q).toEqual({ utilise: 2, max: 2, plateforme_epuisee: false });
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set ia_quota_jour = 0`));
    expect(await reserver(A)).toBe(false);
    await expect(commeUtilisateur(db, A, (tx) => tx.query(`select * from public.usage_ia`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set ia_quota_jour = 500`)),
    ).rejects.toThrow(/check/);
  });
});

describe('relance avec lien vers le questionnaire', () => {
  let db: PGlite;
  let client: string;
  let jeton: string;
  let envoiId: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A, 'Camille', 'Laurent');
    await creerCompte(db, B);
    client = await creerClient(db, A);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set email = 'alice@exemple.fr' where id = $1`, [client]),
    );
  });

  it("refuse un canal sans coordonnées et un client d'autrui", async () => {
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`select public.preparer_envoi($1, 'sms')`, [client])),
    ).rejects.toThrow(/coordonnées/);
    await expect(
      commeUtilisateur(db, B, (tx) => tx.query(`select public.preparer_envoi($1, 'email')`, [client])),
    ).rejects.toThrow(/introuvable/);
    await expect(
      commeUtilisateur(db, null, (tx) => tx.query(`select public.preparer_envoi($1, 'email')`, [client])),
    ).rejects.toThrow(/permission denied/);
  });

  it("crée un lien à 256 bits dont seule l'empreinte est stockée", async () => {
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ e: { id: string; jeton: string; destinataire: string } }>(
        `select public.preparer_envoi($1, 'email') as e`,
        [client],
      ),
    );
    ({ id: envoiId, jeton } = r.rows[0].e);
    expect(jeton).toMatch(/^[0-9a-f]{64}$/);
    expect(r.rows[0].e.destinataire).toBe('alice@exemple.fr');
    const stocke = await db.query<{ jeton_hash: string; questions: unknown[] }>(
      `select jeton_hash, questions from public.envois where id = $1`,
      [envoiId],
    );
    expect(stocke.rows[0].jeton_hash).not.toContain(jeton);
    expect(stocke.rows[0].jeton_hash).toBe(await empreinteJeton(jeton));
    expect(stocke.rows[0].questions).toHaveLength(QUESTIONNAIRE_PAR_DEFAUT.questions.length);
  });

  it("l'historique ne garde jamais le jeton en clair", async () => {
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`select public.confirmer_envoi($1, 'Objet', $2)`, [
        envoiId,
        `Bonjour, voici le lien : https://x/q/${jeton}`,
      ]),
    );
    const r = await db.query<{ corps: string; envoye_le: string }>(
      `select corps, envoye_le from public.envois where id = $1`,
      [envoiId],
    );
    expect(r.rows[0].corps).toBe('Bonjour, voici le lien : https://x/q/[jeton masqué]');
    expect(r.rows[0].envoye_le).not.toBeNull();
  });

  it('le client ouvre le questionnaire sans compte, sans rien voir de sa fiche', async () => {
    const r = await commeUtilisateur(db, null, (tx) =>
      tx.query<{ q: Record<string, unknown> }>(`select public.questionnaire_public($1) as q`, [jeton]),
    );
    const q = r.rows[0].q;
    expect(q.valide).toBe(true);
    expect(q.therapeute).toBe('Camille Laurent');
    expect(JSON.stringify(q)).not.toMatch(/Alice|Durand|alice@/);
    const faux = await commeUtilisateur(db, null, (tx) =>
      tx.query<{ q: Record<string, unknown> }>(`select public.questionnaire_public('0000') as q`),
    );
    expect(faux.rows[0].q).toEqual({ valide: false, raison: 'inconnu' });
  });

  it('contrôle chaque réponse, une seule fois', async () => {
    const qs = (
      await db.query<{ questions: { id: string; type: string }[] }>(
        `select questions from public.envois where id = $1`,
        [envoiId],
      )
    ).rows[0].questions;
    const id = (type: string, n = 0) => qs.filter((q) => q.type === type)[n].id;
    const repondre = (reponses: Record<string, unknown>) =>
      commeUtilisateur(db, null, (tx) =>
        tx.query(`select public.repondre_questionnaire($1, $2)`, [jeton, JSON.stringify(reponses)]),
      );
    const [peur, joie] = [EMOTIONS[0].libelle, EMOTIONS[1].libelle];
    const complet = {
      [id('curseur')]: 7,
      [id('curseur', 1)]: 3,
      [id('curseur', 2)]: 6,
      [id('emotions')]: [peur, joie],
      [id('etoiles')]: 4,
      [id('oui_non')]: true,
      [id('texte')]: 'Ça va mieux',
    };

    await expect(repondre({ ...complet, [id('curseur')]: 11 })).rejects.toThrow(/invalide/);
    await expect(repondre({ ...complet, [id('curseur')]: 2.5 })).rejects.toThrow(/invalide/);
    await expect(repondre({ ...complet, [id('etoiles')]: 0 })).rejects.toThrow(/invalide/);
    await expect(repondre({ ...complet, [id('emotions')]: ['Inventée'] })).rejects.toThrow(/invalide/);
    await expect(repondre({ ...complet, [id('oui_non')]: 'oui' })).rejects.toThrow(/invalide/);
    const { [id('curseur', 2)]: _, ...incomplet } = complet;
    await expect(repondre(incomplet)).rejects.toThrow(/manquante/);

    await repondre(complet);
    await expect(repondre(complet)).rejects.toThrow(/déjà/);

    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ reponses: { valeur: unknown }[]; repondu_le: string }>(
        `select reponses, repondu_le from public.envois where id = $1`,
        [envoiId],
      ),
    );
    expect(r.rows[0].reponses.map((x) => x.valeur)).toEqual([7, 3, 6, [peur, joie], 4, true, 'Ça va mieux']);
    const apres = await commeUtilisateur(db, null, (tx) =>
      tx.query<{ q: { raison: string } }>(`select public.questionnaire_public($1) as q`, [jeton]),
    );
    expect(apres.rows[0].q.raison).toBe('deja_repondu');
  });

  it("un lien expiré ne s'ouvre plus", async () => {
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ e: { id: string; jeton: string } }>(`select public.preparer_envoi($1, 'email') as e`, [client]),
    );
    await db.query(
      `update public.envois set expire_le = now() - interval '1 day', lien_sorti_le = now() where id = $1`,
      [r.rows[0].e.id],
    );
    const q = await commeUtilisateur(db, null, (tx) =>
      tx.query<{ q: { raison: string } }>(`select public.questionnaire_public($1) as q`, [r.rows[0].e.jeton]),
    );
    expect(q.rows[0].q.raison).toBe('expire');
  });

  it('les envois restent privés', async () => {
    const b = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.envois`));
    expect(b.rows).toEqual([]);
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.envois`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.envois set reponses = '[]' where id = $1`, [envoiId])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('emploi du temps', () => {
  let db: PGlite;
  let client: string;
  const inserer = (uid: string, rdv: Record<string, unknown>) =>
    commeUtilisateur(db, uid, async (tx) => {
      const cles = Object.keys(rdv);
      const r = await tx.query<{ id: string }>(
        `insert into public.rendez_vous (${cles.join(', ')}) values (${cles.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
        Object.values(rdv),
      );
      return r.rows[0].id;
    });
  const creneau = { debut: '2026-10-06T08:00:00Z', fin: '2026-10-06T09:00:00Z' };

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
  });

  it('règles de la table : client obligatoire pour une séance, intitulé sinon, durée cohérente', async () => {
    await inserer(A, { ...creneau, client_id: client, categorie: 'seance' });
    await inserer(A, { ...creneau, titre: 'Supervision', categorie: 'administratif' });
    await inserer(A, { ...creneau, titre: 'Mme Durand (appel)', categorie: 'premier' });
    await expect(inserer(A, { ...creneau, categorie: 'bilan', titre: 'X' })).rejects.toThrow(/check/);
    await expect(inserer(A, { ...creneau, categorie: 'personnel' })).rejects.toThrow(/check/);
    await expect(
      inserer(A, { client_id: client, categorie: 'seance', debut: creneau.fin, fin: creneau.debut }),
    ).rejects.toThrow(/check/);
    await expect(
      inserer(A, { client_id: client, categorie: 'seance', debut: creneau.debut, fin: '2026-10-06T21:00:00Z' }),
    ).rejects.toThrow(/check/);
  });

  it('cloisonnement : rien de visible ni de rattachable par un autre thérapeute', async () => {
    const b = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.agenda`));
    expect(b.rows).toEqual([]);
    await expect(inserer(B, { ...creneau, client_id: client, categorie: 'seance' })).rejects.toThrow();
    const maj = await commeUtilisateur(db, B, (tx) => tx.query(`update public.rendez_vous set statut = 'annule'`));
    expect(maj.affectedRows).toBe(0);
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.agenda`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('les rendez-vous d’un client mis à la corbeille disparaissent de l’agenda', async () => {
    const compter = async () =>
      (await commeUtilisateur(db, A, (tx) => tx.query<{ n: number }>(`select count(*)::int as n from public.agenda`)))
        .rows[0].n;
    const avant = await compter();
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set supprime_le = now() where id = $1`, [client]),
    );
    expect(await compter()).toBe(avant - 1);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set supprime_le = null where id = $1`, [client]),
    );
    expect(await compter()).toBe(avant);
  });

  it('réglages : heures cohérentes, jours valides, page d’ouverture « emploi du temps »', async () => {
    const maj = (sql: string) => commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set ${sql}`));
    await maj(
      `page_accueil = '/emploi-du-temps', agenda_jours = '{1,2,3,4,5,6}', agenda_couleurs = '{"bilan": "#0f766e"}'`,
    );
    await expect(maj(`agenda_heure_debut = 20, agenda_heure_fin = 8`)).rejects.toThrow(/check/);
    await expect(maj(`agenda_jours = '{0,8}'`)).rejects.toThrow(/check/);
    await expect(maj(`agenda_jours = '{}'`)).rejects.toThrow(/check/);
  });
});

describe('tarifs', () => {
  it('une nouvelle séance prend le tarif du client, sinon le tarif par défaut', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    const c1 = await creerClient(db, A, 'Un');
    const c2 = await creerClient(db, A, 'Deux');
    await commeUtilisateur(db, A, async (tx) => {
      await tx.query(`update public.parametres set prix_defaut = 60`);
      await tx.query(`update public.clients set prix_seance = 75 where id = $1`, [c2]);
    });
    const prix = async (c: string) =>
      (
        await commeUtilisateur(db, A, (tx) =>
          tx.query<{ prix: string }>(`insert into public.seances (client_id) values ($1) returning prix`, [c]),
        )
      ).rows[0].prix;
    expect(Number(await prix(c1))).toBe(60);
    expect(Number(await prix(c2))).toBe(75);
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set tarifs_actifs = false`));
    expect(await prix(c1)).toBeNull();
  });
});

describe('double authentification', () => {
  it('une fois activée, la base exige une session validée par code', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    const c = await creerClient(db, A);
    await creerSeance(db, A, c);
    await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [A]);

    const voit = (aal: 'aal1' | 'aal2') =>
      commeUtilisateur(db, A, (tx) => tx.query(`select id from public.clients`), aal);
    expect((await voit('aal1')).rows).toEqual([]);
    expect((await voit('aal2')).rows).toHaveLength(1);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`select public.statistiques('personnel')`), 'aal1'),
    ).rejects.toThrow(/Authentification requise/);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`select public.preparer_envoi($1, 'email')`, [c]), 'aal1'),
    ).rejects.toThrow(/Accès refusé/);
  });
});

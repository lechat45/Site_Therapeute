// Migration 0.7.0 : journal, exercices et documents remis, reçus, tâches
// personnelles et « plus tard ». Mêmes règles que tests/sql.test.ts :
// cloisonnement par thérapeute, corbeille, jetons jamais stockés en clair.

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { empreinteJeton } from '../src/domaine/securite';
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
const une = async <T>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) =>
  (await commeUtilisateur(db, uid, (tx) => tx.query<T>(sql, params))).rows[0];
const corbeille = (db: PGlite, uid: string, client: string) =>
  commeUtilisateur(db, uid, (tx) => tx.query(`update public.clients set supprime_le = now() where id = $1`, [client]));

describe('journal du thérapeute', () => {
  let db: PGlite;
  let client: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
  });

  it('notes libres ou liées à un client ; une note vide est refusée', async () => {
    const libre = await une<{ id: string; maj_le: string }>(
      db,
      A,
      `insert into public.notes (titre, contenu) values ('Supervision', '') returning id, maj_le`,
    );
    await une(db, A, `insert into public.notes (client_id, contenu) values ($1, 'À revoir') returning id`, [client]);
    await expect(une(db, A, `insert into public.notes (titre, contenu) values ('  ', '')`)).rejects.toThrow(/check/);
    await new Promise((r) => setTimeout(r, 5));
    const maj = await une<{ maj_le: string }>(
      db,
      A,
      `update public.notes set epinglee = true where id = $1 returning maj_le`,
      [libre.id],
    );
    expect(new Date(maj.maj_le).getTime()).toBeGreaterThan(new Date(libre.maj_le).getTime());
  });

  it('cloisonnement : un autre thérapeute ne voit rien et ne rattache rien au client d’autrui', async () => {
    const vues = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.journal`));
    expect(vues.rows).toEqual([]);
    await expect(
      une(db, B, `insert into public.notes (client_id, contenu) values ($1, 'x')`, [client]),
    ).rejects.toThrow();
    await expect(
      une(db, B, `insert into public.notes (therapeute_id, contenu) values ($1, 'x')`, [A]),
    ).rejects.toThrow();
    const maj = await commeUtilisateur(db, B, (tx) => tx.query(`update public.notes set titre = 'pirate'`));
    expect(maj.affectedRows).toBe(0);
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.journal`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('les notes d’un client à la corbeille disparaissent du journal', async () => {
    const autre = await creerClient(db, A, 'Jete');
    await une(db, A, `insert into public.notes (client_id, contenu) values ($1, 'note du client jeté')`, [autre]);
    await corbeille(db, A, autre);
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ contenu: string }>(`select contenu from public.journal`),
    );
    expect(r.rows.map((x) => x.contenu)).not.toContain('note du client jeté');
    expect(r.rows).toHaveLength(2);
  });
});

describe('exercices et documents remis', () => {
  let db: PGlite;
  let client: string;
  let document: string;
  let jeton: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A, 'Camille', 'Laurent');
    await creerCompte(db, B);
    client = await creerClient(db, A);
    document = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.documents (titre, categorie, contenu) values ('Respiration carrée', 'exercice', '# Comment\n- Inspirez') returning id`,
      )
    ).id;
  });

  it('bibliothèque : titre obligatoire, catégorie connue, privée', async () => {
    await expect(une(db, A, `insert into public.documents (titre) values ('')`)).rejects.toThrow(/check/);
    await expect(une(db, A, `insert into public.documents (titre, categorie) values ('X', 'video')`)).rejects.toThrow(
      /check/,
    );
    const b = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.documents`));
    expect(b.rows).toEqual([]);
  });

  it('remise par lien : jeton de 256 bits, seule l’empreinte est stockée ; copie figée du document', async () => {
    const r = await une<{ r: { id: string; jeton: string; expire_le: string } }>(
      db,
      A,
      `select public.preparer_remise($1, $2, 'lien') as r`,
      [document, client],
    );
    jeton = r.r.jeton;
    expect(jeton).toMatch(/^[0-9a-f]{64}$/);
    const stocke = await db.query<{ jeton_hash: string; contenu: string }>(
      `select jeton_hash, contenu from public.remises where id = $1`,
      [r.r.id],
    );
    expect(stocke.rows[0].jeton_hash).toBe(await empreinteJeton(jeton));
    expect(stocke.rows[0].contenu).toBe('# Comment\n- Inspirez');
    // le thérapeute modifie ensuite le document : le client garde sa version
    await une(db, A, `update public.documents set contenu = 'nouvelle version' where id = $1 returning id`, [document]);
    const pub = await une<{ d: { valide: boolean; titre: string; contenu: string; therapeute: string } }>(
      db,
      null,
      `select public.document_public($1) as d`,
      [jeton],
    );
    expect(pub.d).toMatchObject({
      valide: true,
      titre: 'Respiration carrée',
      contenu: '# Comment\n- Inspirez',
      therapeute: 'Camille Laurent',
    });
    // la première ouverture est notée (le thérapeute le voit dans la liste)
    const vue = await une<{ ouvert_le: string | null }>(db, A, `select ouvert_le from public.remises_actives`);
    expect(vue.ouvert_le).not.toBeNull();
  });

  it('remise imprimée : pas de lien ; mode inconnu refusé', async () => {
    const r = await une<{ r: { jeton: string | null } }>(
      db,
      A,
      `select public.preparer_remise($1, $2, 'imprime') as r`,
      [document, client],
    );
    expect(r.r.jeton).toBeNull();
    await expect(une(db, A, `select public.preparer_remise($1, $2, 'fax')`, [document, client])).rejects.toThrow(
      /inconnu/,
    );
  });

  it('cloisonnement : ni document ni client d’autrui ; pas d’écriture directe', async () => {
    await expect(une(db, B, `select public.preparer_remise($1, $2, 'lien')`, [document, client])).rejects.toThrow(
      /introuvable/,
    );
    const docB = (
      await une<{ id: string }>(db, B, `insert into public.documents (titre) values ('Fiche B') returning id`)
    ).id;
    await expect(une(db, B, `select public.preparer_remise($1, $2, 'lien')`, [docB, client])).rejects.toThrow(
      /introuvable/,
    );
    await expect(
      une(db, A, `insert into public.remises (client_id, mode, titre, contenu) values ($1, 'imprime', 'x', 'y')`, [
        client,
      ]),
    ).rejects.toThrow(/permission denied/);
    const vues = await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.remises_actives`));
    expect(vues.rows).toEqual([]);
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.remises`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(une(db, null, `select public.preparer_remise($1, $2, 'lien')`, [document, client])).rejects.toThrow(
      /permission denied/,
    );
  });

  it('lien inconnu, expiré, ou client à la corbeille : rien n’est montré', async () => {
    const inconnu = await une<{ d: { valide: boolean; raison: string } }>(
      db,
      null,
      `select public.document_public('0000') as d`,
    );
    expect(inconnu.d).toEqual({ valide: false, raison: 'inconnu' });
    await db.query(`update public.remises set expire_le = now() - interval '1 day' where jeton_hash = $1`, [
      await empreinteJeton(jeton),
    ]);
    const expire = await une<{ d: { valide: boolean; raison: string; contenu?: string } }>(
      db,
      null,
      `select public.document_public($1) as d`,
      [jeton],
    );
    expect(expire.d.raison).toBe('expire');
    expect(expire.d.contenu).toBeUndefined();
    await db.query(`update public.remises set expire_le = now() + interval '1 day' where jeton_hash = $1`, [
      await empreinteJeton(jeton),
    ]);
    await corbeille(db, A, client);
    const jete = await une<{ d: { raison: string } }>(db, null, `select public.document_public($1) as d`, [jeton]);
    expect(jete.d.raison).toBe('inconnu');
    expect((await commeUtilisateur(db, A, (tx) => tx.query(`select * from public.remises_actives`))).rows).toEqual([]);
    await expect(une(db, A, `select public.preparer_remise($1, $2, 'lien')`, [document, client])).rejects.toThrow(
      /introuvable/,
    );
  });
});

describe('reçus (notes d’honoraires)', () => {
  let db: PGlite;
  let client: string;
  const seances: string[] = [];
  const emettre = (uid: string, seance: string, date = new Date().toISOString().slice(0, 10), mode = 'virement') =>
    une<{ r: { id: string; annee: number; numero: number; montant: string; emetteur: Record<string, string> } }>(
      db,
      uid,
      `select to_jsonb(public.emettre_recu($1, $2, $3::date)) as r`,
      [seance, mode, date],
    ).then((x) => x.r);

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A, 'Camille', 'Laurent');
    await creerCompte(db, B);
    client = await creerClient(db, A);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(
        `update public.parametres set prix_defaut = 60, adresse_pro = '12 rue des Lilas', siret = '000 000 000 00000'`,
      ),
    );
    for (let i = 0; i < 4; i++)
      seances.push(
        (
          await une<{ id: string }>(
            db,
            A,
            `insert into public.seances (client_id, date_seance) values ($1, current_date - 30 + $2::int) returning id`,
            [client, i],
          )
        ).id,
      );
  });

  it('numérotation continue par année, coordonnées recopiées au moment de l’émission', async () => {
    const r1 = await emettre(A, seances[0]);
    const r2 = await emettre(A, seances[1], undefined, 'cheque');
    expect([r1.numero, r2.numero]).toEqual([1, 2]);
    expect(Number(r1.montant)).toBe(60);
    expect(r1.emetteur).toMatchObject({
      nom: 'Camille Laurent',
      adresse: '12 rue des Lilas',
      siret: '000 000 000 00000',
    });
    // changer d'adresse ensuite ne modifie pas les reçus émis
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set adresse_pro = 'Nouvelle adresse'`));
    const relu = await une<{ adresse: string }>(
      db,
      A,
      `select emetteur ->> 'adresse' as adresse from public.recus where id = $1`,
      [r1.id],
    );
    expect(relu.adresse).toBe('12 rue des Lilas');
  });

  it('un seul reçu valide par séance ; dates contrôlées ; tarif requis', async () => {
    await expect(emettre(A, seances[0])).rejects.toThrow(/déjà été émis/);
    await expect(emettre(A, seances[2], '2000-01-01')).rejects.toThrow(/date du reçu/);
    await expect(emettre(A, seances[2], '2999-01-01')).rejects.toThrow(/date du reçu/);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.seances set prix = null where id = $1`, [seances[3]]),
    );
    await expect(emettre(A, seances[3])).rejects.toThrow(/tarif/);
  });

  it('un reçu ne se modifie ni ne s’efface : il s’annule, avec un motif, et son numéro n’est pas réutilisé', async () => {
    const [r1] = (
      await commeUtilisateur(db, A, (tx) => tx.query<{ id: string }>(`select id from public.recus where numero = 1`))
    ).rows;
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.recus set montant = 0 where id = $1`, [r1.id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`delete from public.recus where id = $1`, [r1.id])),
    ).rejects.toThrow(/permission denied/);
    await expect(une(db, A, `select public.annuler_recu($1, '  ')`, [r1.id])).rejects.toThrow(/motif/);
    await une(db, A, `select public.annuler_recu($1, 'Erreur de mode de règlement')`, [r1.id]);
    await expect(une(db, A, `select public.annuler_recu($1, 'encore')`, [r1.id])).rejects.toThrow(/déjà annulé/);
    // la séance peut recevoir un nouveau reçu, avec le numéro suivant
    const r3 = await emettre(A, seances[0]);
    expect(r3.numero).toBe(3);
    const tous = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ numero: number; annule: boolean }>(
        `select numero, annule_le is not null as annule from public.recus order by numero`,
      ),
    );
    expect(tous.rows).toEqual([
      { numero: 1, annule: true },
      { numero: 2, annule: false },
      { numero: 3, annule: false },
    ]);
  });

  it('une nouvelle année repart de 1', async () => {
    const annee = new Date().getFullYear();
    // séance datée de l'an dernier, reçu émis à la date de la séance
    const s = (
      await une<{ id: string; date_seance: string }>(
        db,
        A,
        `insert into public.seances (client_id, date_seance) values ($1, make_date($2, 12, 30)) returning id, date_seance`,
        [client, annee - 1],
      )
    ).id;
    const r = await emettre(A, s, `${annee - 1}-12-30`);
    expect([r.annee, r.numero]).toEqual([annee - 1, 1]);
  });

  it('cloisonnement et corbeille', async () => {
    await expect(emettre(B, seances[2])).rejects.toThrow(/introuvable/);
    expect((await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.recus`))).rows).toEqual([]);
    const [r] = (await commeUtilisateur(db, A, (tx) => tx.query<{ id: string }>(`select id from public.recus limit 1`)))
      .rows;
    await expect(une(db, B, `select public.annuler_recu($1, 'x')`, [r.id])).rejects.toThrow(/introuvable/);
    await expect(une(db, null, `select public.emettre_recu($1, 'cheque', current_date)`, [seances[2]])).rejects.toThrow(
      /permission denied/,
    );
    await corbeille(db, A, client);
    await expect(emettre(A, seances[2])).rejects.toThrow(/introuvable/);
  });

  it('les reçus survivent à l’effacement définitif du client (pièces comptables)', async () => {
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.clients where id = $1`, [client]));
    const r = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ client_id: string | null; seance_id: string | null; client_nom: string }>(
        `select client_id, seance_id, client_nom from public.recus`,
      ),
    );
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.client_id === null && x.seance_id === null && x.client_nom === 'Alice Durand')).toBe(
      true,
    );
  });
});

describe('tâches personnelles et « plus tard »', () => {
  let db: PGlite;
  let client: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
  });

  it('tâches libres ou liées à un client, privées ; masquées si le client est à la corbeille', async () => {
    await une(
      db,
      A,
      `insert into public.taches_perso (titre, echeance) values ('Commander des carnets', current_date)`,
    );
    await une(db, A, `insert into public.taches_perso (titre, client_id) values ('Rappeler', $1)`, [client]);
    await expect(une(db, A, `insert into public.taches_perso (titre) values (' ')`)).rejects.toThrow(/check/);
    await expect(
      une(db, B, `insert into public.taches_perso (titre, client_id) values ('x', $1)`, [client]),
    ).rejects.toThrow();
    expect((await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.mes_taches`))).rows).toEqual([]);
    await corbeille(db, A, client);
    const r = await commeUtilisateur(db, A, (tx) => tx.query<{ titre: string }>(`select titre from public.mes_taches`));
    expect(r.rows.map((x) => x.titre)).toEqual(['Commander des carnets']);
  });

  it('report d’une tâche calculée : une ligne par clé, remplacée au besoin', async () => {
    const reporter = (uid: string, cle: string, jour: string) =>
      commeUtilisateur(db, uid, (tx) =>
        tx.query(
          `insert into public.reports_taches (cle, jusqua) values ($1, $2::date)
           on conflict (therapeute_id, cle) do update set jusqua = excluded.jusqua`,
          [cle, jour],
        ),
      );
    await reporter(A, 'r-c1-1', '2026-10-10');
    await reporter(A, 'r-c1-1', '2026-10-12');
    await reporter(B, 'r-c1-1', '2026-11-01'); // même clé, autre thérapeute : indépendant
    const a = await commeUtilisateur(db, A, (tx) =>
      tx.query<{ cle: string; jusqua: string }>(`select cle, jusqua::text from public.reports_taches`),
    );
    expect(a.rows).toEqual([{ cle: 'r-c1-1', jusqua: '2026-10-12' }]);
    await expect(commeUtilisateur(db, null, (tx) => tx.query(`select * from public.reports_taches`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('double authentification sur les nouvelles tables', () => {
  it('une fois activée, rien n’est lisible sans session validée par code', async () => {
    const db = await baseSupabase();
    await creerCompte(db, A);
    await une(db, A, `insert into public.notes (titre) values ('Note')`);
    await db.query(`insert into auth.mfa_factors (user_id) values ($1)`, [A]);
    for (const vue of ['journal', 'documents', 'remises_actives', 'recus', 'mes_taches', 'reports_taches']) {
      const r = await commeUtilisateur(db, A, (tx) => tx.query(`select * from public.${vue}`));
      expect(r.rows, vue).toEqual([]);
    }
    const ok = await commeUtilisateur(db, A, (tx) => tx.query(`select * from public.journal`), 'aal2');
    expect(ok.rows).toHaveLength(1);
    const politiques = await db.query<{ tablename: string }>(
      `select tablename from pg_policies
       where schemaname = 'public' and policyname = 'double authentification' and permissive = 'RESTRICTIVE'
         and tablename in ('notes', 'documents', 'remises', 'recus', 'taches_perso', 'reports_taches')
       order by tablename`,
    );
    expect(politiques.rows.map((x) => x.tablename)).toEqual([
      'documents',
      'notes',
      'recus',
      'remises',
      'reports_taches',
      'taches_perso',
    ]);
  });
});

// Migration 0.9.0 : rappel d'un exercice non rendu, reçus groupés (lignes
// de reçu, une séance sur un seul reçu valide).

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { baseSupabase, commeUtilisateur, creerCompte } from './supabaseLocal';

const A = '0000000a-0000-4000-8000-000000000001';
const B = '0000000b-0000-4000-8000-000000000002';

const une = async <T>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) =>
  (await commeUtilisateur(db, uid, (tx) => tx.query<T>(sql, params))).rows[0];
const toutes = async <T>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) =>
  (await commeUtilisateur(db, uid, (tx) => tx.query<T>(sql, params))).rows;
async function creerClient(db: PGlite, uid: string, nom = 'Durand') {
  return (
    await une<{ id: string }>(
      db,
      uid,
      `insert into public.clients (nom, prenom, annee_naissance) values ($1, 'Alice', 1985) returning id`,
      [nom],
    )
  ).id;
}
const corbeille = (db: PGlite, uid: string, client: string, oui = true) =>
  commeUtilisateur(db, uid, (tx) =>
    tx.query(`update public.clients set supprime_le = ${oui ? 'now()' : 'null'} where id = $1`, [client]),
  );

describe('rappel d’un exercice non rendu', () => {
  let db: PGlite;
  let client: string;
  let exercice: string;
  let simple: string;
  const remettre = async (document: string, mode = 'lien') =>
    (
      await une<{ r: { id: string; jeton: string | null } }>(db, A, `select public.preparer_remise($1, $2, $3) as r`, [
        document,
        client,
        mode,
      ])
    ).r;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
    exercice = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.documents (titre, contenu) values ('Journal', $1) returning id`,
        ['? Une\n? Deux'],
      )
    ).id;
    simple = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.documents (titre, contenu) values ('Fiche', 'Texte') returning id`,
      )
    ).id;
  });

  it('nombre de questions calculé à la remise ; délai de rappel réglable (7 jours par défaut)', async () => {
    const r1 = await remettre(exercice);
    const r2 = await remettre(simple);
    const lu = await toutes<{ id: string; nb_questions: number }>(
      db,
      A,
      `select id, nb_questions from public.remises_actives`,
    );
    expect(lu.find((x) => x.id === r1.id)?.nb_questions).toBe(2);
    expect(lu.find((x) => x.id === r2.id)?.nb_questions).toBe(0);
    // la colonne calculée n'empêche pas le thérapeute de marquer une remise comme lue
    await une(db, A, `update public.remises set consulte_le = now() where id = $1 returning id`, [r2.id]);
    expect((await une<{ j: number }>(db, A, `select exercice_rappel_jours as j from public.parametres`)).j).toBe(7);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set exercice_rappel_jours = 61`)),
    ).rejects.toThrow(/check/);
  });

  it('un nouveau lien remplace l’ancien et le rappel est noté', async () => {
    const r = await remettre(exercice);
    const nouveau = await une<{ l: { jeton: string; expire_le: string } }>(
      db,
      A,
      `select public.relancer_remise($1) as l`,
      [r.id],
    );
    expect(nouveau.l.jeton).toMatch(/^[0-9a-f]{64}$/);
    const ancien = await une<{ d: { raison: string } }>(db, null, `select public.document_public($1) as d`, [r.jeton]);
    expect(ancien.d.raison).toBe('inconnu');
    const ouvert = await une<{ d: { valide: boolean } }>(db, null, `select public.document_public($1) as d`, [
      nouveau.l.jeton,
    ]);
    expect(ouvert.d.valide).toBe(true);
    const lu = await une<{ rappel_le: string | null }>(
      db,
      A,
      `select rappel_le from public.remises_actives where id = $1`,
      [r.id],
    );
    expect(lu.rappel_le).not.toBeNull();
    // le client répond avec le nouveau lien ; plus de rappel possible ensuite
    await une(db, null, `select public.repondre_document($1, '["oui", ""]')`, [nouveau.l.jeton]);
    await expect(une(db, A, `select public.relancer_remise($1)`, [r.id])).rejects.toThrow(/déjà répondu/);
  });

  it('refusé pour un document remis sur papier, un client à la corbeille, un confrère ou un anonyme', async () => {
    const papier = await remettre(exercice, 'imprime');
    await expect(une(db, A, `select public.relancer_remise($1)`, [papier.id])).rejects.toThrow(/sur papier/);
    const r = await remettre(exercice);
    await expect(une(db, B, `select public.relancer_remise($1)`, [r.id])).rejects.toThrow(/introuvable/);
    await expect(une(db, null, `select public.relancer_remise($1)`, [r.id])).rejects.toThrow(/permission denied/);
    await corbeille(db, A, client);
    await expect(une(db, A, `select public.relancer_remise($1)`, [r.id])).rejects.toThrow(/Client introuvable/);
    await corbeille(db, A, client, false);
  });
});

describe('reçus groupés', () => {
  let db: PGlite;
  let client: string;
  let autre: string;
  const seances: string[] = [];
  const jour = (n: number) => `current_date - ${40 - n}`;
  const groupe = (uid: string, ids: string[], date = 'current_date') =>
    une<{ r: { id: string; numero: number; montant: string; seance_id: string | null; prestation: string } }>(
      db,
      uid,
      `select to_jsonb(public.emettre_recu_groupe($1::uuid[], 'cheque', ${date})) as r`,
      [ids],
    ).then((x) => x.r);
  const seul = (uid: string, id: string) =>
    une<{ r: { id: string; numero: number } }>(
      db,
      uid,
      `select to_jsonb(public.emettre_recu($1, 'virement', current_date)) as r`,
      [id],
    ).then((x) => x.r);
  const lignes = (recu: string) =>
    toutes<{ seance_id: string; montant: string; ordre: number; annule: boolean }>(
      db,
      A,
      `select seance_id, montant, ordre, annule from public.recus_lignes where recu_id = $1 order by ordre`,
      [recu],
    );

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
    autre = await creerClient(db, A, 'Autre');
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set prix_defaut = 60`));
    // séances créées dans l'ordre, la 3e à un autre tarif
    for (let i = 0; i < 5; i++)
      seances.push(
        (
          await une<{ id: string }>(
            db,
            A,
            `insert into public.seances (client_id, date_seance) values ($1, ${jour(i * 7)}) returning id`,
            [client],
          )
        ).id,
      );
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.seances set prix = 75 where id = $1`, [seances[2]]));
  });

  it('un reçu, plusieurs lignes dans l’ordre des dates, total et numérotation continue', async () => {
    const r1 = await seul(A, seances[0]);
    expect(await lignes(r1.id)).toMatchObject([{ seance_id: seances[0], ordre: 1, annule: false }]);
    const r2 = await groupe(A, [seances[2], seances[1]]);
    expect(r2.numero).toBe(r1.numero + 1);
    expect(r2.seance_id).toBeNull();
    expect(Number(r2.montant)).toBe(135);
    expect(r2.prestation).toBe("Séances d'accompagnement comportemental et émotionnel (2)");
    expect((await lignes(r2.id)).map((l) => [l.seance_id, Number(l.montant), l.ordre])).toEqual([
      [seances[1], 60, 1],
      [seances[2], 75, 2],
    ]);
  });

  it('une séance ne figure que sur un seul reçu valide, seul ou groupé', async () => {
    await expect(groupe(A, [seances[0], seances[3]])).rejects.toThrow(/l'une de ces séances/);
    await expect(seul(A, seances[1])).rejects.toThrow(/déjà été émis/);
  });

  it('règles : au moins 2 séances, un seul client, tarif connu, date après la dernière séance', async () => {
    await expect(groupe(A, [seances[3]])).rejects.toThrow(/de 2 à 31 séances/);
    await expect(groupe(A, [seances[3], seances[3]])).rejects.toThrow(/de 2 à 31 séances/);
    const s = (
      await une<{ id: string }>(db, A, `insert into public.seances (client_id) values ($1) returning id`, [autre])
    ).id;
    await expect(groupe(A, [seances[3], s])).rejects.toThrow(/un seul client/);
    await expect(groupe(A, [seances[3], seances[4]], 'current_date - 30')).rejects.toThrow(/dernière séance/);
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.seances set prix = null where id = $1`, [seances[4]]),
    );
    await expect(groupe(A, [seances[3], seances[4]])).rejects.toThrow(/tarif/);
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.seances set prix = 60 where id = $1`, [seances[4]]));
  });

  it('annuler un reçu groupé libère ses séances', async () => {
    const [r2] = await toutes<{ id: string }>(db, A, `select id from public.recus where seance_id is null`);
    await une(db, A, `select public.annuler_recu($1, 'Regrouper autrement')`, [r2.id]);
    expect((await lignes(r2.id)).every((l) => l.annule)).toBe(true);
    const r3 = await groupe(A, [seances[1], seances[2], seances[3]]);
    expect(await lignes(r3.id)).toHaveLength(3);
  });

  it('lignes en lecture seule, privées ; la page du client les affiche', async () => {
    const [r] = await toutes<{ id: string }>(
      db,
      A,
      `select id from public.recus where seance_id is null and annule_le is null`,
    );
    await expect(
      commeUtilisateur(db, A, (tx) =>
        tx.query(
          `insert into public.recus_lignes (recu_id, therapeute_id, date_seance, prestation, montant, ordre)
           values ($1, $2, current_date, 'x', 1, 9)`,
          [r.id, A],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.recus_lignes set montant = 0`)),
    ).rejects.toThrow(/permission denied/);
    expect(await toutes(db, B, `select * from public.recus_lignes`)).toEqual([]);
    const lien = await une<{ l: { jeton: string } }>(db, A, `select public.preparer_lien_recu($1) as l`, [r.id]);
    const pub = await une<{ r: { recu: { lignes: { prestation: string }[] } } }>(
      db,
      null,
      `select public.recu_public($1) as r`,
      [lien.l.jeton],
    );
    expect(pub.r.recu.lignes).toHaveLength(3);
    expect(pub.r.recu.lignes[0].prestation).toMatch(/^Séance d'accompagnement comportemental et émotionnel n° \d$/);
    await expect(groupe(B, [seances[4], seances[0]])).rejects.toThrow(/introuvable/);
  });
});

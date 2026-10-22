// RGPD (0.13.0) : consentement du client (migration `rgpd`) — droits d'écriture, vue
// clients_resume, cloisonnement ; effacement en cascade de tout le parcours.

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { baseSupabase, commeUtilisateur, creerCompte } from './supabaseLocal';

const A = '0000000a-0000-4000-8000-000000000301';
const B = '0000000b-0000-4000-8000-000000000302';

async function une<T>(db: PGlite, uid: string, sql: string, params: unknown[] = []) {
  return commeUtilisateur(db, uid, async (tx) => (await tx.query<T>(sql, params)).rows[0]);
}

describe('RGPD : consentement du client', () => {
  let db: PGlite;
  let client: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.clients (nom, prenom, annee_naissance) values ('Durand', 'Alice', 1985) returning id`,
      )
    ).id;
  });

  it('pas noté à la création, puis noté par le thérapeute, et visible dans clients_resume', async () => {
    const avant = await une<{ consentement_le: string | null }>(
      db,
      A,
      `select consentement_le from public.clients_resume where id = $1`,
      [client],
    );
    expect(avant.consentement_le).toBeNull();
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set consentement_le = '2026-10-22' where id = $1`, [client]),
    );
    const apres = await une<{ consentement_le: string }>(
      db,
      A,
      `select consentement_le::text from public.clients_resume where id = $1`,
      [client],
    );
    expect(apres.consentement_le).toBe('2026-10-22');
  });

  it('peut être noté dès la création de la fiche', async () => {
    const r = await une<{ consentement_le: string }>(
      db,
      A,
      `insert into public.clients (nom, prenom, annee_naissance, consentement_le)
       values ('Martin', 'Léa', 1990, '2026-10-01') returning consentement_le::text`,
    );
    expect(r.consentement_le).toBe('2026-10-01');
  });

  it('un autre thérapeute ne peut ni le lire ni le modifier ; un anonyme non plus', async () => {
    const lu = await commeUtilisateur(db, B, (tx) =>
      tx.query(`select consentement_le from public.clients where id = $1`, [client]),
    );
    expect(lu.rows).toEqual([]);
    const maj = await commeUtilisateur(db, B, (tx) =>
      tx.query(`update public.clients set consentement_le = null where id = $1`, [client]),
    );
    expect(maj.affectedRows).toBe(0);
    await expect(
      commeUtilisateur(db, null, (tx) => tx.query(`update public.clients set consentement_le = null`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("droit à l'effacement : supprimer la fiche efface tout son parcours", async () => {
    const id = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.clients (nom, prenom, annee_naissance) values ('Effacé', 'Paul', 1980) returning id`,
      )
    ).id;
    await commeUtilisateur(db, A, (tx) => tx.query(`insert into public.seances (client_id) values ($1)`, [id]));
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.clients where id = $1`, [id]));
    const reste = await db.query<{ n: number }>(`select count(*)::int as n from public.seances where client_id = $1`, [
      id,
    ]);
    expect(reste.rows[0].n).toBe(0);
  });
});

describe('RGPD : journal des connexions gardé 12 mois', () => {
  it('efface les connexions de plus de 12 mois, seulement les siennes', async () => {
    const db = await baseSupabase();
    const C = '0000000c-0000-4000-8000-000000000303';
    const D = '0000000d-0000-4000-8000-000000000304';
    await creerCompte(db, C);
    await creerCompte(db, D);
    await db.query(
      `insert into public.journal_connexions (therapeute_id, le, appareil) values
         ($1, now() - interval '13 months', 'vieux'), ($1, now() - interval '11 months', 'récent'),
         ($2, now() - interval '13 months', 'autre compte')`,
      [C, D],
    );
    const n = await une<{ purger_journal_connexions: number }>(db, C, `select public.purger_journal_connexions()`);
    expect(n.purger_journal_connexions).toBe(1);
    const reste = await db.query<{ appareil: string }>(
      `select appareil from public.journal_connexions where appareil in ('vieux', 'récent', 'autre compte') order by appareil`,
    );
    expect(reste.rows.map((r) => r.appareil)).toEqual(['autre compte', 'récent']);
    // le journal n'est pas effaçable directement par le thérapeute, ni la fonction par un anonyme
    const direct = await commeUtilisateur(db, C, (tx) =>
      tx.query(`delete from public.journal_connexions`).catch((e: Error) => e.message),
    );
    expect(String(direct)).toMatch(/permission denied/);
    await expect(
      commeUtilisateur(db, null, (tx) => tx.query(`select public.purger_journal_connexions()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

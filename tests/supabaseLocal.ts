// Postgres en mémoire (PGlite) habillé comme Supabase : rôles anon /
// authenticated, schéma auth, auth.uid() lu dans les « claims » JWT, et
// les privilèges par défaut que Supabase accorde sur le schéma public.

import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(import.meta.dirname, '..', 'supabase', 'migrations');

const HABILLAGE_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated to postgres;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
  $$;
  grant execute on function auth.jwt() to anon, authenticated;
  create table auth.mfa_factors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    status text not null default 'verified'
  );

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

// Initialiser Postgres en WebAssembly est lent : on construit la base
// migrée une seule fois, puis chaque suite repart d'une copie.
let modele: Promise<File | Blob> | null = null;

export async function baseSupabase() {
  modele ??= (async () => {
    const db = await PGlite.create();
    await db.exec(HABILLAGE_SUPABASE);
    for (const fichier of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(join(MIGRATIONS, fichier), 'utf8'));
    }
    const copie = await db.dumpDataDir('none');
    await db.close();
    return copie;
  })();
  return PGlite.create({ loadDataDir: await modele });
}

/**
 * Exécute `fn` comme le ferait PostgREST pour un utilisateur connecté (ou
 * anonyme). `aal` : niveau d'authentification de la session (aal2 = code
 * de double authentification validé).
 */
export async function commeUtilisateur<T>(
  db: PGlite,
  uid: string | null,
  fn: (tx: Transaction) => Promise<T>,
  aal: 'aal1' | 'aal2' = 'aal1',
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(uid ? { sub: uid, role: 'authenticated', aal } : { role: 'anon' }),
    ]);
    return fn(tx);
  });
}

export async function creerCompte(db: PGlite, id: string, prenom = 'Test', nom = 'Thérapeute') {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id}@exemple.fr`,
    JSON.stringify({ prenom, nom }),
  ]);
}

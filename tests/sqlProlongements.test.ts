// Migration 0.8.0 : reçu par lien, exercices à compléter, tâches
// récurrentes. Les règles existant aussi en TypeScript sont comparées
// cas par cas (questions d'un document, prochaine échéance).

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { empreinteJeton } from '../src/domaine/securite';
import { echeanceSuivante } from '../src/domaine/taches';
import { questionsDocument } from '../src/domaine/texte';
import type { Recurrence } from '../src/domaine/types';
import { baseSupabase, commeUtilisateur, creerCompte } from './supabaseLocal';

const A = '0000000a-0000-4000-8000-000000000001';
const B = '0000000b-0000-4000-8000-000000000002';

const une = async <T>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) =>
  (await commeUtilisateur(db, uid, (tx) => tx.query<T>(sql, params))).rows[0];
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
const corbeille = (db: PGlite, uid: string, client: string) =>
  commeUtilisateur(db, uid, (tx) => tx.query(`update public.clients set supprime_le = now() where id = $1`, [client]));

describe('parité SQL ↔ TypeScript', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseSupabase();
  });

  it('questions d’un document : public.questions_document = questionsDocument', async () => {
    const cas = [
      '',
      'Sans question.',
      '? Une\n? Deux',
      '# Titre\r\n? Avec CRLF\r\n\r\n- ? dans une liste\n?Sans espace\n?\n  ?   Indentée  \n?\tTabulation\n\t? Tab devant',
      '?  Espaces multiples  ?  ',
    ];
    for (const contenu of cas) {
      const r = await db.query<{ q: string[] }>(`select public.questions_document($1) as q`, [contenu]);
      expect(r.rows[0].q, JSON.stringify(contenu)).toEqual(questionsDocument(contenu));
    }
  });

  it('prochaine échéance : public.echeance_suivante = echeanceSuivante', async () => {
    const cas: [string | null, Recurrence, string][] = [
      ['2026-10-05', 'semaine', '2026-10-05'],
      ['2026-09-14', 'semaine', '2026-10-05'],
      ['2026-01-31', 'mois', '2026-01-31'],
      ['2026-01-31', 'mois', '2026-02-28'],
      ['2028-01-31', 'mois', '2028-02-01'],
      ['2026-12-15', 'mois', '2027-01-20'],
      [null, 'mois', '2026-10-05'],
      [null, 'semaine', '2026-12-29'],
      ['2026-10-05', 'aucune', '2026-10-05'],
    ];
    for (const [echeance, recurrence, jour] of cas) {
      const r = await db.query<{ d: string | null }>(
        `select public.echeance_suivante($1::date, $2, $3::date)::text as d`,
        [echeance, recurrence, jour],
      );
      expect(r.rows[0].d, `${echeance} ${recurrence} ${jour}`).toBe(echeanceSuivante(echeance, recurrence, jour));
    }
  });
});

describe('reçu envoyé par lien personnel', () => {
  let db: PGlite;
  let client: string;
  let recu: string;
  let jeton: string;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A, 'Camille', 'Laurent');
    await creerCompte(db, B);
    client = await creerClient(db, A);
    await commeUtilisateur(db, A, (tx) => tx.query(`update public.parametres set prix_defaut = 60`));
    const s = await une<{ id: string }>(db, A, `insert into public.seances (client_id) values ($1) returning id`, [
      client,
    ]);
    recu = (
      await une<{ r: { id: string } }>(db, A, `select to_jsonb(public.emettre_recu($1, 'cheque', current_date)) as r`, [
        s.id,
      ])
    ).r.id;
  });

  it('jeton de 256 bits, seule l’empreinte est stockée ; le client lit son reçu sans compte', async () => {
    const r = await une<{ l: { jeton: string; expire_le: string } }>(
      db,
      A,
      `select public.preparer_lien_recu($1) as l`,
      [recu],
    );
    jeton = r.l.jeton;
    expect(jeton).toMatch(/^[0-9a-f]{64}$/);
    const stocke = await db.query<{ jeton_hash: string }>(`select jeton_hash from public.recus where id = $1`, [recu]);
    expect(stocke.rows[0].jeton_hash).toBe(await empreinteJeton(jeton));
    const pub = await une<{ r: { valide: boolean; recu: Record<string, unknown> } }>(
      db,
      null,
      `select public.recu_public($1) as r`,
      [jeton],
    );
    expect(pub.r.valide).toBe(true);
    expect(pub.r.recu).toMatchObject({ annee: new Date().getFullYear(), numero: 1, client_nom: 'Alice Durand' });
    expect(Number(pub.r.recu.montant)).toBe(60);
    // rien d'autre de la base : ni identifiants, ni empreinte
    expect(Object.keys(pub.r.recu)).not.toContain('client_id');
    expect(Object.keys(pub.r.recu)).not.toContain('jeton_hash');
    const ouvert = await une<{ lien_ouvert_le: string | null }>(db, A, `select lien_ouvert_le from public.recus`);
    expect(ouvert.lien_ouvert_le).not.toBeNull();
  });

  it('un nouveau lien remplace l’ancien ; expiré ou client à la corbeille : rien n’est montré', async () => {
    const nouveau = (await une<{ l: { jeton: string } }>(db, A, `select public.preparer_lien_recu($1) as l`, [recu])).l
      .jeton;
    const ancien = await une<{ r: { raison: string } }>(db, null, `select public.recu_public($1) as r`, [jeton]);
    expect(ancien.r.raison).toBe('inconnu');
    jeton = nouveau;
    await db.query(`update public.recus set lien_expire_le = now() - interval '1 day' where id = $1`, [recu]);
    const expire = await une<{ r: { raison: string; recu?: unknown } }>(
      db,
      null,
      `select public.recu_public($1) as r`,
      [jeton],
    );
    expect(expire.r.raison).toBe('expire');
    expect(expire.r.recu).toBeUndefined();
    await db.query(`update public.recus set lien_expire_le = now() + interval '1 day' where id = $1`, [recu]);
  });

  it('cloisonnement : un autre thérapeute ou un anonyme ne crée aucun lien', async () => {
    await expect(une(db, B, `select public.preparer_lien_recu($1)`, [recu])).rejects.toThrow(/introuvable/);
    await expect(une(db, null, `select public.preparer_lien_recu($1)`, [recu])).rejects.toThrow(/permission denied/);
  });

  it('reçu annulé : plus de nouveau lien, et le lien existant montre l’annulation', async () => {
    await une(db, A, `select public.annuler_recu($1, 'Erreur de date')`, [recu]);
    await expect(une(db, A, `select public.preparer_lien_recu($1)`, [recu])).rejects.toThrow(/annulé/);
    const pub = await une<{ r: { recu: { annule_le: string | null; motif_annulation: string } } }>(
      db,
      null,
      `select public.recu_public($1) as r`,
      [jeton],
    );
    expect(pub.r.recu.annule_le).not.toBeNull();
    expect(pub.r.recu.motif_annulation).toBe('Erreur de date');
    await corbeille(db, A, client);
    const jete = await une<{ r: { raison: string } }>(db, null, `select public.recu_public($1) as r`, [jeton]);
    expect(jete.r.raison).toBe('inconnu');
  });
});

describe('exercice à compléter par le client', () => {
  let db: PGlite;
  let client: string;
  let document: string;
  const lien = async (doc = document) =>
    (
      await une<{ r: { id: string; jeton: string } }>(db, A, `select public.preparer_remise($1, $2, 'lien') as r`, [
        doc,
        client,
      ])
    ).r;

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
    client = await creerClient(db, A);
    document = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.documents (titre, contenu) values ('Journal', $1) returning id`,
        ['# Ce soir\n? Quelle émotion ?\n? Où dans le corps ?'],
      )
    ).id;
  });

  it('le client répond une fois ; les questions sont recopiées du document remis', async () => {
    const r = await lien();
    const avant = await une<{ d: { repondu_le: string | null } }>(db, null, `select public.document_public($1) as d`, [
      r.jeton,
    ]);
    expect(avant.d.repondu_le).toBeNull();
    // le thérapeute modifie ensuite le document : les questions restent celles de la copie remise
    await une(db, A, `update public.documents set contenu = '? Autre question' where id = $1 returning id`, [document]);
    await une(db, null, `select public.repondre_document($1, $2)`, [r.jeton, JSON.stringify(['  Colère  ', ''])]);
    const lu = await une<{ reponses: unknown; repondu_le: string; consulte_le: string | null }>(
      db,
      A,
      `select reponses, repondu_le, consulte_le from public.remises_actives where id = $1`,
      [r.id],
    );
    expect(lu.reponses).toEqual([
      { question: 'Quelle émotion ?', reponse: 'Colère' },
      { question: 'Où dans le corps ?', reponse: '' },
    ]);
    expect(lu.consulte_le).toBeNull();
    await expect(
      une(db, null, `select public.repondre_document($1, $2)`, [r.jeton, JSON.stringify(['encore', 'x'])]),
    ).rejects.toThrow(/déjà été envoyées/);
    const apres = await une<{ d: { repondu_le: string | null } }>(db, null, `select public.document_public($1) as d`, [
      r.jeton,
    ]);
    expect(apres.d.repondu_le).not.toBeNull();
  });

  it('réponses contrôlées comme dans le navigateur (validerReponsesDocument)', async () => {
    await une(db, A, `update public.documents set contenu = '? A ?\n? B ?' where id = $1 returning id`, [document]);
    const r = await lien();
    const repondre = (reponses: unknown) =>
      une(db, null, `select public.repondre_document($1, $2)`, [r.jeton, JSON.stringify(reponses)]);
    await expect(repondre(['seule'])).rejects.toThrow('Réponses incomplètes.');
    await expect(repondre([1, 'b'])).rejects.toThrow('Réponses incomplètes.');
    await expect(repondre({ a: 1 })).rejects.toThrow('Réponses incomplètes.');
    await expect(repondre([' ', '\n'])).rejects.toThrow('Répondez à au moins une question.');
    await expect(repondre(['x'.repeat(5001), ''])).rejects.toThrow(/trop longue/);
    await expect(une(db, null, `select public.repondre_document('inconnu', '["a","b"]')`)).rejects.toThrow(
      'Lien introuvable.',
    );
    await repondre(['ok', '']);
  });

  it('document sans question, lien expiré, client à la corbeille : refusés', async () => {
    const simple = (
      await une<{ id: string }>(
        db,
        A,
        `insert into public.documents (titre, contenu) values ('Fiche', 'Texte') returning id`,
      )
    ).id;
    const r1 = await lien(simple);
    await expect(une(db, null, `select public.repondre_document($1, '[]')`, [r1.jeton])).rejects.toThrow(
      /n'attend pas de réponse/,
    );
    const r2 = await lien();
    await db.query(`update public.remises set expire_le = now() - interval '1 day' where id = $1`, [r2.id]);
    await expect(une(db, null, `select public.repondre_document($1, '["a","b"]')`, [r2.jeton])).rejects.toThrow(
      /expiré/,
    );
    const r3 = await lien();
    await corbeille(db, A, client);
    await expect(une(db, null, `select public.repondre_document($1, '["a","b"]')`, [r3.jeton])).rejects.toThrow(
      'Lien introuvable.',
    );
    await commeUtilisateur(db, A, (tx) =>
      tx.query(`update public.clients set supprime_le = null where id = $1`, [client]),
    );
  });

  it('le thérapeute marque les réponses comme lues, rien d’autre ; un confrère ne voit rien', async () => {
    const [x] = (
      await commeUtilisateur(db, A, (tx) =>
        tx.query<{ id: string }>(`select id from public.remises_actives where repondu_le is not null limit 1`),
      )
    ).rows;
    const autre = await commeUtilisateur(db, B, (tx) =>
      tx.query(`update public.remises set consulte_le = now() where id = $1`, [x.id]),
    );
    expect(autre.affectedRows).toBe(0);
    await une(db, A, `update public.remises set consulte_le = now() where id = $1 returning id`, [x.id]);
    await expect(
      commeUtilisateur(db, A, (tx) => tx.query(`update public.remises set reponses = '[]' where id = $1`, [x.id])),
    ).rejects.toThrow(/permission denied/);
    expect((await commeUtilisateur(db, B, (tx) => tx.query(`select * from public.remises_actives`))).rows).toEqual([]);
  });
});

describe('tâches personnelles récurrentes', () => {
  let db: PGlite;
  const taches = async (uid = A) =>
    (
      await commeUtilisateur(db, uid, (tx) =>
        tx.query<{ id: string; titre: string; echeance: string | null; faite: boolean; precedente: string | null }>(
          `select id, titre, echeance::text, faite_le is not null as faite, precedente
           from public.mes_taches order by cree_le, echeance nulls first`,
        ),
      )
    ).rows;
  const cocher = (id: string, faite: boolean) =>
    commeUtilisateur(db, A, (tx) =>
      tx.query(
        `update public.taches_perso set faite_le = ${faite ? `'2026-10-05 08:00:00+00'` : 'null'} where id = $1`,
        [id],
      ),
    );

  beforeAll(async () => {
    db = await baseSupabase();
    await creerCompte(db, A);
    await creerCompte(db, B);
  });

  it('cocher crée la suivante, décocher la retire', async () => {
    const t = await une<{ id: string }>(
      db,
      A,
      `insert into public.taches_perso (titre, echeance, recurrence) values ('Comptabilité', '2026-10-05', 'semaine') returning id`,
    );
    await cocher(t.id, true);
    let liste = await taches();
    expect(liste).toHaveLength(2);
    expect(liste[1]).toMatchObject({ titre: 'Comptabilité', echeance: '2026-10-12', faite: false, precedente: t.id });
    await cocher(t.id, false);
    expect(await taches()).toHaveLength(1);
    // cochée de nouveau : une seule suivante
    await cocher(t.id, true);
    liste = await taches();
    expect(liste.filter((x) => x.precedente === t.id)).toHaveLength(1);
  });

  it('une suivante déjà faite reste si l’on décoche la précédente ; supprimer garde la série', async () => {
    const liste = await taches();
    const [premiere, suivante] = [liste.find((x) => !x.precedente)!, liste.find((x) => x.precedente)!];
    await cocher(suivante.id, true); // crée la 3e
    await cocher(premiere.id, false); // la 2e est faite : elle reste
    expect((await taches()).some((x) => x.id === suivante.id)).toBe(true);
    await commeUtilisateur(db, A, (tx) => tx.query(`delete from public.taches_perso where id = $1`, [premiere.id]));
    const [relue] = (await taches()).filter((x) => x.id === suivante.id);
    expect(relue.precedente).toBeNull(); // seule la référence est effacée, pas le propriétaire
  });

  it('sans récurrence : rien de plus ; récurrence inconnue refusée ; privée', async () => {
    const t = await une<{ id: string }>(
      db,
      A,
      `insert into public.taches_perso (titre) values ('Une fois') returning id`,
    );
    const avant = (await taches()).length;
    await cocher(t.id, true);
    expect(await taches()).toHaveLength(avant);
    await expect(
      une(db, A, `insert into public.taches_perso (titre, recurrence) values ('x', 'jour')`),
    ).rejects.toThrow(/check/);
    expect(await taches(B)).toEqual([]);
  });
});

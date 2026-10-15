#!/usr/bin/env node
// Gestion des comptes thérapeutes par l'administrateur de la plateforme.
// L'application n'offre volontairement ni inscription ni « mot de passe
// oublié » : tout passe par ce script, avec la clé « service_role ».
//
//   npm run comptes -- aide
//
// Variables (fichier .env.admin, voir .env.admin.example) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const AIDE = `Comptes thérapeutes — usage : npm run comptes -- <commande>

  lister                                   tous les comptes (adresse, nom, double authentification)
  creer <email> <prénom> <nom>             crée un compte et affiche un mot de passe provisoire
  mot-de-passe <email>                     remplace le mot de passe par un mot de passe provisoire
  retirer-2fa <email>                      supprime la double authentification (téléphone perdu)
  supprimer <email> --confirmer=<email>    supprime le compte ET toutes ses données (irréversible)
  quota-ia [nombre]                        plafond quotidien d'appels Gemini pour TOUTE la plateforme
                                           (sans nombre : affiche le plafond et la consommation du jour)

Le mot de passe provisoire s'affiche une seule fois : transmettez-le de vive voix ou par
un canal sûr, et demandez au thérapeute de le changer (Paramètres > Sécurité).`;

const [commande = 'aide', ...args] = process.argv.slice(2);
if (commande === 'aide' || commande === '--help' || commande === '-h') {
  console.log(AIDE);
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (copier .env.admin.example vers .env.admin).');
  process.exit(1);
}
const db = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = db.auth.admin;

/** 4 groupes de 4 caractères sans ambiguïté (ni 0/O, ni 1/l), lettres et chiffres mêlés. */
function motDePasseProvisoire() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (;;) {
    const groupes = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''),
    );
    const mdp = groupes.join('-');
    if (/\d/.test(mdp) && /[a-z]/.test(mdp)) return mdp;
  }
}

async function tousLesComptes() {
  const comptes = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    comptes.push(...data.users);
    if (data.users.length < 200) return comptes;
  }
}

async function compte(email) {
  if (!email) throw new Error('Adresse électronique manquante.');
  const u = (await tousLesComptes()).find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`Aucun compte pour ${email}.`);
  return u;
}

const verifier = ({ error }) => {
  if (error) throw error;
};

const commandes = {
  async lister() {
    const comptes = await tousLesComptes();
    if (!comptes.length) return console.log('Aucun compte.');
    for (const u of comptes) {
      const m = u.user_metadata ?? {};
      const deuxFacteurs = (u.factors ?? []).some((f) => f.status === 'verified') ? '2FA' : '   ';
      const derniere = u.last_sign_in_at ? `dernière connexion ${u.last_sign_in_at.slice(0, 10)}` : 'jamais connecté';
      console.log(`${u.email}\t${deuxFacteurs}\t${m.prenom ?? ''} ${m.nom ?? ''}\t${derniere}`);
    }
  },

  async creer(email, prenom, ...nom) {
    if (!email || !prenom || !nom.length) throw new Error('Usage : creer <email> <prénom> <nom>');
    const mdp = motDePasseProvisoire();
    verifier(
      await admin.createUser({
        email,
        password: mdp,
        email_confirm: true,
        // lus par le déclencheur creer_profil_therapeute (migration initiale)
        user_metadata: { prenom, nom: nom.join(' ') },
      }),
    );
    console.log(`Compte créé pour ${prenom} ${nom.join(' ')} <${email}>.`);
    console.log(`Mot de passe provisoire : ${mdp}`);
  },

  async 'mot-de-passe'(email) {
    const u = await compte(email);
    const mdp = motDePasseProvisoire();
    verifier(await admin.updateUserById(u.id, { password: mdp }));
    console.log(`Nouveau mot de passe provisoire pour ${email} : ${mdp}`);
  },

  async 'retirer-2fa'(email) {
    const u = await compte(email);
    const { data, error } = await admin.mfa.listFactors({ userId: u.id });
    if (error) throw error;
    for (const f of data.factors) verifier(await admin.mfa.deleteFactor({ userId: u.id, id: f.id }));
    console.log(
      `${data.factors.length} facteur(s) supprimé(s) pour ${email}. Le thérapeute pourra réactiver la double authentification.`,
    );
  },

  async 'quota-ia'(nombre) {
    if (nombre !== undefined) {
      const n = Number(nombre);
      if (!Number.isInteger(n) || n < 0) throw new Error('Le plafond doit être un nombre entier positif ou nul.');
      verifier(await db.from('plateforme').update({ ia_quota_jour_total: n }).eq('id', true));
    }
    const { data: p, error } = await db.from('plateforme').select('ia_quota_jour_total').single();
    if (error) throw error;
    const aujourdhui = new Date().toISOString().slice(0, 10); // la base compte en UTC (current_date)
    const { data: usage, error: e2 } = await db.from('usage_ia').select('nombre').eq('jour', aujourdhui);
    if (e2) throw e2;
    const total = usage.reduce((s, u) => s + u.nombre, 0);
    console.log(
      `Plafond de la plateforme : ${p.ia_quota_jour_total} appels Gemini par jour (utilisés aujourd'hui : ${total}).`,
    );
  },

  async supprimer(email, confirmation) {
    if (confirmation !== `--confirmer=${email}`)
      throw new Error(`Suppression irréversible de toutes les données : relancer avec --confirmer=${email}`);
    const u = await compte(email);
    verifier(await admin.deleteUser(u.id));
    console.log(`Compte ${email} et toutes ses données supprimés.`);
  },
};

const action = commandes[commande];
if (!action) {
  console.error(`Commande inconnue : ${commande}\n`);
  console.log(AIDE);
  process.exit(1);
}
try {
  await action(...args);
} catch (e) {
  console.error(`Erreur : ${e.message ?? e}`);
  process.exit(1);
}

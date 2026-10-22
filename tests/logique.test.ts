// Logique pure du socle (sans base) : relances, rentabilité, messages, date du
// jour, validation des réponses, lecture locale, sécurité, CORS, période des
// statistiques, session, couleurs daltoniennes, emploi du temps.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { entetesCors, originesAutorisees, ORIGINES_DEVELOPPEMENT } from '../supabase/functions/_shared/cors.ts';
import {
  contientDetresse,
  lectureLocale,
  MODELE_LECTURE_LOCALE,
  ReponseInvalide,
  validerReponses,
} from '../supabase/functions/_shared/questionnaire.ts';
import { CATEGORIES, couleursAgenda } from '../src/config/agenda';
import {
  BIBLIOTHEQUE_QUESTIONS,
  PARAMETRES_PAR_DEFAUT,
  QUESTIONNAIRE_PAR_DEFAUT,
} from '../src/config/parametresDefaut';
import {
  categorieSuggeree,
  conflits,
  decalerJour,
  disposer,
  heureDe,
  heureLisible,
  horodatage,
  joursAffiches,
  jourSemaine,
  lundiDe,
} from '../src/domaine/agenda';
import { confusions, contraste, ecart } from '../src/domaine/couleurs';
import { dateDuJour } from '../src/domaine/format';
import { lienSms, masquerLien, remplirModele } from '../src/domaine/messages';
import { calculerRentabilite } from '../src/domaine/rentabilite';
import {
  base32,
  codeTotp,
  decrireAppareil,
  depuisBase32,
  empreinteJeton,
  genererJeton,
  problemeMotDePasse,
  verifierTotp,
} from '../src/domaine/securite';
import { debutPeriode, douzeDerniersMois } from '../src/domaine/statistiques';
import { memoriserSession, stockageSession } from '../src/donnees/memoireSession';
import { activiteExpiree, marquerActivite } from '../src/etat/inactivite';
import { calculerTaches, lireEnvoi, prochaineRelance, resumeDuJour } from '../src/domaine/taches';
import type { ClientResume, Envoi, QuestionEnvoyee, RendezVous, ValeurReponse } from '../src/domaine/types';

const p = { ...PARAMETRES_PAR_DEFAUT }; // 15 j, puis tous les 30 j, 3 relances au plus

const client = (champs: Partial<ClientResume> = {}): ClientResume => ({
  id: 'c1',
  nom: 'Martin',
  prenom: 'Léa',
  annee_naissance: 1990,
  cree_le: '2026-01-01',
  nb_seances: 4,
  derniere_seance: '2026-09-01',
  problematiques: [],
  email: 'lea@exemple.fr',
  telephone: null,
  prix_seance: null,
  relances_actives: true,
  relance_reportee_au: null,
  accord_relance_le: '2026-01-01',
  supprime_le: null,
  consentement_le: null,
  ...champs,
});

const envoi = (champs: Partial<Envoi> = {}): Envoi => ({
  id: 'e1',
  client_id: 'c1',
  questionnaire_id: null,
  canal: 'email',
  destinataire: 'lea@exemple.fr',
  objet: '',
  corps: '',
  questionnaire: {},
  questions: [],
  cree_le: '2026-09-16T09:00:00Z',
  expire_le: '2026-10-16T09:00:00Z',
  envoye_le: '2026-09-16T09:00:00Z',
  lien_sorti_le: '2026-09-16T09:00:00Z',
  reponses: null,
  repondu_le: null,
  consulte_le: null,
  analyse_ia: null,
  ...champs,
});

describe('relances après la dernière séance', () => {
  it('première relance 15 jours après la dernière séance', () => {
    expect(prochaineRelance(client(), [], p)).toEqual({ echeance: '2026-09-16', rang: 1 });
    expect(calculerTaches([client()], [], p, '2026-09-15')).toEqual([]);
    const [t] = calculerTaches([client()], [], p, '2026-09-20');
    expect(t).toMatchObject({ type: 'relance', rang: 1, max: 3, retardJours: 4, canaux: ['email'] });
  });

  it('puis tous les 30 jours après la précédente, dans la limite de 3', () => {
    expect(prochaineRelance(client(), [envoi()], p)).toEqual({ echeance: '2026-10-16', rang: 2 });
    const trois = [
      envoi(),
      envoi({ id: 'e2', envoye_le: '2026-10-16T09:00:00Z' }),
      envoi({ id: 'e3', envoye_le: '2026-11-15T09:00:00Z' }),
    ];
    expect(prochaineRelance(client(), trois, p)).toBeNull();
  });

  it('une nouvelle séance remet le compteur à zéro', () => {
    const anciens = [
      envoi({ envoye_le: '2026-06-01T09:00:00Z' }),
      envoi({ id: 'e2', envoye_le: '2026-07-01T09:00:00Z' }),
    ];
    expect(prochaineRelance(client(), anciens, p)).toEqual({ echeance: '2026-09-16', rang: 1 });
  });

  it('respecte le report, la désactivation et les réglages', () => {
    expect(prochaineRelance(client({ relance_reportee_au: '2026-09-25' }), [], p)?.echeance).toBe('2026-09-25');
    expect(prochaineRelance(client({ relances_actives: false }), [], p)).toBeNull();
    expect(prochaineRelance(client(), [], { ...p, relances_actives: false })).toBeNull();
    expect(prochaineRelance(client({ derniere_seance: null }), [], p)).toBeNull();
    expect(prochaineRelance(client(), [], { ...p, relance_delai_jours: 7 })?.echeance).toBe('2026-09-08');
  });

  it('un questionnaire rempli et non consulté devient une tâche, en premier', () => {
    const recu = envoi({ repondu_le: '2026-09-18T19:00:00Z' });
    const taches = calculerTaches(
      [client(), client({ id: 'c2', derniere_seance: '2026-08-01' })],
      [recu],
      p,
      '2026-09-20',
    );
    // c1 vient d'être relancé (l'envoi compte comme relance 1) ; c2 attend sa relance.
    expect(taches.map((t) => [t.type, t.client?.id])).toEqual([
      ['questionnaire', 'c1'],
      ['relance', 'c2'],
    ]);
    expect(
      calculerTaches([client()], [{ ...recu, consulte_le: '2026-09-19T08:00:00Z' }], p, '2026-09-20'),
    ).toHaveLength(0);
  });
});

describe('rentabilité', () => {
  const seances = [
    { id: '1', client_id: 'a', date_seance: '2026-09-02', prix: 60 },
    { id: '2', client_id: 'a', date_seance: '2026-08-20', prix: 60 },
    { id: '3', client_id: 'b', date_seance: '2026-09-10', prix: 75 },
    { id: '4', client_id: 'b', date_seance: '2026-09-12', prix: null },
    { id: '5', client_id: 'a', date_seance: '2024-01-10', prix: 50 },
  ];
  const clients = [
    { id: 'a', nom: 'Martin', prenom: 'Léa' },
    { id: 'b', nom: 'Petit', prenom: 'Hugo' },
  ];

  it('additionne les tarifs de la période, sans compter les séances sans tarif', () => {
    const r = calculerRentabilite(seances, clients, '12mois', '2026-09-30');
    expect(r.ca_total).toBe(195);
    expect(r.nb_seances).toBe(4);
    expect(r.nb_seances_sans_tarif).toBe(1);
    expect(r.prix_moyen).toBe(65);
    expect(r.ca_moyen_par_client).toBe(97.5);
    expect(r.par_client.map((x) => [x.client.prenom, x.ca, x.nb_seances])).toEqual([
      ['Léa', 120, 2],
      ['Hugo', 75, 2],
    ]);
    expect(r.par_mois.at(-1)).toEqual({ mois: '2026-09', ca: 135, nb_seances: 3 });
  });

  it('change de période', () => {
    expect(calculerRentabilite(seances, clients, 'tout', '2026-09-30').ca_total).toBe(245);
    expect(calculerRentabilite(seances, clients, 'annee', '2026-09-30').nb_seances).toBe(4);
    expect(calculerRentabilite([], clients, '12mois', '2026-09-30').prix_moyen).toBeNull();
  });

  it('les 12 mois finissent au mois de référence', () => {
    expect(douzeDerniersMois('2026-01-15')).toEqual([
      '2025-02',
      '2025-03',
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});

describe('messages de relance', () => {
  const vars = {
    prenom: 'Léa',
    nom: 'Martin',
    therapeute: 'Camille Laurent',
    signature: '',
    lien: 'https://x/q/abc',
    expiration: '1 nov. 2026',
    site: 'Mon cabinet',
  };

  it('remplit les variables du modèle', () => {
    expect(
      remplirModele('Bonjour {prenom} {nom} : {lien} ({expiration}) — {therapeute}, {site} {inconnue}', vars),
    ).toBe('Bonjour Léa Martin : https://x/q/abc (1 nov. 2026) — Camille Laurent, Mon cabinet {inconnue}');
  });
  it("l'historique ne garde pas le lien personnel", () => {
    expect(masquerLien('Voici : https://x/q/abc merci', 'https://x/q/abc')).toBe(
      'Voici : [lien du questionnaire] merci',
    );
  });
  it('prépare un SMS lisible par iOS et Android', () => {
    expect(lienSms('06 39 98 12 34', 'Bonjour Léa')).toBe('sms:0639981234?&body=Bonjour%20L%C3%A9a');
  });
  it('les modèles par défaut contiennent le lien', () => {
    expect(p.modele_email).toContain('{lien}');
    expect(p.modele_sms).toContain('{lien}');
  });
  it('{signature} : la signature du profil, sinon le nom du thérapeute', () => {
    expect(remplirModele('— {signature}', vars)).toBe('— Camille Laurent');
    expect(remplirModele('— {signature}', { ...vars, signature: 'C. Laurent\nThérapeute' })).toBe(
      '— C. Laurent\nThérapeute',
    );
  });
});

describe('date du jour', () => {
  it('est la date LOCALE, pas la date UTC', () => {
    // 1er octobre à 0 h 30 heure locale : en France, toISOString() donnerait le 30 septembre.
    expect(dateDuJour(new Date(2026, 9, 1, 0, 30))).toBe('2026-10-01');
    expect(dateDuJour(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

// ---------------------------------------------------------------------
// Questionnaires : validation (miroir de la fonction SQL) et lecture locale
// ---------------------------------------------------------------------
const question = (q: Partial<QuestionEnvoyee> & Pick<QuestionEnvoyee, 'id' | 'type'>): QuestionEnvoyee => ({
  libelle: q.id,
  aide: '',
  obligatoire: true,
  options: [],
  minimum: q.type === 'etoiles' ? 1 : 0,
  maximum: q.type === 'etoiles' ? 5 : 10,
  sens: 'haut',
  libelle_min: '',
  libelle_max: '',
  ...q,
});

describe('validation des réponses', () => {
  const qs = [
    question({ id: 'humeur', type: 'curseur' }),
    question({ id: 'stress', type: 'curseur', minimum: 1, maximum: 5, sens: 'bas', obligatoire: false }),
    question({ id: 'note', type: 'etoiles', maximum: 7, obligatoire: false }),
    question({ id: 'rdv', type: 'oui_non', obligatoire: false }),
    question({ id: 'evolution', type: 'choix_unique', options: ['Mieux', 'Pareil', 'Moins bien'], obligatoire: false }),
    question({ id: 'domaines', type: 'choix_multiple', options: ['Sommeil', 'Travail'], obligatoire: false }),
    question({ id: 'emotions', type: 'emotions', obligatoire: false }),
    question({ id: 'mot', type: 'texte', obligatoire: false }),
  ];
  const emotions = ['Peur', 'Colère', 'Joie'];
  const essai = (saisies: Record<string, ValeurReponse>) => () => validerReponses(qs, saisies, emotions);

  it('accepte chaque type de réponse et normalise le vide', () => {
    const r = validerReponses(
      qs,
      {
        humeur: 7,
        stress: 2,
        note: 6,
        rdv: true,
        evolution: 'Mieux',
        domaines: ['Sommeil'],
        emotions: ['Joie', 'Peur'],
        mot: '   ',
      },
      emotions,
    );
    expect(r.map((x) => x.valeur)).toEqual([7, 2, 6, true, 'Mieux', ['Sommeil'], ['Joie', 'Peur'], null]);
    expect(
      validerReponses(qs, { humeur: 0, domaines: [] }, emotions).find((x) => x.question_id === 'domaines')?.valeur,
    ).toBeNull();
  });

  it('refuse les réponses hors règles, en désignant la question', () => {
    expect(essai({})).toThrow('Réponse manquante : humeur');
    expect(essai({ humeur: 11 })).toThrow('Réponse invalide : humeur');
    expect(essai({ humeur: 4.5 })).toThrow(ReponseInvalide);
    expect(essai({ humeur: 5, stress: 0 })).toThrow('stress');
    expect(essai({ humeur: 5, note: 8 })).toThrow('note');
    expect(essai({ humeur: 5, rdv: 'oui' })).toThrow('rdv');
    expect(essai({ humeur: 5, evolution: 'Autre' })).toThrow('evolution');
    expect(essai({ humeur: 5, domaines: ['Sommeil', 'Sommeil'] })).toThrow('domaines');
    expect(essai({ humeur: 5, emotions: ['Tristesse'] })).toThrow('emotions');
    expect(essai({ humeur: 5, mot: 'x'.repeat(2001) })).toThrow('mot');
    try {
      validerReponses(qs, { humeur: 5, evolution: 'Autre' }, emotions);
    } catch (e) {
      expect((e as ReponseInvalide).questionId).toBe('evolution');
    }
  });

  it('le questionnaire par défaut est valide et a une question obligatoire', () => {
    expect(QUESTIONNAIRE_PAR_DEFAUT.questions).toHaveLength(7);
    expect(QUESTIONNAIRE_PAR_DEFAUT.questions.some((q) => q.obligatoire)).toBe(true);
    for (const q of [...QUESTIONNAIRE_PAR_DEFAUT.questions, ...BIBLIOTHEQUE_QUESTIONS]) {
      expect(q.minimum).toBeLessThan(q.maximum);
      if (q.type === 'choix_unique' || q.type === 'choix_multiple') expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('lecture locale des questionnaires (sans IA)', () => {
  const qs = [
    question({ id: 'q1', libelle: 'Comment vous sentez-vous ?', type: 'curseur' }),
    question({ id: 'q2', libelle: 'Niveau de stress ?', type: 'curseur', sens: 'bas' }),
    question({ id: 'q3', libelle: 'Un mot ?', type: 'texte', obligatoire: false }),
    question({ id: 'q4', libelle: 'Souhaitez-vous reprendre rendez-vous ?', type: 'oui_non', obligatoire: false }),
  ];
  const lu = (v: Record<string, ValeurReponse>) => ({ questions: qs, reponses: validerReponses(qs, v, []) });

  it('premier questionnaire : pas de comparaison', () => {
    const l = lectureLocale(lu({ q1: 6, q2: 4 }));
    expect(l).toMatchObject({ tendance: 'premiere', priorite: 'normale', modele: MODELE_LECTURE_LOCALE });
  });

  it('repère une amélioration (en tenant compte du sens des échelles)', () => {
    const l = lectureLocale(lu({ q1: 8, q2: 2, q4: true }), lu({ q1: 5, q2: 6 }));
    expect(l.tendance).toBe('amelioration');
    expect(l.priorite).toBe('normale');
    expect(l.points).toContain('Comment vous sentez-vous : 5 → 8');
    expect(l.points).toContain('Souhaite reprendre rendez-vous.');
  });

  it('une dégradation ou un message de détresse passent en priorité', () => {
    expect(lectureLocale(lu({ q1: 3, q2: 8 }), lu({ q1: 7, q2: 3 }))).toMatchObject({
      tendance: 'degradation',
      priorite: 'haute',
    });
    const detresse = lectureLocale(lu({ q1: 6, q2: 4, q3: "Je n'en peux plus en ce moment" }), lu({ q1: 6, q2: 4 }));
    expect(detresse.priorite).toBe('haute');
    expect(detresse.points[0]).toMatch(/détresse/);
    expect(lectureLocale(lu({ q1: 1, q2: 5 })).priorite).toBe('haute'); // score très bas
  });

  it('les tâches urgentes passent en premier ; la relance hérite de la priorité', () => {
    const avant = envoi({
      id: 'a',
      client_id: 'c2',
      questions: qs,
      reponses: lu({ q1: 8, q2: 2 }).reponses,
      repondu_le: '2026-07-01T10:00:00Z',
      envoye_le: '2026-06-30T10:00:00Z',
      consulte_le: '2026-07-02T10:00:00Z',
    });
    const urgent = envoi({
      id: 'u',
      client_id: 'c2',
      questions: qs,
      reponses: lu({ q1: 2, q2: 9 }).reponses,
      repondu_le: '2026-09-19T10:00:00Z',
    });
    const calme = envoi({
      id: 'c',
      client_id: 'c1',
      questions: qs,
      reponses: lu({ q1: 6, q2: 4 }).reponses,
      repondu_le: '2026-09-19T12:00:00Z',
    });
    const taches = calculerTaches(
      [client(), client({ id: 'c2', derniere_seance: '2026-06-01' })],
      [avant, urgent, calme],
      p,
      '2026-09-20',
    );
    expect(taches.map((t) => t.cle)).toEqual(['q-u', 'q-c']);
    expect(resumeDuJour(taches)).toBe('2 questionnaires reçus dont 1 à lire en priorité');
    // Une fois lu, le client c2 reste à relancer… en priorité.
    const ensuite = calculerTaches(
      [client({ id: 'c2', derniere_seance: '2026-06-01' })],
      [avant, { ...urgent, consulte_le: '2026-09-20T08:00:00Z', envoye_le: '2026-05-01T00:00:00Z' }],
      p,
      '2026-09-20',
    );
    expect(ensuite[0]).toMatchObject({ type: 'relance', prioritaire: true });
    expect(resumeDuJour([])).toBe("Rien à faire pour l'instant.");
  });

  it('une lecture IA déjà conservée remplace la lecture locale', () => {
    const ia = {
      tendance: 'stable' as const,
      priorite: 'normale' as const,
      points: [],
      resume: 'Résumé IA',
      suggestion: 'Rien',
      modele: 'gemini',
    };
    const e = envoi({
      questions: qs,
      reponses: lu({ q1: 6, q2: 4 }).reponses,
      repondu_le: '2026-09-19T10:00:00Z',
      analyse_ia: ia,
    });
    expect(lireEnvoi(e, [e])).toBe(ia);
  });
});

describe('sécurité', () => {
  it('codes TOTP conformes à la RFC 6238 (vecteur SHA-1)', async () => {
    const secret = base32(new TextEncoder().encode('12345678901234567890'));
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(await codeTotp(secret, 59_000, 8)).toBe('94287082');
    expect(await codeTotp(secret, 1_111_111_109_000, 8)).toBe('07081804');
    expect(await codeTotp(secret, 59_000)).toBe('287082');
  });

  it('accepte le code courant et ses voisins, refuse le reste', async () => {
    const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
    const t = 1_790_000_000_000;
    expect(await verifierTotp(secret, await codeTotp(secret, t), t)).toBe(true);
    expect(await verifierTotp(secret, await codeTotp(secret, t - 30_000), t)).toBe(true);
    expect(await verifierTotp(secret, await codeTotp(secret, t - 120_000), t)).toBe(false);
    expect(await verifierTotp(secret, 'abcdef', t)).toBe(false);
  });

  it('base32 aller-retour', () => {
    const octets = crypto.getRandomValues(new Uint8Array(20));
    expect([...depuisBase32(base32(octets))]).toEqual([...octets]);
  });

  it('jetons de lien : 256 bits, empreinte SHA-256', async () => {
    const j = genererJeton();
    expect(j).toMatch(/^[0-9a-f]{64}$/);
    expect(genererJeton()).not.toBe(j);
    expect(await empreinteJeton('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('mots de passe', () => {
    expect(problemeMotDePasse('demo')).toMatch(/10/);
    expect(problemeMotDePasse('abcdefghijk')).toMatch(/Mélangez/);
    expect(problemeMotDePasse('cheval-bleu-42')).toBeNull();
  });

  it("décrit l'appareil pour le journal", () => {
    expect(
      decrireAppareil(
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPad');
    expect(
      decrireAppareil(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows');
  });
});

describe('mots de détresse', () => {
  it('repère les expressions, quelles que soient la casse, les accents et les apostrophes', () => {
    for (const t of [
      'Je n’en peux plus du tout',
      'J EN PEUX PLUS',
      "J'ai des idées noires le soir",
      'Parfois j’ai envie de disparaître',
      'Mon compagnon me frappe',
      'Je vis une agression au travail',
      'pensées suicidaires',
    ])
      expect(contientDetresse(t), t).toBe(true);
  });
  it('évite les faux positifs courants', () => {
    for (const t of ['Ça va mieux, merci.', 'Ma régression est terminée', 'Les douleurs ont disparu', 'Je dors mieux'])
      expect(contientDetresse(t), t).toBe(false);
  });
});

describe('fonction IA : origines autorisées (CORS)', () => {
  it('sans réglage : développement local seulement', () => {
    expect(originesAutorisees(undefined)).toEqual(ORIGINES_DEVELOPPEMENT);
    expect(entetesCors('https://pirate.exemple', originesAutorisees(undefined))).toBeNull();
    expect(entetesCors('http://localhost:5190', originesAutorisees(''))?.['Access-Control-Allow-Origin']).toBe(
      'http://localhost:5190',
    );
  });
  it('liste séparée par des virgules ; appel sans Origin (serveur) accepté sans en-tête', () => {
    const liste = originesAutorisees(' https://cabinet.fr/ , https://www.cabinet.fr');
    expect(liste).toEqual(['https://cabinet.fr', 'https://www.cabinet.fr']);
    expect(entetesCors('https://www.cabinet.fr', liste)?.['Access-Control-Allow-Origin']).toBe(
      'https://www.cabinet.fr',
    );
    expect(entetesCors('https://cabinet.fr.pirate.exemple', liste)).toBeNull();
    expect(entetesCors(null, liste)?.['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('période des statistiques', () => {
  it('3 mois = le mois de référence et les 2 précédents ; 12 mois = lui et les 11 précédents', () => {
    expect(debutPeriode('3mois', '2026-09-30')).toBe('2026-07-01');
    expect(debutPeriode('12mois', '2026-09-30')).toBe('2025-10-01');
    expect(debutPeriode('3mois', '2026-01-15')).toBe('2025-11-01');
    expect(debutPeriode('tout', '2026-09-30')).toBeNull();
  });
});

/** Stockage du navigateur, en mémoire (les tests tournent sous Node). */
class StockageMemoire {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

describe('« rester connecté » et inactivité', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new StockageMemoire());
    vi.stubGlobal('sessionStorage', new StockageMemoire());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sans l'option, la session ne vit que dans l'onglet", () => {
    memoriserSession(false);
    stockageSession.setItem('jeton', 'abc');
    expect(sessionStorage.getItem('jeton')).toBe('abc');
    expect(localStorage.getItem('jeton')).toBeNull();
  });

  it("avec l'option, elle survit à la fermeture de l'onglet pendant 8 h, pas plus", () => {
    memoriserSession(true);
    stockageSession.setItem('jeton', 'abc');
    sessionStorage.clear(); // onglet fermé
    expect(stockageSession.getItem('jeton')).toBe('abc');
    vi.setSystemTime(new Date('2026-10-03T17:00:01Z'));
    expect(stockageSession.getItem('jeton')).toBeNull();
    expect(localStorage.getItem('jeton')).toBeNull(); // oublié de l'appareil
  });

  it("une session restaurée après trop d'inactivité est expirée", () => {
    expect(activiteExpiree()).toBe(false); // jamais connecté sur cet appareil
    localStorage.setItem('suivi-therapeutique:derniere-activite', JSON.stringify({ le: Date.now(), minutes: 30 }));
    vi.setSystemTime(new Date('2026-10-03T09:29:00Z'));
    expect(activiteExpiree()).toBe(false);
    vi.setSystemTime(new Date('2026-10-03T09:31:00Z'));
    expect(activiteExpiree()).toBe(true);
    marquerActivite(); // nouvelle connexion
    expect(activiteExpiree()).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Emploi du temps
// ---------------------------------------------------------------------
describe('couleurs lisibles par les personnes daltoniennes', () => {
  it('les couleurs d’origine des rendez-vous ne se confondent sous aucune vision', () => {
    const origine = Object.fromEntries(CATEGORIES.map((c) => [c.cle, c.couleur]));
    expect(confusions(origine)).toEqual([]);
    for (const c of CATEGORIES) expect(contraste(c.couleur, '#ffffff'), c.cle).toBeGreaterThanOrEqual(3);
  });
  it('signale un rouge et un vert de même clarté (confondus en daltonisme rouge-vert)', () => {
    const [p] = confusions({ seance: '#15803d', bilan: '#b42318' });
    expect(p?.vision === 'deutan' || p?.vision === 'protan').toBe(true);
    expect(confusions({ a: '#3b82f6', b: '#3b82f6' })[0].vision).toBe('normale');
    expect(ecart('#3b82f6', '#b58900', 'deutan')).toBeCloseTo(ecart('#b58900', '#3b82f6', 'deutan'));
  });
  it('les couleurs choisies remplacent les couleurs d’origine seulement si elles sont valides', () => {
    const c = couleursAgenda({ agenda_couleurs: { bilan: '#0f766e', seance: 'rouge; background:url(x)' } });
    expect(c.bilan).toBe('#0f766e');
    expect(c.seance).toBe('#3b82f6');
  });
});

describe('emploi du temps : calculs', () => {
  it('semaines et jours en heure locale, y compris au changement d’heure', () => {
    expect(lundiDe('2026-10-03')).toBe('2026-09-28'); // samedi → lundi
    expect(lundiDe('2026-09-28')).toBe('2026-09-28');
    expect(jourSemaine('2026-10-04')).toBe(7);
    expect(decalerJour('2026-10-24', 1)).toBe('2026-10-25'); // passage à l'heure d'hiver
    expect(decalerJour('2026-10-25', 1)).toBe('2026-10-26');
    expect(heureDe(horodatage('2026-10-25', '14:30'))).toBe('14:30');
    expect(heureLisible(horodatage('2026-10-06', '09:00'))).toBe('9 h');
  });

  const rdv = (id: string, debut: string, fin: string, statut: RendezVous['statut'] = 'prevu'): RendezVous => ({
    id,
    client_id: 'c1',
    categorie: 'seance',
    statut,
    modalite: 'cabinet',
    debut: horodatage('2026-10-06', debut),
    fin: horodatage('2026-10-06', fin),
    titre: '',
    note: '',
    seance_id: null,
    rappel_envoye_le: null,
    cree_le: '2026-10-01T00:00:00.000Z',
  });

  it('dispose côte à côte les rendez-vous qui se chevauchent', () => {
    const place = disposer([
      rdv('a', '09:00', '10:00'),
      rdv('b', '09:30', '10:30'),
      rdv('c', '10:00', '11:00'),
      rdv('d', '14:00', '15:00'),
    ]);
    expect(place.get('a')).toEqual({ colonne: 0, colonnes: 2 });
    expect(place.get('b')).toEqual({ colonne: 1, colonnes: 2 });
    expect(place.get('c')).toEqual({ colonne: 0, colonnes: 2 }); // reprend la colonne libérée par « a »
    expect(place.get('d')).toEqual({ colonne: 0, colonnes: 1 });
  });

  it('repère les chevauchements, sauf avec un rendez-vous annulé', () => {
    const existants = [rdv('a', '09:00', '10:00'), rdv('b', '10:00', '11:00', 'annule')];
    expect(
      conflits({ debut: horodatage('2026-10-06', '09:30'), fin: horodatage('2026-10-06', '10:30') }, existants).map(
        (r) => r.id,
      ),
    ).toEqual(['a']);
    expect(conflits({ id: 'a', debut: existants[0].debut, fin: existants[0].fin }, existants)).toEqual([]);
  });

  it('propose la catégorie selon le parcours et affiche les jours utiles', () => {
    expect([0, 1, 2, 3, 4, 7].map(categorieSuggeree)).toEqual([
      'premier',
      'seance',
      'seance',
      'bilan',
      'seance',
      'seance',
    ]);
    const samedi = { debut: horodatage('2026-10-10', '10:00') };
    expect(joursAffiches('2026-10-05', [1, 2, 3, 4, 5], [samedi])).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('rappels à envoyer et rendez-vous passés à compléter deviennent des tâches', () => {
    const maintenant = horodatage('2026-10-06', '12:00');
    const demain = {
      ...rdv('r1', '09:00', '10:00'),
      debut: horodatage('2026-10-07', '09:00'),
      fin: horodatage('2026-10-07', '10:00'),
    };
    const dejaRappele = { ...demain, id: 'r2', rappel_envoye_le: maintenant };
    const ceMatin = rdv('r3', '09:00', '10:00');
    const honore = { ...rdv('r4', '10:00', '11:00'), statut: 'honore' as const };
    const taches = calculerTaches(
      [client({ relances_actives: false })], // seulement les tâches d'emploi du temps
      [],
      p,
      '2026-10-06',
      [demain, dejaRappele, ceMatin, honore],
      maintenant,
    );
    expect(taches.map((t) => t.cle)).toEqual(['clo-r3', 'rap-r1']);
    expect(resumeDuJour(taches, 2)).toBe(
      "2 rendez-vous aujourd'hui · 1 rendez-vous passé à compléter · 1 rappel de rendez-vous à envoyer",
    );
  });

  it('le message de rappel remplit date, heure et lieu', () => {
    expect(
      remplirModele('Rendez-vous le {date} à {heure} ({lieu}). {signature}', {
        prenom: 'Léa',
        nom: 'Martin',
        therapeute: 'Camille Laurent',
        signature: '',
        site: 'Cabinet',
        date: 'mardi 6 octobre',
        heure: '14 h 30',
        lieu: 'au cabinet',
      }),
    ).toBe('Rendez-vous le mardi 6 octobre à 14 h 30 (au cabinet). Camille Laurent');
  });
});

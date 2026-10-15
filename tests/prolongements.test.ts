// Version 0.8.0 : reçus (récapitulatif, export), exercices à compléter,
// tâches récurrentes, créneaux selon les habitudes du client. Logique pure.

import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from '../src/config/parametresDefaut';
import { creneauxLibres, habitudesClient, horodatage, texteCreneaux } from '../src/domaine/agenda';
import { lienRecu } from '../src/domaine/messages';
import { csvRecus, recapAnnuel } from '../src/domaine/recus';
import {
  ajouterMois,
  calculerTaches,
  echeanceSuivante,
  familleTache,
  resumeDuJour,
  titreTache,
} from '../src/domaine/taches';
import { blocsTexte, questionsDocument, validerReponsesDocument } from '../src/domaine/texte';
import type { ClientResume, Recu, Remise, RendezVous } from '../src/domaine/types';

const p = { ...PARAMETRES_PAR_DEFAUT };

const recu = (numero: number, champs: Partial<Recu> = {}): Recu => ({
  id: `r${numero}`,
  annee: 2026,
  numero,
  client_id: 'c1',
  seance_id: `s${numero}`,
  client_nom: 'Léa Martin',
  date_seance: '2026-03-10',
  date_emission: '2026-03-10',
  prestation: 'Séance d’accompagnement comportemental et émotionnel n° 2',
  montant: 60,
  mode_reglement: 'virement',
  emetteur: { nom: 'Camille Laurent', specialite: '', adresse: '', telephone: '', siret: '', mention: '' },
  annule_le: null,
  motif_annulation: '',
  cree_le: '2026-03-10T18:00:00Z',
  lien_expire_le: null,
  lien_ouvert_le: null,
  lignes: [],
  ...champs,
});

describe('reçus : récapitulatif annuel et export pour le tableur', () => {
  const recus = [
    recu(1, { montant: 60.1 }),
    recu(2, { date_emission: '2026-03-28', montant: 0.2, mode_reglement: 'especes' }),
    recu(3, { date_emission: '2026-07-02', annule_le: '2026-07-03T10:00:00Z', motif_annulation: 'Erreur' }),
    recu(4, { date_emission: '2026-11-15', mode_reglement: 'cheque', montant: 75 }),
    recu(1, { id: 'autre-annee', annee: 2025, date_emission: '2025-12-30' }),
  ];

  it('totaux au centime, annulés exclus, par mois et par mode', () => {
    const r = recapAnnuel(recus, 2026);
    expect(r).toMatchObject({ annee: 2026, nb: 3, nbAnnules: 1, total: 135.3 });
    expect(r.parMois[2]).toEqual({ mois: 3, nb: 2, total: 60.3 }); // 60,10 + 0,20 sans erreur d'arrondi
    expect(r.parMois[6]).toEqual({ mois: 7, nb: 0, total: 0 }); // annulé : ne compte pas
    expect(r.parMois[10]).toEqual({ mois: 11, nb: 1, total: 75 });
    expect(r.parMode.map((m) => [m.mode, m.nb, m.total])).toEqual([
      ['cheque', 1, 75],
      ['virement', 1, 60.1],
      ['especes', 1, 0.2],
    ]);
    expect(recapAnnuel(recus, 2024)).toMatchObject({ nb: 0, total: 0, parMode: [] });
  });

  it('CSV à la française : « ; », virgule décimale, dates JJ/MM/AAAA, accents reconnus par Excel', () => {
    const csv = csvRecus(recus, 2026);
    expect(csv.startsWith('﻿')).toBe(true);
    const lignes = csv.slice(1).trimEnd().split('\r\n');
    expect(lignes).toHaveLength(5); // en-tête + 4 reçus de 2026, annulé compris
    expect(lignes[0]).toBe(
      "Numéro;Date du reçu;Client;Date de la séance;Prestation;Montant (€);Règlement;État;Motif d'annulation",
    );
    expect(lignes[1]).toBe(
      '2026-0001;10/03/2026;Léa Martin;10/03/2026;Séance d’accompagnement comportemental et émotionnel n° 2;60,10;par virement;Valide;',
    );
    expect(lignes[3]).toMatch(/;Annulé;Erreur$/);
  });

  it('CSV : séparateurs et guillemets protégés, formules de tableur neutralisées', () => {
    const csv = csvRecus(
      [recu(1, { client_nom: 'Durand; "Léa"', motif_annulation: '=HYPERLINK("x")', annule_le: '2026-03-11' })],
      2026,
    );
    const ligne = csv.slice(1).split('\r\n')[1];
    expect(ligne).toContain(';"Durand; ""Léa""";');
    expect(ligne.endsWith(`;"'=HYPERLINK(""x"")"`)).toBe(true);
  });

  it('lien personnel du reçu', () => {
    expect(lienRecu('abc', 'https://exemple.fr')).toBe('https://exemple.fr/r/abc');
  });
});

describe('exercices à compléter', () => {
  const contenu = [
    '# Ce soir',
    'Quelques mots suffisent.',
    '? Quelle émotion ?',
    '  ?   Où dans le corps ?  ',
    '?Sans espace : texte simple',
    '?',
    '- ? dans une liste',
    '?\tAvec tabulation',
  ].join('\r\n');

  it('les lignes « ? » sont des questions, numérotées dans l’ordre', () => {
    expect(questionsDocument(contenu)).toEqual(['Quelle émotion ?', 'Où dans le corps ?', 'Avec tabulation']);
    expect(blocsTexte(contenu).filter((b) => b.type === 'question')).toEqual([
      { type: 'question', texte: 'Quelle émotion ?', indice: 0 },
      { type: 'question', texte: 'Où dans le corps ?', indice: 1 },
      { type: 'question', texte: 'Avec tabulation', indice: 2 },
    ]);
    expect(questionsDocument('Pas de question ici.')).toEqual([]);
  });

  it('réponses : une par question, 5 000 caractères au plus, au moins une remplie', () => {
    const q = ['A ?', 'B ?'];
    expect(validerReponsesDocument(q, ['  oui \n', ''])).toEqual([
      { question: 'A ?', reponse: 'oui' },
      { question: 'B ?', reponse: '' },
    ]);
    expect(() => validerReponsesDocument(q, ['oui'])).toThrow('Réponses incomplètes.');
    expect(() => validerReponsesDocument(q, [' ', '\n'])).toThrow('Répondez à au moins une question.');
    expect(() => validerReponsesDocument(q, ['x'.repeat(5001), ''])).toThrow(/trop longue/);
    expect(() => validerReponsesDocument([], [])).toThrow("Ce document n'attend pas de réponse.");
  });

  const client: ClientResume = {
    id: 'c1',
    nom: 'Martin',
    prenom: 'Léa',
    annee_naissance: 1990,
    cree_le: '2026-01-01',
    nb_seances: 4,
    derniere_seance: '2026-09-15',
    problematiques: [],
    email: 'lea@exemple.fr',
    telephone: null,
    prix_seance: null,
    relances_actives: false,
    relance_reportee_au: null,
    accord_relance_le: null,
    supprime_le: null,
  };
  const remise = (champs: Partial<Remise>): Remise => ({
    id: 'x1',
    client_id: 'c1',
    document_id: 'd1',
    mode: 'lien',
    titre: 'Journal des émotions',
    cree_le: '2026-09-20T10:00:00Z',
    expire_le: '2026-12-20T10:00:00Z',
    ouvert_le: '2026-09-21T10:00:00Z',
    reponses: [{ question: 'A ?', reponse: 'oui' }],
    repondu_le: '2026-09-21T10:05:00Z',
    consulte_le: null,
    nb_questions: 1,
    rappel_le: null,
    ...champs,
  });

  it('un exercice rendu et pas encore lu devient une tâche', () => {
    const taches = calculerTaches(
      [client],
      [],
      p,
      '2026-09-22',
      [],
      '2026-09-22T10:00:00Z',
      [],
      [
        remise({}),
        remise({ id: 'x2', consulte_le: '2026-09-21T12:00:00Z' }), // déjà lu
        remise({ id: 'x3', repondu_le: null, reponses: null }), // pas encore rendu
        remise({ id: 'x4', client_id: 'corbeille' }), // client à la corbeille
      ],
    );
    expect(taches.map((t) => t.cle)).toEqual(['x-x1']);
    expect(familleTache(taches[0])).toBe('exercices');
    expect(titreTache(taches[0])).toBe('Exercice complété par Léa Martin');
    expect(resumeDuJour(taches)).toBe('1 exercice complété par vos clients');
  });
});

describe('tâches récurrentes', () => {
  it('ajout de mois : fin de mois respectée, années bissextiles', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28');
    expect(ajouterMois('2028-01-31', 1)).toBe('2028-02-29');
    expect(ajouterMois('2026-01-31', 2)).toBe('2026-03-31');
    expect(ajouterMois('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('prochaine échéance : première date de la série après aujourd’hui', () => {
    expect(echeanceSuivante('2026-10-05', 'semaine', '2026-10-05')).toBe('2026-10-12');
    // cochée avec trois semaines de retard : on ne crée pas une tâche déjà en retard
    expect(echeanceSuivante('2026-09-14', 'semaine', '2026-10-05')).toBe('2026-10-12');
    // série mensuelle calée sur le 31 : 28 février puis de nouveau 31 mars
    expect(echeanceSuivante('2026-01-31', 'mois', '2026-01-31')).toBe('2026-02-28');
    expect(echeanceSuivante('2026-01-31', 'mois', '2026-02-28')).toBe('2026-03-31');
    // sans échéance : la série part d'aujourd'hui
    expect(echeanceSuivante(null, 'mois', '2026-10-05')).toBe('2026-11-05');
    expect(echeanceSuivante('2026-10-05', 'aucune', '2026-10-05')).toBeNull();
  });
});

describe('créneaux selon les habitudes du client', () => {
  const rdv = (jour: string, debut: string, champs: Partial<RendezVous> = {}): RendezVous => {
    const fin = new Date(Date.parse(horodatage(jour, debut)) + 3_600_000).toISOString();
    return {
      id: `${jour}-${debut}`,
      client_id: 'c1',
      categorie: 'seance',
      statut: 'honore',
      modalite: 'cabinet',
      debut: horodatage(jour, debut),
      fin,
      titre: '',
      note: '',
      seance_id: null,
      rappel_envoye_le: null,
      cree_le: '2026-01-01T00:00:00Z',
      ...champs,
    };
  };
  const maintenant = new Date(horodatage('2026-10-05', '10:00')); // lundi
  const passes = [
    rdv('2026-09-01', '18:00'), // mardis 18 h × 3
    rdv('2026-09-15', '18:00'),
    rdv('2026-09-29', '18:00'),
    rdv('2026-09-24', '09:30'), // jeudi 9 h 30 × 2
    rdv('2026-09-10', '09:30'),
    rdv('2026-09-17', '14:00'), // une seule fois : pas une habitude
    rdv('2026-09-08', '11:00', { statut: 'annule' }),
    rdv('2026-09-22', '11:00', { statut: 'annule' }),
    rdv('2026-09-23', '18:00', { client_id: 'autre' }),
    rdv('2026-09-30', '18:00', { client_id: 'autre' }),
  ];

  it('jours et heures revenus au moins deux fois, hors annulés et hors autres clients', () => {
    expect(habitudesClient(passes, 'c1', maintenant)).toEqual([
      { jour: 2, heure: '18:00', nb: 3 },
      { jour: 4, heure: '09:30', nb: 2 },
    ]);
    // un rendez-vous à venir ne compte pas
    expect(habitudesClient([rdv('2026-10-06', '18:00'), rdv('2026-10-13', '18:00')], 'c1', maintenant)).toEqual([]);
  });

  it('les créneaux habituels libres passent en premier, puis la proposition habituelle ; tri par date', () => {
    const reglages = { ...p, agenda_heure_debut: 9, agenda_heure_fin: 20, agenda_jours: [1, 2, 3, 4, 5] };
    const occupe = [rdv('2026-10-13', '18:00', { client_id: 'autre', statut: 'prevu' })]; // 2e mardi pris
    const habitudes = habitudesClient(passes, 'c1', maintenant);
    const c = creneauxLibres([...passes, ...occupe], reglages, maintenant, { nombre: 4, habitudes });
    expect(c.map((x) => [x.debut, x.habituel])).toEqual([
      [horodatage('2026-10-06', '09:00'), false],
      [horodatage('2026-10-06', '18:00'), true],
      [horodatage('2026-10-08', '09:30'), true],
      [horodatage('2026-10-15', '09:30'), true],
    ]);
    expect(texteCreneaux(c.slice(1, 2))).toContain('- mardi 6 octobre à 18 h (votre créneau habituel)');
  });

  it('une habitude hors des heures de travail n’est pas proposée', () => {
    const reglages = { ...p, agenda_heure_debut: 9, agenda_heure_fin: 18, agenda_jours: [1, 2, 3, 4, 5] };
    const c = creneauxLibres([], reglages, maintenant, {
      nombre: 2,
      habitudes: [{ jour: 2, heure: '18:00', nb: 3 }],
    });
    expect(c.every((x) => !x.habituel)).toBe(true);
  });
});

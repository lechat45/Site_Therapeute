// Version 0.9.0 : rappel d'un exercice non rendu, exercices rendus sur la
// fiche de séance, livre des recettes avec totaux par trimestre. Logique pure.

import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from '../src/config/parametresDefaut';
import { horodatage } from '../src/domaine/agenda';
import { exercicesRendus } from '../src/domaine/exercices';
import { csvLivreRecettes, totauxTrimestres } from '../src/domaine/recus';
import { calculerTaches, familleTache, resumeDuJour, titreTache } from '../src/domaine/taches';
import type { ClientResume, Recu, Remise } from '../src/domaine/types';

const p = { ...PARAMETRES_PAR_DEFAUT }; // rappel après 7 jours

const client = (id = 'c1'): ClientResume => ({
  id,
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
  consentement_le: null,
});

const remise = (id: string, champs: Partial<Remise> = {}): Remise => ({
  id,
  client_id: 'c1',
  document_id: 'd1',
  mode: 'lien',
  titre: 'Journal des émotions',
  cree_le: '2026-09-20T10:00:00Z',
  expire_le: '2026-12-20T10:00:00Z',
  ouvert_le: null,
  reponses: null,
  repondu_le: null,
  consulte_le: null,
  nb_questions: 4,
  rappel_le: null,
  ...champs,
});

describe('rappel d’un exercice non rendu', () => {
  const taches = (remises: Remise[], jour = '2026-09-30', reglages = p) =>
    calculerTaches([client()], [], reglages, jour, [], `${jour}T10:00:00Z`, [], remises);

  it('après le délai réglé, sans réponse ni rappel, lien encore valable', () => {
    const [t] = taches([remise('x1')]);
    expect(t).toMatchObject({ type: 'rappel_exercice', cle: 'xr-x1', joursAttente: 10 });
    expect(familleTache(t)).toBe('exercices');
    expect(titreTache(t)).toBe("Rappeler l'exercice à Léa Martin");
    expect(resumeDuJour([t])).toBe('1 exercice à rappeler');
  });

  it('pas de rappel trop tôt, ni pour un document sans question, ni deux fois, ni après réponse', () => {
    expect(taches([remise('x1')], '2026-09-26')).toEqual([]); // 6 jours
    expect(taches([remise('x1')], '2026-09-27')).toHaveLength(1); // 7 jours
    expect(
      taches([
        remise('a', { nb_questions: 0 }),
        remise('b', { mode: 'imprime', expire_le: null }),
        remise('c', { rappel_le: '2026-09-28T09:00:00Z' }),
        remise('d', { repondu_le: '2026-09-29T09:00:00Z', consulte_le: '2026-09-29T10:00:00Z' }),
        remise('e', { expire_le: '2026-09-29T10:00:00Z' }), // lien expiré
        remise('f', { client_id: 'corbeille' }),
      ]),
    ).toEqual([]);
    expect(taches([remise('x1')], '2026-09-30', { ...p, exercice_rappel_jours: 0 })).toEqual([]); // désactivé
  });
});

describe('exercices rendus sur la fiche de séance', () => {
  const rendus = [
    remise('avant', { repondu_le: horodatage('2026-09-10', '20:00') }),
    remise('jour-precedente', { repondu_le: horodatage('2026-09-15', '21:00') }),
    remise('entre', { repondu_le: horodatage('2026-09-18', '19:00') }),
    remise('jour-seance', { repondu_le: horodatage('2026-09-22', '08:00') }),
    remise('apres', { repondu_le: horodatage('2026-09-25', '18:00') }),
    remise('sans-reponse'),
  ];

  it('séance du 22, précédente le 15 : rendus après le 15, au plus tard le 22', () => {
    expect(exercicesRendus(rendus, '2026-09-15', '2026-09-22').map((r) => r.id)).toEqual(['entre', 'jour-seance']);
  });

  it('dernière séance : tout ce qui est arrivé depuis la précédente ; première séance : tout avant', () => {
    expect(exercicesRendus(rendus, '2026-09-15', null).map((r) => r.id)).toEqual(['entre', 'jour-seance', 'apres']);
    expect(exercicesRendus(rendus, null, '2026-09-15').map((r) => r.id)).toEqual(['avant', 'jour-precedente']);
  });
});

const recu = (annee: number, numero: number, date: string, champs: Partial<Recu> = {}): Recu => ({
  id: `${annee}-${numero}`,
  annee,
  numero,
  client_id: 'c1',
  seance_id: null,
  client_nom: 'Léa Martin',
  date_seance: date,
  date_emission: date,
  prestation: 'Séance n° 1',
  montant: 60,
  mode_reglement: 'virement',
  emetteur: { nom: '', specialite: '', adresse: '', telephone: '', siret: '', mention: '' },
  annule_le: null,
  motif_annulation: '',
  cree_le: `${date}T18:00:00Z`,
  lien_expire_le: null,
  lien_ouvert_le: null,
  lignes: [{ seance_id: null, date_seance: date, prestation: 'Séance n° 1', montant: 60 }],
  ...champs,
});

describe('livre des recettes et totaux par trimestre', () => {
  const recus = [
    recu(2026, 2, '2026-04-02', { montant: 75.5 }),
    recu(2026, 1, '2026-03-31'),
    recu(2025, 7, '2025-12-30', { mode_reglement: 'especes' }),
    recu(2026, 3, '2026-04-10', { annule_le: '2026-04-11T08:00:00Z' }),
    recu(2026, 4, '2026-05-02', {
      montant: 120,
      prestation: "Séances d'accompagnement comportemental et émotionnel (2)",
      lignes: [
        { seance_id: 's1', date_seance: '2026-04-20', prestation: 'Séance n° 5', montant: 60 },
        { seance_id: 's2', date_seance: '2026-04-27', prestation: 'Séance n° 6', montant: 60 },
      ],
    }),
  ];

  it('totaux des reçus valides par trimestre civil, du plus ancien au plus récent', () => {
    expect(totauxTrimestres(recus)).toEqual([
      { annee: 2025, trimestre: 4, nb: 1, total: 60 },
      { annee: 2026, trimestre: 1, nb: 1, total: 60 },
      { annee: 2026, trimestre: 2, nb: 2, total: 195.5 }, // l'annulé ne compte pas
    ]);
  });

  it('CSV chronologique sur plusieurs années, sans les annulés, puis totaux par trimestre et total général', () => {
    const lignes = csvLivreRecettes(recus).slice(1).trimEnd().split('\r\n');
    expect(lignes[0]).toBe('Date;N° de reçu;Client;Nature de la prestation;Règlement;Montant (€)');
    expect(lignes.slice(1, 5).map((l) => l.split(';').slice(0, 2).join(' '))).toEqual([
      '30/12/2025 2025-0007',
      '31/03/2026 2026-0001',
      '02/04/2026 2026-0002',
      '02/05/2026 2026-0004',
    ]);
    // reçu groupé : dates des séances dans la nature de la prestation
    expect(lignes[4]).toContain("Séances d'accompagnement comportemental et émotionnel (2) : 20/04/2026, 27/04/2026");
    expect(lignes.slice(5)).toEqual([
      '',
      'Totaux par trimestre',
      'Année;Trimestre;Reçus;Montant (€)',
      '2025;4e trimestre;1;60,00',
      '2026;1er trimestre;1;60,00',
      '2026;2e trimestre;2;195,50',
      'Total;;4;315,50',
    ]);
  });

  it('limité à certaines années', () => {
    const csv = csvLivreRecettes(recus, [2025]);
    expect(csv).toContain('2025-0007');
    expect(csv).not.toContain('2026-0001');
    expect(csv).toContain('Total;;1;60,00');
  });
});

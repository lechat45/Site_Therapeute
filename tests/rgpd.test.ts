// RGPD (0.13.0) : export d'une fiche (accès, portabilité), export complet, durée de
// conservation (domaine/rgpd.ts).

import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from '../src/config/parametresDefaut';
import { exportClient, exportComplet, fichesARevoir, nomFichierExport, type DonneesClient } from '../src/domaine/rgpd';
import type { Client, ClientResume, Envoi, Note, Parametres, RendezVous, Seance } from '../src/domaine/types';

const client = (id: string, champs: Partial<Client> = {}): Client => ({
  id,
  therapeute_id: 'secret-therapeute',
  nom: 'Martin',
  prenom: 'Léa',
  annee_naissance: 1990,
  synthese_ia: null,
  synthese_ia_maj_le: null,
  cree_le: '2026-01-01T09:00:00.000Z',
  email: 'lea@exemple.fr',
  telephone: null,
  prix_seance: null,
  relances_actives: true,
  relance_reportee_au: null,
  accord_relance_le: null,
  consentement_le: '2026-01-05',
  supprime_le: null,
  ...champs,
});

const seance = (clientId: string, numero: number) =>
  ({
    id: `s-${clientId}-${numero}`,
    client_id: clientId,
    numero,
    type: 'initiale',
    date_seance: `2026-0${numero}-10`,
    objectif: 'Objectif',
    tim: '',
    notes: `Notes ${clientId}`,
    lignee: null,
    cases: [{ zone: 'present1_haut', position: 1, emotion_id: 1 }],
    prix: null,
  }) as unknown as Seance;

const note = (clientId: string | null, titre: string) =>
  ({ id: titre, client_id: clientId, titre, contenu: '…', epinglee: false, cree_le: 'x', maj_le: 'x' }) as Note;

const rdv = (clientId: string | null) =>
  ({
    id: `r-${clientId}`,
    client_id: clientId,
    categorie: 'seance',
    statut: 'prevu',
    modalite: 'cabinet',
    debut: 'd',
    fin: 'f',
    titre: '',
    note: '',
    seance_id: null,
    rappel_envoye_le: null,
    cree_le: 'x',
  }) as RendezVous;

const donnees = (id: string): DonneesClient => ({
  client: client(id),
  seances: [seance(id, 1), seance('autre', 1)],
  problematiques: [
    { client_id: id, therapeute_id: 't', problematique_id: 1, source: 'ia', ajoute_le: 'x' },
    { client_id: 'autre', therapeute_id: 't', problematique_id: 2, source: 'therapeute', ajoute_le: 'x' },
  ],
  envois: [{ client_id: 'autre', questions: [], questionnaire: {}, canal: 'email' } as unknown as Envoi],
  rendezVous: [rdv(id), rdv('autre'), rdv(null)],
  notes: [note(id, 'sur Léa'), note('autre', 'sur un autre'), note(null, 'libre')],
  remises: [],
  recus: [],
});

describe("RGPD : export d'une fiche (droit d'accès et de portabilité)", () => {
  it('ne contient que les données de ce client, lisibles, sans identifiant de thérapeute', () => {
    const e = exportClient(donnees('c1'), '2026-10-22T10:00:00.000Z');
    expect(e.format).toBe('suivi-therapeutique/export-client');
    expect(e.personne).toMatchObject({ nom: 'Martin', prenom: 'Léa', consentement_note_le: '2026-01-05' });
    expect(e.seances).toHaveLength(1);
    expect(e.seances[0].notes).toBe('Notes c1');
    // une émotion est exportée par son libellé, pas par un numéro
    expect(e.seances[0].emotions[0].emotion).not.toMatch(/^émotion \d/);
    expect(e.problematiques).toHaveLength(1);
    expect(e.problematiques[0].origine).toBe('suggérée par l’IA');
    expect(e.questionnaires).toEqual([]);
    expect(e.rendez_vous).toHaveLength(1);
    expect(e.notes.map((n) => n.titre)).toEqual(['sur Léa']);
    const texte = JSON.stringify(e);
    expect(texte).not.toContain('secret-therapeute');
    expect(texte).not.toContain('Notes autre');
    expect(texte).not.toContain('sur un autre');
    expect(texte).not.toMatch(/jeton/);
  });

  it('nomme le fichier sans accents ni espaces', () => {
    expect(nomFichierExport('Léa', 'De La Fontaine', '2026-10-22')).toBe('donnees-lea-de-la-fontaine-2026-10-22.json');
  });
});

describe('RGPD : export complet du thérapeute', () => {
  it('reprend chaque fiche, les notes libres et les créneaux sans client', () => {
    const d = donnees('c1');
    const e = exportComplet(
      {
        therapeute: { prenom: 'Camille', nom: 'Laurent', email: 'c@exemple.fr' },
        parametres: PARAMETRES_PAR_DEFAUT as unknown as Parametres,
        questionnaires: [],
        clients: [d],
        notes: d.notes,
        rendezVous: d.rendezVous,
        ressources: [],
        tachesPerso: [],
        connexions: [],
      },
      '2026-10-22T10:00:00.000Z',
    );
    expect(e.format).toBe('suivi-therapeutique/export-complet');
    expect(e.clients).toHaveLength(1);
    expect(e.notes_libres.map((n) => n.titre)).toEqual(['libre']);
    expect(e.creneaux_sans_client).toHaveLength(1);
  });
});

describe('RGPD : durée de conservation', () => {
  const resume = (id: string, derniere: string | null, creee = '2015-01-01T09:00:00.000Z'): ClientResume => ({
    id,
    nom: id,
    prenom: id,
    annee_naissance: 1990,
    cree_le: creee,
    nb_seances: derniere ? 1 : 0,
    derniere_seance: derniere,
    problematiques: [],
    email: null,
    telephone: null,
    prix_seance: null,
    relances_actives: true,
    relance_reportee_au: null,
    accord_relance_le: null,
    consentement_le: null,
    supprime_le: null,
  });

  it('propose les fiches au-delà de 5 ans (dernière séance, sinon création), les plus anciennes d’abord', () => {
    const clients = [
      resume('recente', '2024-03-01'),
      resume('ancienne', '2020-06-01'),
      resume('tres-ancienne', '2018-01-15'),
      resume('limite', '2021-10-23'),
      resume('sans-seance-ancienne', null, '2019-02-01T09:00:00.000Z'),
      resume('sans-seance-recente', null, '2026-02-01T09:00:00.000Z'),
      { ...resume('deja-corbeille', '2010-01-01'), supprime_le: '2026-10-01T00:00:00.000Z' },
    ];
    expect(fichesARevoir(clients, '2026-10-22', 5).map((c) => c.id)).toEqual([
      'tres-ancienne',
      'sans-seance-ancienne',
      'ancienne',
    ]);
  });
});

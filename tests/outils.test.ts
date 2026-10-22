// Journal, exercices, reçus, activité et tâches (v0.7.0) : logique pure.

import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from '../src/config/parametresDefaut';
import { statistiquesAgenda } from '../src/domaine/activite';
import { creneauxLibres, horodatage, texteCreneaux } from '../src/domaine/agenda';
import { insererAvantSignature, lienDocument, remplirModele } from '../src/domaine/messages';
import {
  calculerTaches,
  familleTache,
  recapSemaine,
  resumeDuJour,
  separerReportees,
  titreTache,
} from '../src/domaine/taches';
import { blocsTexte, numeroRecu } from '../src/domaine/texte';
import type { ClientResume, Envoi, RendezVous, TachePerso } from '../src/domaine/types';

const p = { ...PARAMETRES_PAR_DEFAUT };

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
  cree_le: '2026-10-01T09:00:00Z',
  expire_le: '2026-10-31T09:00:00Z',
  envoye_le: '2026-10-01T09:00:00Z',
  lien_sorti_le: '2026-10-01T09:00:00Z',
  reponses: null,
  repondu_le: null,
  consulte_le: null,
  analyse_ia: null,
  ...champs,
});

const rdv = (id: string, jour: string, debut: string, fin: string, champs: Partial<RendezVous> = {}): RendezVous => ({
  id,
  client_id: 'c1',
  categorie: 'seance',
  statut: 'honore',
  modalite: 'cabinet',
  debut: horodatage(jour, debut),
  fin: horodatage(jour, fin),
  titre: '',
  note: '',
  seance_id: null,
  rappel_envoye_le: null,
  cree_le: '2026-09-01T00:00:00.000Z',
  ...champs,
});

const tachePerso = (id: string, champs: Partial<TachePerso> = {}): TachePerso => ({
  id,
  client_id: null,
  titre: `Tâche ${id}`,
  echeance: null,
  faite_le: null,
  cree_le: `2026-09-01T0${id.length}:00:00Z`,
  recurrence: 'aucune',
  ...champs,
});

describe('documents remis : texte simple, sans HTML', () => {
  it('titres « # », listes « - », paragraphes séparés par une ligne vide', () => {
    expect(blocsTexte('# Quand\nLigne 1\nligne 2\n\n- a\n- b\nfin\n<script>alert(1)</script>')).toEqual([
      { type: 'titre', texte: 'Quand' },
      { type: 'paragraphe', texte: 'Ligne 1 ligne 2' },
      { type: 'liste', elements: ['a', 'b'] },
      // reste du texte brut : React l'affiche tel quel, rien n'est interprété
      { type: 'paragraphe', texte: 'fin <script>alert(1)</script>' },
    ]);
    expect(blocsTexte('\r\n\r\n')).toEqual([]);
  });

  it('lien personnel du document', () => {
    expect(lienDocument('abc', 'https://exemple.fr')).toBe('https://exemple.fr/d/abc');
  });
});

describe('reçus', () => {
  it('numéro affiché sur quatre chiffres, par année', () => {
    expect(numeroRecu({ annee: 2026, numero: 7 })).toBe('2026-0007');
    expect(numeroRecu({ annee: 2027, numero: 12345 })).toBe('2027-12345');
  });
});

describe('créneaux libres proposés dans une relance', () => {
  const reglages = { ...p, agenda_heure_debut: 9, agenda_heure_fin: 18, agenda_jours: [1, 2, 3, 4, 5] };
  const existants = [
    rdv('a', '2026-10-06', '09:00', '10:00', { statut: 'prevu' }),
    rdv('b', '2026-10-06', '13:00', '14:00', { statut: 'annule' }), // annulé : le créneau est libre
  ];

  it('dès demain, un le matin et un l’après-midi par jour, sans chevauchement', () => {
    const lundi = new Date(horodatage('2026-10-05', '10:00'));
    expect(creneauxLibres(existants, reglages, lundi, { nombre: 5 }).map((c) => c.debut)).toEqual([
      horodatage('2026-10-06', '10:00'),
      horodatage('2026-10-06', '13:00'),
      horodatage('2026-10-07', '09:00'),
      horodatage('2026-10-07', '13:00'),
      horodatage('2026-10-08', '09:00'),
    ]);
  });

  it('saute les jours non travaillés et respecte la durée', () => {
    const vendredi = new Date(horodatage('2026-10-09', '10:00'));
    const [premier] = creneauxLibres([], { ...reglages, duree_rdv_minutes: 90 }, vendredi);
    expect(premier).toEqual({
      debut: horodatage('2026-10-12', '09:00'),
      fin: horodatage('2026-10-12', '10:30'),
      habituel: false,
    });
    // aucune heure de travail : rien à proposer
    expect(creneauxLibres([], { ...reglages, agenda_jours: [] }, vendredi)).toEqual([]);
  });

  it('texte à insérer dans le message, avant la formule de politesse', () => {
    const texte = texteCreneaux([{ debut: horodatage('2026-10-06', '10:00') }]);
    expect(texte).toBe(
      'Si vous souhaitez reprendre rendez-vous, je peux vous proposer :\n- mardi 6 octobre à 10 h\nDites-moi ce qui vous convient.',
    );
    const corps = remplirModele(p.modele_email, {
      prenom: 'Léa',
      nom: 'Martin',
      therapeute: 'Camille Laurent',
      signature: '',
      site: 'Cabinet',
      lien: 'https://exemple.fr/q/x',
      expiration: '31 octobre 2026',
    });
    const avec = insererAvantSignature(corps, 'CRENEAUX', 'Camille Laurent');
    expect(avec).toMatch(
      /valable jusqu'au 31 octobre 2026\.\n\nCRENEAUX\n\nAu plaisir d'avoir de vos nouvelles,\nCamille Laurent$/,
    );
    // signature introuvable (ou SMS sur une ligne) : ajouté à la fin
    expect(insererAvantSignature('Bonjour — Camille', 'CRENEAUX', 'Camille')).toBe('Bonjour — Camille\n\nCRENEAUX');
    expect(insererAvantSignature('Bonjour', 'CRENEAUX', '')).toBe('Bonjour\n\nCRENEAUX');
  });
});

describe('statistiques de l’emploi du temps', () => {
  const liste = [
    rdv('a', '2026-09-29', '09:00', '10:00'),
    rdv('b', '2026-09-30', '17:00', '18:30', { categorie: 'bilan', modalite: 'visio' }),
    rdv('c', '2026-10-01', '17:00', '18:00', { statut: 'absent' }),
    rdv('d', '2026-10-02', '10:00', '11:00', { statut: 'annule' }),
    rdv('e', '2026-10-05', '17:00', '18:00', { statut: 'prevu' }), // passé, pas encore complété : compte
    rdv('f', '2026-10-08', '17:00', '18:00', { statut: 'prevu' }), // à venir
    rdv('g', '2026-10-06', '13:00', '14:00', { client_id: null, categorie: 'administratif' }),
    rdv('h', '2026-09-21', '09:00', '10:00'), // hors période
  ];
  const s = statistiquesAgenda(liste, new Date(horodatage('2026-10-07', '12:00')), 2);

  it('heures de consultation par semaine, hors absences et annulations', () => {
    expect(s.semaines).toEqual([
      { lundi: '2026-09-28', heures: 2.5 },
      { lundi: '2026-10-05', heures: 1 },
    ]);
    expect(s.heuresConsultation).toBe(3.5);
  });

  it('taux d’absence (rendez-vous passés) et d’annulation (tous)', () => {
    expect(s.nbRendezVous).toBe(4);
    expect(s.nbAbsences).toBe(1);
    expect(s.tauxAbsence).toBe(0.25);
    expect(s.nbAnnulations).toBe(1);
    expect(s.tauxAnnulation).toBeCloseTo(1 / 6);
  });

  it('répartition par type, par modalité et créneaux les plus demandés', () => {
    expect(s.parCategorie.find((x) => x.categorie === 'seance')).toEqual({ categorie: 'seance', nb: 3, heures: 3 });
    expect(s.parCategorie.find((x) => x.categorie === 'bilan')).toEqual({ categorie: 'bilan', nb: 1, heures: 1.5 });
    expect(s.parCategorie.find((x) => x.categorie === 'administratif')?.nb).toBe(1);
    expect(s.parModalite.find((x) => x.modalite === 'cabinet')?.nb).toBe(3);
    expect(s.parModalite.find((x) => x.modalite === 'visio')?.nb).toBe(1);
    expect(s.creneaux).toContainEqual({ jour: 4, heure: 17, nb: 2 }); // jeudi 17 h : c et f
    expect(s.creneaux).toContainEqual({ jour: 2, heure: 9, nb: 1 });
    expect(s.creneaux.some((c) => c.jour === 5)).toBe(false); // vendredi : seulement l'annulé
  });

  it('sans rendez-vous : taux inconnus, pas de division par zéro', () => {
    const vide = statistiquesAgenda([], new Date(horodatage('2026-10-07', '12:00')), 4);
    expect(vide.semaines).toHaveLength(4);
    expect(vide.tauxAbsence).toBeNull();
    expect(vide.tauxAnnulation).toBeNull();
  });
});

describe('tâches personnelles, « plus tard » et récapitulatif de la semaine', () => {
  it('tâches personnelles : échues dans l’ordre d’urgence, sans échéance en dernier', () => {
    const perso = [
      tachePerso('x1', { echeance: '2026-09-18' }),
      tachePerso('x2'),
      tachePerso('x3', { echeance: '2026-09-25' }), // pas encore
      tachePerso('x4', { echeance: '2026-09-10', faite_le: '2026-09-11T10:00:00Z' }), // faite
      tachePerso('x5', { client_id: 'corbeille' }), // client à la corbeille
    ];
    const taches = calculerTaches([client()], [], p, '2026-09-20', [], '2026-09-20T10:00:00Z', perso);
    expect(taches.map((t) => t.cle)).toEqual(['p-x1', 'r-c1-1', 'p-x2']);
    expect(taches[0]).toMatchObject({ type: 'perso', retardJours: 2, client: null });
    expect(taches.map(familleTache)).toEqual(['perso', 'relances', 'perso']);
    expect(titreTache(taches[0])).toBe('Tâche x1');
    expect(titreTache(taches[1])).toBe('Relancer Léa Martin');
    expect(resumeDuJour(taches)).toBe('1 relance à envoyer · 2 tâches personnelles');
  });

  it('une tâche reportée disparaît jusqu’à la date choisie, puis revient', () => {
    const taches = calculerTaches([client()], [], p, '2026-09-20');
    const reports = [{ cle: 'r-c1-1', jusqua: '2026-09-23' }];
    expect(separerReportees(taches, reports, '2026-09-20')).toEqual({
      actives: [],
      reportees: [{ tache: taches[0], jusqua: '2026-09-23' }],
    });
    // le jour venu, le report est échu
    expect(separerReportees(taches, reports, '2026-09-23').actives).toHaveLength(1);
    // une autre relance (rang suivant) n'est pas concernée par le report
    expect(separerReportees(taches, [{ cle: 'r-c1-2', jusqua: '2026-12-01' }], '2026-09-20').actives).toHaveLength(1);
  });

  it('récapitulatif du lundi au dimanche', () => {
    const r = recapSemaine(
      '2026-10-07',
      [client({ derniere_seance: '2026-09-20' }), client({ id: 'c2', derniere_seance: '2026-10-01' })],
      [envoi({ client_id: 'autre' }), envoi({ id: 'e2', client_id: 'autre', expire_le: '2026-10-02T00:00:00Z' })],
      [
        rdv('e', '2026-10-05', '17:00', '18:00', { statut: 'prevu' }),
        rdv('f', '2026-10-08', '17:00', '18:30', { statut: 'prevu', categorie: 'bilan' }),
        rdv('g', '2026-10-06', '13:00', '14:00', { client_id: null, categorie: 'administratif' }),
        rdv('x', '2026-10-09', '09:00', '10:00', { statut: 'annule' }),
        rdv('y', '2026-10-12', '09:00', '10:00', { statut: 'prevu' }), // semaine suivante
      ],
      [
        tachePerso('t1', { echeance: '2026-10-09' }),
        tachePerso('t2', { echeance: '2026-10-12' }),
        tachePerso('t3', { echeance: '2026-10-06', faite_le: '2026-10-06T08:00:00Z' }),
        tachePerso('t4'),
      ],
      p,
      '2026-10-07T10:00:00Z',
    );
    expect(r.lundi).toBe('2026-10-05');
    expect(r.dimanche).toBe('2026-10-11');
    expect(r.rdv).toEqual({
      total: 3,
      heures: 3.5,
      parCategorie: { premier: 0, seance: 1, bilan: 1, administratif: 1, personnel: 0 },
    });
    expect(r.relances.map((x) => [x.client.id, x.echeance])).toEqual([['c1', '2026-10-05']]);
    expect(r.questionnairesEnAttente).toBe(1);
    expect(r.tachesPerso.map((x) => x.id)).toEqual(['t1']);
  });
});

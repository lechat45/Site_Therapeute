// Cartes de l'onglet Tâches, une par type de tâche calculée
// (domaine/taches.ts) : rendez-vous (rappel, à compléter), questionnaire
// reçu, relance, exercice complété, exercice à rappeler, tâche personnelle ;
// menu « Plus tard » et liste des tâches reportées. Chaque carte affiche un
// pictogramme et un libellé : jamais la couleur seule.

import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MODELE_LECTURE_LOCALE } from '../../supabase/functions/_shared/questionnaire.ts';
import { Icone } from './Icone';
import { categorie, MODALITES } from '../config/agenda';
import { heureLisible, jourDe } from '../domaine/agenda';
import { dateDuJour, dateHeure, dateLongue, jourLisible } from '../domaine/format';
import { titreTache, type Tache } from '../domaine/taches';
import type { CanalEnvoi, Recurrence, StatutRdv } from '../domaine/types';
import { Lecture } from './LectureQuestionnaire';
import { RECURRENCES } from '../config/taches';

export type TacheRdv = Extract<Tache, { type: 'rappel' | 'cloture' }>;
export type TacheSuivi = Extract<Tache, { type: 'questionnaire' | 'relance' }>;
export type TacheMienne = Extract<Tache, { type: 'perso' }>;
export type TacheExercice = Extract<Tache, { type: 'exercice' }>;
export type TacheRappelExercice = Extract<Tache, { type: 'rappel_exercice' }>;

/** « Plus tard » : la tâche disparaît et revient ce jour-là. */
const DELAIS = [
  { jours: 1, libelle: 'Demain' },
  { jours: 3, libelle: 'Dans 3 jours' },
  { jours: 7, libelle: 'Dans une semaine' },
];

/** Rappel à envoyer, ou rendez-vous passé à compléter. */
export function CarteRendezVous({
  tache: t,
  couleur,
  rappeler,
  cloturer,
  ouvrir,
  plusTard,
}: {
  tache: TacheRdv;
  couleur: string;
  rappeler: (canal: CanalEnvoi) => void;
  cloturer: (statut: StatutRdv) => void;
  ouvrir: () => void;
  plusTard: ReactNode;
}) {
  const nom = `${t.client.prenom} ${t.client.nom}`;
  const cat = categorie(t.rdv.categorie);
  const jour = new Date(t.rdv.debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const quand = `${jourDe(t.rdv.debut) === dateDuJour() ? "aujourd'hui" : jour} à ${heureLisible(t.rdv.debut)}`;
  return (
    <article className={`carte tache tache-rdv pave-${t.rdv.categorie}`} style={{ '--c': couleur } as CSSProperties}>
      <span className="tache-icone" aria-hidden>
        <Icone nom={t.type === 'rappel' ? 'cloche' : 'calendrier'} />
      </span>
      <div className="tache-texte">
        <h3>
          {t.type === 'rappel'
            ? `Rappeler le rendez-vous de ${nom}`
            : `Rendez-vous de ${nom} : comment s’est-il passé ?`}
        </h3>
        <p className="meta">
          <span className="puce-categorie">
            <span className="legende-pastille" aria-hidden />
            <Icone nom={cat.icone} taille={12} /> {cat.libelle}
          </span>{' '}
          {quand} · {MODALITES[t.rdv.modalite].libelle.toLowerCase()}
        </p>
      </div>
      <div className="actions">
        {t.type === 'rappel' ? (
          t.canaux.map((canal) => (
            <button
              key={canal}
              className={`bouton ${canal === t.canaux[0] ? 'bouton-principal' : ''}`}
              onClick={() => rappeler(canal)}
            >
              <Icone nom={canal === 'email' ? 'courriel' : 'sms'} taille={16} />
              {canal === 'email' ? 'Rappel par e-mail' : 'Rappel par SMS'}
            </button>
          ))
        ) : (
          <>
            <button className="bouton bouton-principal" onClick={() => cloturer('honore')}>
              <Icone nom="crayon" taille={16} /> Séance faite : remplir la fiche
            </button>
            <button className="bouton" onClick={() => cloturer('absent')}>
              <Icone nom="info" taille={16} /> Absent(e)
            </button>
            <button className="bouton" onClick={() => cloturer('annule')}>
              <Icone nom="croix" taille={16} /> Annulé
            </button>
          </>
        )}
        {plusTard}
        <button className="bouton-lien" onClick={ouvrir}>
          Détails
        </button>
      </div>
    </article>
  );
}

export function CarteTache({
  tache: t,
  iaProposee,
  iaEnCours,
  preparer,
  arreter,
  noterAccord,
  voir,
  lireAvecIA,
  ouvrirFiche,
  plusTard,
}: {
  tache: TacheSuivi;
  iaProposee: boolean;
  iaEnCours: boolean;
  preparer: (canal: CanalEnvoi) => void;
  arreter: () => void;
  noterAccord: () => void;
  voir: () => void;
  lireAvecIA: () => void;
  ouvrirFiche: () => void;
  plusTard: ReactNode;
}) {
  const nom = `${t.client.prenom} ${t.client.nom}`;
  if (t.type === 'questionnaire') {
    const urgent = t.lecture.priorite === 'haute';
    return (
      <article className={`carte tache tache-questionnaire${urgent ? ' tache-urgente' : ''}`}>
        <span className="tache-icone" aria-hidden>
          <Icone nom="cloche" />
        </span>
        <div className="tache-texte">
          <h3>Questionnaire reçu de {nom}</h3>
          <p className="meta">
            {t.envoi.questionnaire.titre ? `« ${t.envoi.questionnaire.titre} » · ` : ''}rempli le{' '}
            {dateHeure(t.envoi.repondu_le)}
          </p>
          <Lecture lecture={t.lecture} />
        </div>
        <div className="actions">
          <button className="bouton bouton-principal" onClick={voir}>
            Voir les réponses
          </button>
          {iaProposee && t.lecture.modele === MODELE_LECTURE_LOCALE && (
            <button className="bouton bouton-doux" onClick={lireAvecIA} disabled={iaEnCours}>
              <Icone nom="etincelles" taille={16} /> {iaEnCours ? 'Lecture…' : 'Lecture IA'}
            </button>
          )}
          <button className="bouton" onClick={ouvrirFiche}>
            Fiche client
          </button>
          {plusTard}
        </div>
      </article>
    );
  }

  return (
    <article className={`carte tache${t.prioritaire ? ' tache-urgente' : ''}`}>
      <span className="tache-icone" aria-hidden>
        <Icone nom="envoyer" />
      </span>
      <div className="tache-texte">
        <h3>Relancer {nom}</h3>
        <p className="meta">
          Dernière séance le {dateLongue(t.client.derniere_seance)} · relance {t.rang} sur {t.max}
          {t.retardJours > 0 && ` · prévue il y a ${t.retardJours} jour${t.retardJours > 1 ? 's' : ''}`}
        </p>
        {t.prioritaire && (
          <p>
            <span className="puce puce-danger">
              <Icone nom="cloche" taille={12} /> Prioritaire
            </span>{' '}
            <span className="meta">son dernier questionnaire appelait une attention particulière.</span>
          </p>
        )}
        {!t.client.accord_relance_le && (
          <p className="accord-manquant">
            <span className="puce puce-alerte">
              <Icone nom="info" taille={12} /> Accord non noté
            </span>{' '}
            <span className="meta">Le client a-t-il accepté d'être recontacté par e-mail ou SMS ?</span>{' '}
            <button className="bouton-lien" onClick={noterAccord}>
              Oui, noter son accord
            </button>
          </p>
        )}
      </div>
      <div className="actions">
        {t.canaux.length === 0 ? (
          <button className="bouton" onClick={ouvrirFiche}>
            <Icone nom="crayon" taille={16} /> Ajouter un e-mail ou un téléphone
          </button>
        ) : (
          t.canaux.map((canal) => (
            <button
              key={canal}
              className={`bouton ${canal === t.canaux[0] ? 'bouton-principal' : ''}`}
              onClick={() => preparer(canal)}
            >
              <Icone nom={canal === 'email' ? 'courriel' : 'sms'} taille={16} />
              {canal === 'email' ? "Préparer l'e-mail" : 'Préparer le SMS'}
            </button>
          ))
        )}
        {plusTard}
        <button className="bouton bouton-danger" onClick={arreter} title="Ne plus relancer ce client">
          Ne plus relancer
        </button>
      </div>
    </article>
  );
}

/** Menu « Plus tard » : demain, dans 3 jours ou dans une semaine. */
export function PlusTard({ titre, reporter }: { titre: string; reporter: (jours: number) => void }) {
  return (
    <details className="plus-tard">
      <summary className="bouton" aria-label={`Plus tard : ${titre}`}>
        <Icone nom="horloge" taille={16} /> Plus tard
      </summary>
      <div className="plus-tard-menu" role="group" aria-label="Faire réapparaître la tâche">
        {DELAIS.map((d) => (
          <button
            key={d.jours}
            type="button"
            className="bouton bouton-petit"
            onClick={(e) => {
              e.currentTarget.closest('details')?.removeAttribute('open');
              reporter(d.jours);
            }}
          >
            {d.libelle}
          </button>
        ))}
      </div>
    </details>
  );
}

/** Exercice à compléter rendu par le client. */
export function CarteExercice({
  tache: t,
  voir,
  ouvrirFiche,
  plusTard,
}: {
  tache: TacheExercice;
  voir: () => void;
  ouvrirFiche: () => void;
  plusTard: ReactNode;
}) {
  const remplies = (t.remise.reponses ?? []).filter((x) => x.reponse).length;
  const total = t.remise.reponses?.length ?? 0;
  return (
    <article className="carte tache tache-exercice">
      <span className="tache-icone" aria-hidden>
        <Icone nom="document" />
      </span>
      <div className="tache-texte">
        <h3>
          Exercice complété par {t.client.prenom} {t.client.nom}
        </h3>
        <p className="meta">
          « {t.remise.titre} » · {remplies} réponse{remplies > 1 ? 's' : ''} sur {total} · rendu le{' '}
          {dateHeure(t.remise.repondu_le)}
        </p>
      </div>
      <div className="actions">
        <button className="bouton bouton-principal" onClick={voir}>
          Voir les réponses
        </button>
        <button className="bouton" onClick={ouvrirFiche}>
          Fiche client
        </button>
        {plusTard}
      </div>
    </article>
  );
}

/** Exercice à compléter remis par lien, sans réponse depuis plusieurs jours. */
export function CarteRappelExercice({
  tache: t,
  rappeler,
  ouvrirFiche,
  plusTard,
}: {
  tache: TacheRappelExercice;
  rappeler: () => void;
  ouvrirFiche: () => void;
  plusTard: ReactNode;
}) {
  return (
    <article className="carte tache tache-rappel-exercice">
      <span className="tache-icone" aria-hidden>
        <Icone nom="horloge" />
      </span>
      <div className="tache-texte">
        <h3>
          Rappeler l'exercice à {t.client.prenom} {t.client.nom}
        </h3>
        <p className="meta">
          « {t.remise.titre} » · remis le {dateLongue(t.remise.cree_le)} · sans réponse depuis {t.joursAttente} jours
          {t.remise.ouvert_le ? ' (lien ouvert)' : ' (lien jamais ouvert)'}
        </p>
      </div>
      <div className="actions">
        {t.client.email || t.client.telephone ? (
          <button className="bouton bouton-principal" onClick={rappeler}>
            <Icone nom="envoyer" taille={16} /> Préparer le rappel
          </button>
        ) : (
          <button className="bouton" onClick={ouvrirFiche}>
            <Icone nom="crayon" taille={16} /> Ajouter un e-mail ou un téléphone
          </button>
        )}
        <button className="bouton" onClick={ouvrirFiche}>
          Fiche client
        </button>
        {plusTard}
      </div>
    </article>
  );
}

/** Pictogramme et libellé d'une tâche récurrente (jamais la couleur seule). */
export function PuceRecurrence({ recurrence }: { recurrence: Recurrence }) {
  if (recurrence === 'aucune') return null;
  return (
    <span className="puce puce-neutre">
      <Icone nom="retablir" taille={12} /> {RECURRENCES[recurrence].toLowerCase()}
    </span>
  );
}

/** Tâche personnelle échue ou sans échéance. */
export function CartePerso({
  tache: t,
  cocher,
  supprimer,
  plusTard,
}: {
  tache: TacheMienne;
  cocher: () => void;
  supprimer: () => void;
  plusTard: ReactNode;
}) {
  const retard = t.retardJours ?? 0;
  return (
    <article className={`carte tache tache-perso${retard > 0 ? ' tache-en-retard' : ''}`}>
      <span className="tache-icone" aria-hidden>
        <Icone nom="crayon" />
      </span>
      <div className="tache-texte">
        <h3>{t.tache.titre}</h3>
        <p className="meta">
          <span className="puce puce-neutre">
            <Icone nom="utilisateur" taille={12} /> Ma tâche
          </span>{' '}
          <PuceRecurrence recurrence={t.tache.recurrence} />{' '}
          {t.client && (
            <>
              <Link to={`/clients/${t.client.id}`}>
                {t.client.prenom} {t.client.nom}
              </Link>{' '}
              ·{' '}
            </>
          )}
          {t.retardJours === null
            ? 'sans échéance'
            : retard === 0
              ? "pour aujourd'hui"
              : `prévue le ${dateLongue(t.tache.echeance)} · ${retard} jour${retard > 1 ? 's' : ''} de retard`}
        </p>
      </div>
      <div className="actions">
        <button className="bouton bouton-principal" onClick={cocher}>
          <Icone nom="valider" taille={16} /> C'est fait
        </button>
        {plusTard}
        <button className="bouton-lien" onClick={supprimer}>
          Supprimer
        </button>
      </div>
    </article>
  );
}

/** Tâches mises de côté avec « Plus tard ». */
export function ListeReportees({
  reportees,
  retablir,
}: {
  reportees: { tache: Tache; jusqua: string }[];
  retablir: (t: Tache) => void;
}) {
  if (!reportees.length)
    return (
      <div className="carte vide">
        <Icone nom="horloge" taille={28} />
        <p>Aucune tâche reportée. « Plus tard » sur une tâche la met de côté quelques jours.</p>
      </div>
    );
  return (
    <ul className="carte liste-reportees">
      {[...reportees]
        .sort((a, b) => a.jusqua.localeCompare(b.jusqua))
        .map(({ tache, jusqua }) => (
          <li key={tache.cle}>
            <Icone nom="horloge" taille={16} />
            <span>
              <strong>{titreTache(tache)}</strong>
              <span className="meta"> · revient {jourLisible(jusqua)}</span>
            </span>
            <button className="bouton bouton-petit" onClick={() => retablir(tache)}>
              <Icone nom="retablir" taille={14} /> Remettre maintenant
            </button>
          </li>
        ))}
    </ul>
  );
}

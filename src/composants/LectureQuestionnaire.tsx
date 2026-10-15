// Questionnaire reçu : lecture (tendance, priorité, faits marquants,
// suggestion ; locale ou IA) et boîte de dialogue « Voir les réponses »
// avec le message envoyé. Utilisés par l'onglet Tâches.

import { Link } from 'react-router-dom';
import { MODELE_LECTURE_LOCALE } from '../../supabase/functions/_shared/questionnaire.ts';
import { Dialogue } from './Commun';
import { Icone, type NomIcone } from './Icone';
import { ReponsesQuestionnaire } from './ReponsesQuestionnaire';
import { StatutEnvoi } from './StatutEnvoi';
import { dateHeure } from '../domaine/format';
import { lireEnvoi } from '../domaine/taches';
import type { ClientResume, Envoi, LectureQuestionnaire } from '../domaine/types';

const TENDANCES: Record<LectureQuestionnaire['tendance'], { libelle: string; icone: NomIcone; classe: string }> = {
  premiere: { libelle: 'Premier questionnaire', icone: 'info', classe: 'puce-neutre' },
  amelioration: { libelle: 'En amélioration', icone: 'haut', classe: 'puce-succes' },
  stable: { libelle: 'Stable', icone: 'evolution', classe: 'puce-neutre' },
  degradation: { libelle: 'En baisse', icone: 'bas', classe: 'puce-danger' },
};

/** Lecture d'un questionnaire : tendance, priorité, faits marquants, suggestion. */
export function Lecture({ lecture: l }: { lecture: LectureQuestionnaire }) {
  const t = TENDANCES[l.tendance];
  const ia = l.modele !== MODELE_LECTURE_LOCALE;
  return (
    <div className="lecture">
      <div className="puces">
        {l.priorite === 'haute' && (
          <span className="puce puce-danger">
            <Icone nom="cloche" taille={12} /> À lire en priorité
          </span>
        )}
        <span className={`puce ${t.classe}`}>
          <Icone nom={t.icone} taille={12} /> {t.libelle}
        </span>
        <span className={`puce ${ia ? 'puce-ia' : 'puce-neutre'}`} title={ia ? `Modèle : ${l.modele}` : undefined}>
          {ia ? <Icone nom="etincelles" taille={12} /> : <Icone nom="document" taille={12} />}
          {ia ? 'Lecture IA' : 'Lecture automatique'}
        </span>
      </div>
      <p>{l.resume}</p>
      {l.points.length > 0 && (
        <ul className="tache-resume">
          {l.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <p className="lecture-suggestion">
        <Icone nom="chevron" taille={14} /> {l.suggestion}
      </p>
      <p className="meta lecture-rappel">
        Repérage automatique, à titre d'aide : il ne remplace pas la lecture des réponses.
      </p>
    </div>
  );
}

export function DialogueLecture({
  envoi: e,
  envois,
  client,
  fermer,
}: {
  envoi: Envoi;
  envois: Envoi[];
  client?: ClientResume;
  fermer: () => void;
}) {
  return (
    <Dialogue
      ouvert
      fermer={fermer}
      titre={client ? `${client.prenom} ${client.nom}` : 'Envoi'}
      pied={
        <>
          {client && (
            <Link className="bouton" to={`/clients/${client.id}`} onClick={fermer}>
              Fiche client
            </Link>
          )}
          <button className="bouton bouton-principal" onClick={fermer}>
            Fermer
          </button>
        </>
      }
    >
      <p className="meta">
        {e.canal === 'email' ? 'E-mail' : 'SMS'} à {e.destinataire} · envoyé le {dateHeure(e.envoye_le)} ·{' '}
        <StatutEnvoi envoi={e} />
      </p>
      {e.reponses && <Lecture lecture={lireEnvoi(e, envois)} />}
      {e.reponses && <ReponsesQuestionnaire envoi={e} />}
      <details open={!e.reponses}>
        <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Message envoyé</summary>
        {e.objet && (
          <p style={{ marginTop: 8 }}>
            <strong>Objet :</strong> {e.objet}
          </p>
        )}
        {e.corps ? (
          <p className="message-envoye">{e.corps}</p>
        ) : (
          <p className="meta" style={{ marginTop: 8 }}>
            Texte non enregistré : « J'ai envoyé le message » n'avait pas été cliqué, l'envoi a été confirmé par la
            réponse du client.
          </p>
        )}
      </details>
    </Dialogue>
  );
}

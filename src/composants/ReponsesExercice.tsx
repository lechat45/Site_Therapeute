// Réponses d'un client à un exercice à compléter. Les ouvrir les marque
// comme lues (la tâche « Exercice complété » disparaît).

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { donnees } from '../donnees';
import { dateHeure } from '../domaine/format';
import type { ClientResume, Remise } from '../domaine/types';
import { Dialogue } from './Commun';
import { Icone } from './Icone';

export function DialogueReponsesExercice({
  remise: r,
  client,
  fermer,
}: {
  remise: Remise;
  client?: Pick<ClientResume, 'id' | 'nom' | 'prenom'>;
  /** `true` si les réponses viennent d'être marquées comme lues. */
  fermer: (lues: boolean) => void;
}) {
  const nouvelles = !r.consulte_le;
  useEffect(() => {
    if (nouvelles) void donnees.marquerRemiseConsultee(r.id).catch(() => {});
  }, [r.id, nouvelles]);

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(nouvelles)}
      titre={`« ${r.titre} »`}
      pied={
        <>
          {client && (
            <Link className="bouton" to={`/clients/${client.id}`} onClick={() => fermer(nouvelles)}>
              Fiche client
            </Link>
          )}
          <button className="bouton bouton-principal" onClick={() => fermer(nouvelles)}>
            Fermer
          </button>
        </>
      }
    >
      <p className="meta">
        {client ? `${client.prenom} ${client.nom} · ` : ''}réponses envoyées le {dateHeure(r.repondu_le)}
      </p>
      <ol className="reponses-exercice">
        {(r.reponses ?? []).map((x, i) => (
          <li key={i}>
            <p className="reponse-question">{x.question}</p>
            {x.reponse ? (
              <p className="reponse-texte-libre">{x.reponse}</p>
            ) : (
              <p className="meta">
                <Icone nom="info" taille={12} /> Sans réponse
              </p>
            )}
          </li>
        ))}
      </ol>
    </Dialogue>
  );
}

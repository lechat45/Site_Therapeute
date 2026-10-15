// En tête de la fiche de séance : exercices rendus par le client depuis la
// séance précédente, pour les reprendre ensemble. Affichées ici, les
// réponses comptent comme lues (la tâche « Exercice complété » disparaît).

import { useEffect } from 'react';
import { donnees } from '../donnees';
import { exercicesRendus } from '../domaine/exercices';
import { dateHeure } from '../domaine/format';
import { useChargement } from '../etat/useChargement';
import { Icone } from './Icone';

export function ExercicesRendus({
  clientId,
  depuis,
  jusqua,
}: {
  clientId: string;
  /** Date de la séance précédente (exclue) ; `null` pour la première séance. */
  depuis: string | null;
  /** Date de cette séance (incluse) si ce n'est pas la dernière ; sinon `null`. */
  jusqua: string | null;
}) {
  const charge = useChargement(() => donnees.listerRemises(clientId), [clientId]);
  const rendus = exercicesRendus(charge.donnees ?? [], depuis, jusqua);
  const aMarquer = rendus.filter((r) => !r.consulte_le).map((r) => r.id);
  const cle = aMarquer.join(',');

  useEffect(() => {
    for (const id of aMarquer) void donnees.marquerRemiseConsultee(id).catch(() => {});
    // une seule fois par liste d'exercices à marquer
  }, [cle]);

  if (!rendus.length) return null;
  return (
    <section className="carte exercices-rendus" aria-labelledby="t-exercices-rendus">
      <div className="carte-entete">
        <div>
          <h2 id="t-exercices-rendus" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="document" /> {rendus.length > 1 ? `${rendus.length} exercices rendus` : 'Exercice rendu'}{' '}
            {depuis ? 'depuis la séance précédente' : 'avant cette séance'}
          </h2>
          <p className="aide">À reprendre ensemble pendant la séance.</p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
        {rendus.map((r) => (
          <details key={r.id} open={rendus.length === 1}>
            <summary>
              <strong>« {r.titre} »</strong> <span className="meta">· rendu le {dateHeure(r.repondu_le)}</span>
            </summary>
            <ol className="reponses-exercice">
              {(r.reponses ?? []).map((x, i) => (
                <li key={i}>
                  <p className="reponse-question">{x.question}</p>
                  {x.reponse ? (
                    <p className="reponse-texte-libre">{x.reponse}</p>
                  ) : (
                    <p className="meta">Sans réponse</p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}

// Réponses d'un client à un questionnaire, lues sur la COPIE des questions
// gardée avec l'envoi (pas sur le questionnaire actuel, qui a pu changer).

import { scoreNormalise } from '../../supabase/functions/_shared/questionnaire.ts';
import { dateHeure } from '../domaine/format';
import type { Envoi, Reponse } from '../domaine/types';

/** Réponses d'un questionnaire, lisibles d'un coup d'œil (tous types de questions). */
export function ReponsesQuestionnaire({ envoi }: { envoi: Envoi }) {
  if (!envoi.reponses) return null;
  return (
    <div className="reponses" aria-label={`Réponses du ${dateHeure(envoi.repondu_le)}`}>
      {envoi.reponses.map((r) => (
        <div key={r.question_id} className="reponse">
          <p className="reponse-question">{r.libelle}</p>
          <Valeur reponse={r} envoi={envoi} />
        </div>
      ))}
    </div>
  );
}

function Valeur({ reponse: r, envoi }: { reponse: Reponse; envoi: Envoi }) {
  const q = envoi.questions.find((x) => x.id === r.question_id);
  const v = r.valeur;
  if (v === null || (Array.isArray(v) && v.length === 0)) return <em className="meta">Pas de réponse</em>;

  if (r.type === 'etoiles' && typeof v === 'number') {
    const max = q?.maximum ?? 5;
    return (
      <p className="reponse-etoiles" aria-label={`${v} sur ${max}`}>
        {'★'.repeat(v)}
        <span aria-hidden>{'★'.repeat(Math.max(0, max - v))}</span>
      </p>
    );
  }
  if (r.type === 'curseur' && typeof v === 'number') {
    const min = q?.minimum ?? 0;
    const max = q?.maximum ?? 10;
    const part = q ? scoreNormalise({ ...q, sens: 'haut' }, v) : v / 10;
    return (
      <div className="reponse-curseur">
        <span className="mini-piste" aria-hidden>
          <span style={{ width: `${part * 100}%` }} />
        </span>
        <strong>
          {v}/{max}
        </strong>
        {q && q.sens === 'bas' && <span className="meta">(plus bas = mieux)</span>}
        {min !== 0 && (
          <span className="meta">
            échelle {min}–{max}
          </span>
        )}
      </div>
    );
  }
  if (typeof v === 'boolean') return <p className={`puce ${v ? 'puce-succes' : 'puce-neutre'}`}>{v ? 'Oui' : 'Non'}</p>;
  if (Array.isArray(v))
    return (
      <div className="puces">
        {v.map((x) => (
          <span key={x} className="puce">
            {x}
          </span>
        ))}
      </div>
    );
  if (r.type === 'choix_unique') return <p className="puce">{String(v)}</p>;
  return <p className="reponse-texte">« {String(v)} »</p>;
}

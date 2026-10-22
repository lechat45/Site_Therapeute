// Page ouverte par le client depuis le lien reçu : aucun compte, aucune
// donnée le concernant n'est affichée (seulement le nom du thérapeute).

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ReponseInvalide, validerReponses } from '../../supabase/functions/_shared/questionnaire.ts';
import { Chargement, Erreur, PiedPublic } from '../composants/Commun';
import { Icone } from '../composants/Icone';
import { EMOTIONS } from '../config/referentiels';
import { donnees } from '../donnees';
import { dateLongue, messageErreur } from '../domaine/format';
import type { QuestionEnvoyee, QuestionnairePublic as Questionnaire, ValeurReponse } from '../domaine/types';
import { appliquerTheme } from '../etat/reglages';

type Valeurs = Record<string, ValeurReponse>;

export function QuestionnairePublic() {
  const { jeton = '' } = useParams();
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enDefaut, setEnDefaut] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<Valeurs>({});
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(false);

  useEffect(() => {
    donnees.questionnairePublic(jeton).then(
      (r) => {
        setQ(r);
        if (r.couleur) appliquerTheme(r.couleur, r.nom_site ?? 'Questionnaire', false);
      },
      (e) => setErreur(messageErreur(e)),
    );
  }, [jeton]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!q?.valide) return;
    setErreur(null);
    setEnDefaut(null);
    // Mêmes règles que le serveur : on signale tout de suite la question à reprendre.
    try {
      validerReponses(q.questions, valeurs, q.emotions);
    } catch (err) {
      if (err instanceof ReponseInvalide) {
        setEnDefaut(err.questionId);
        setErreur(err.message.startsWith('Réponse manquante') ? 'Merci de répondre à cette question.' : err.message);
        document.getElementById(`question-${err.questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    setEnvoi(true);
    try {
      await donnees.repondreQuestionnaire(jeton, valeurs);
      setFini(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  if (!q && !erreur) return <Chargement texte="Ouverture du questionnaire…" />;

  return (
    <div className="page-publique">
      <div className="carte carte-publique questionnaire">
        <p className="marque-publique">
          <span className="marque-pastille" /> {q?.nom_site ?? 'Questionnaire de suivi'}
        </p>

        {erreur && !q?.valide && <Erreur message={erreur} />}

        {q && !q.valide && (
          <div className="vide" style={{ padding: '24px 0' }}>
            <Icone nom={q.raison === 'deja_repondu' ? 'valider' : 'cadenas'} taille={30} />
            <h1 style={{ fontSize: '1.3rem', color: 'var(--encre)' }}>
              {q.raison === 'deja_repondu'
                ? 'Ce questionnaire a déjà été rempli'
                : q.raison === 'expire'
                  ? 'Ce lien a expiré'
                  : q.raison === 'non_envoye'
                    ? "Ce lien n'est pas encore actif"
                    : 'Lien introuvable'}
            </h1>
            <p>
              {q.raison === 'deja_repondu'
                ? 'Merci, vos réponses ont bien été transmises.'
                : q.raison === 'non_envoye'
                  ? 'Réessayez dans quelques minutes. Si le problème persiste, prévenez votre thérapeute.'
                  : 'Demandez un nouveau lien à votre thérapeute.'}
            </p>
          </div>
        )}

        {q?.valide && fini && (
          <div className="vide" style={{ padding: '24px 0' }}>
            <span className="merci" aria-hidden>
              <Icone nom="valider" taille={34} />
            </span>
            <h1 style={{ fontSize: '1.4rem', color: 'var(--encre)' }}>Réponses envoyées</h1>
            <p style={{ whiteSpace: 'pre-line' }}>
              {q.remerciement || `Vos réponses ont été transmises à ${q.therapeute}.`} Vous pouvez fermer cette page.
            </p>
          </div>
        )}

        {q?.valide && !fini && (
          <form onSubmit={valider} style={{ display: 'grid', gap: 22 }} noValidate>
            <div>
              <h1 style={{ fontSize: '1.45rem' }}>{q.titre}</h1>
              <p className="meta" style={{ marginTop: 6, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                Proposé par <strong style={{ color: 'var(--encre)' }}>{q.therapeute}</strong>. {q.introduction}
              </p>
              <p className="meta" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                Lien valable jusqu'au {dateLongue(q.expire_le)}. Les questions marquées « facultative » peuvent rester
                sans réponse.
              </p>
            </div>

            {q.questions.map((question, i) => (
              <QuestionPublique
                key={question.id}
                numero={i + 1}
                question={question}
                emotions={q.emotions}
                valeur={valeurs[question.id] ?? null}
                enDefaut={enDefaut === question.id ? erreur : null}
                changer={(v) => {
                  setValeurs((x) => ({ ...x, [question.id]: v }));
                  if (enDefaut === question.id) {
                    setEnDefaut(null);
                    setErreur(null);
                  }
                }}
              />
            ))}

            {erreur && !enDefaut && <Erreur message={erreur} />}
            <button className="bouton bouton-principal bouton-grand" type="submit" disabled={envoi}>
              {envoi ? 'Envoi…' : 'Envoyer mes réponses'}
            </button>
          </form>
        )}
      </div>
      <PiedPublic />
    </div>
  );
}

/** Une question, quel que soit son type ; réutilisée par l'aperçu de l'éditeur. */
export function QuestionPublique({
  numero,
  question: q,
  valeur,
  changer,
  emotions = EMOTIONS.map((e) => e.libelle),
  enDefaut = null,
}: {
  numero: number;
  question: QuestionEnvoyee;
  valeur: ValeurReponse;
  changer: (v: ValeurReponse) => void;
  emotions?: string[];
  /** Message à afficher sous la question à reprendre. */
  enDefaut?: string | null;
}) {
  const id = `q-${q.id}`;
  const liste = Array.isArray(valeur) ? valeur : [];
  const basculer = (x: string) => changer(liste.includes(x) ? liste.filter((y) => y !== x) : [...liste, x]);

  return (
    <fieldset id={`question-${q.id}`} className={`question-publique${enDefaut ? ' question-en-defaut' : ''}`}>
      <legend>
        <span className="numero-question">{numero}</span>
        <span>
          {q.libelle}
          {!q.obligatoire && <span className="facultative"> · facultative</span>}
        </span>
      </legend>
      {q.aide && <p className="aide-question">{q.aide}</p>}
      {enDefaut && (
        <p className="erreur-champ" role="alert" style={{ clear: 'both' }}>
          <Icone nom="info" taille={15} /> {enDefaut}
        </p>
      )}

      {q.type === 'curseur' && (
        <div className={`curseur-public${valeur === null ? ' non-repondu' : ''}`}>
          <output htmlFor={id} className="valeur-curseur">
            {valeur === null ? (
              <span className="invite-curseur">Faites glisser pour répondre</span>
            ) : (
              <>
                {String(valeur)}
                <small>/{q.maximum}</small>
              </>
            )}
          </output>
          <input
            id={id}
            type="range"
            min={q.minimum}
            max={q.maximum}
            step={1}
            value={typeof valeur === 'number' ? valeur : Math.round((q.minimum + q.maximum) / 2)}
            onChange={(e) => changer(Number(e.target.value))}
            onClick={(e) => valeur === null && changer(Number((e.target as HTMLInputElement).value))}
            aria-valuetext={valeur === null ? 'pas encore de réponse' : `${valeur} sur ${q.maximum}`}
          />
          <div className="reperes-curseur" aria-hidden>
            <span>
              {q.minimum}
              {q.libelle_min && ` · ${q.libelle_min}`}
            </span>
            <span>
              {q.libelle_max && `${q.libelle_max} · `}
              {q.maximum}
            </span>
          </div>
        </div>
      )}

      {q.type === 'etoiles' && (
        <div className="etoiles" role="radiogroup" aria-label={q.libelle}>
          {Array.from({ length: q.maximum }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={valeur === n}
              aria-label={`${n} sur ${q.maximum}`}
              className={typeof valeur === 'number' && n <= valeur ? 'allumee' : ''}
              onClick={() => changer(valeur === n ? null : n)}
            >
              <Icone nom="etoile" taille={q.maximum > 6 ? 24 : 30} />
            </button>
          ))}
        </div>
      )}

      {q.type === 'oui_non' && (
        <div className="choix-oui-non" role="radiogroup" aria-label={q.libelle}>
          {[true, false].map((b) => (
            <button
              key={String(b)}
              type="button"
              role="radio"
              aria-checked={valeur === b}
              className={`choix-bouton${valeur === b ? ' choisi' : ''}`}
              onClick={() => changer(valeur === b ? null : b)}
            >
              {b ? 'Oui' : 'Non'}
            </button>
          ))}
        </div>
      )}

      {(q.type === 'choix_unique' || q.type === 'choix_multiple') && (
        <div className="choix-liste" role={q.type === 'choix_unique' ? 'radiogroup' : 'group'} aria-label={q.libelle}>
          {q.options.map((o) => {
            const coche = q.type === 'choix_unique' ? valeur === o : liste.includes(o);
            return (
              <label key={o} className={`choix-ligne${coche ? ' choisi' : ''}`}>
                <input
                  type={q.type === 'choix_unique' ? 'radio' : 'checkbox'}
                  name={id}
                  checked={coche}
                  onChange={() => (q.type === 'choix_unique' ? changer(o) : basculer(o))}
                />
                <span>{o}</span>
              </label>
            );
          })}
          {q.type === 'choix_multiple' && <span className="aide-question">Plusieurs choix possibles.</span>}
        </div>
      )}

      {q.type === 'emotions' && (
        <div className="choix-emotions" role="group" aria-label={q.libelle}>
          {emotions.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={liste.includes(e)}
              className={`puce-choix${liste.includes(e) ? ' choisi' : ''}`}
              onClick={() => basculer(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {q.type === 'texte' && (
        <textarea
          id={id}
          rows={3}
          maxLength={2000}
          aria-label={q.libelle}
          value={typeof valeur === 'string' ? valeur : ''}
          onChange={(e) => changer(e.target.value)}
          placeholder={q.obligatoire ? 'Votre réponse' : 'Votre réponse (facultative)'}
        />
      )}
    </fieldset>
  );
}

// Intelligence artificielle : une seule clé Gemini pour toute la plateforme,
// donc une consommation volontairement sobre (appels à la demande, quota
// quotidien par thérapeute). Sans Gemini, tout continue de fonctionner
// grâce aux lectures locales.

import { Link } from 'react-router-dom';
import { useState } from 'react';
import { GEMINI_MODELE_PAR_DEFAUT } from '../../../supabase/functions/_shared/analyse.ts';
import { useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { donnees } from '../../donnees';
import { cleGeminiDemo } from '../../donnees/cleDemo';
import { messageErreur } from '../../domaine/format';
import type { Parametres } from '../../domaine/types';
import { useReglages } from '../../etat/reglages';
import { useChargement } from '../../etat/useChargement';

export function OngletIA() {
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();
  const quota = useChargement(() => donnees.quotaIA(), [parametres.ia_quota_jour]);
  const [quotaSaisi, setQuotaSaisi] = useState(String(parametres.ia_quota_jour));

  async function changer(champs: Partial<Parametres>, message: string) {
    try {
      await enregistrer(champs);
      notifier(message);
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  const q = quota.donnees;
  const part = q && q.max > 0 ? Math.min(1, q.utilise / q.max) : 0;

  return (
    <>
      <section className="carte" aria-labelledby="t-ia">
        <div className="carte-entete">
          <div>
            <h2 id="t-ia" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="etincelles" /> Assistant IA
            </h2>
            <p className="aide">
              L'IA ne s'appelle jamais toute seule : uniquement quand vous cliquez sur « Analyser » (séance) ou «
              Lecture IA » (tâches). Sans Gemini, une lecture locale prend le relais.
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 18 }}>
          <ul className="liste-points" style={{ display: 'grid', gap: 6 }}>
            <li>
              <strong>Fiche de séance</strong> : catégorise la problématique et met à jour la synthèse évolutive du
              client.
            </li>
            <li>
              <strong>Tâches</strong> : résume un questionnaire reçu, compare avec le précédent et propose une action.
              Les priorités (dégradation, scores bas, mots de détresse) sont toujours calculées localement, même sans
              IA.
            </li>
            <li>Le nom et le prénom du client sont retirés des textes avant tout envoi à Gemini.</li>
            {/* RGPD : transfert possible hors de l'Union européenne (docs/RGPD.md, sous-traitants) */}
            <li>
              Gemini est un service de Google qui peut traiter les textes hors de l’Union européenne : informez vos
              clients (la <Link to="/confidentialite">politique de confidentialité</Link> le mentionne) et n’écrivez
              dans vos notes aucun autre élément qui les identifierait.
            </li>
          </ul>

          <label className="interrupteur">
            <input
              type="checkbox"
              checked={parametres.ia_taches}
              onChange={(e) =>
                changer(
                  { ia_taches: e.target.checked },
                  e.target.checked ? 'Lecture IA activée dans les tâches.' : 'Tâches : lecture locale uniquement.',
                )
              }
            />
            <span>Proposer la lecture IA des questionnaires dans l'onglet Tâches</span>
          </label>

          <div className="champ">
            <label htmlFor="ia-quota">Appels Gemini par jour, au plus</label>
            <div className="champ-unite">
              <input
                id="ia-quota"
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={quotaSaisi}
                onChange={(e) => setQuotaSaisi(e.target.value)}
                onBlur={() => {
                  const n = Math.max(0, Math.min(200, Math.round(Number(quotaSaisi) || 0)));
                  setQuotaSaisi(String(n));
                  if (n !== parametres.ia_quota_jour) void changer({ ia_quota_jour: n }, 'Quota enregistré.');
                }}
              />
              appels (0 = jamais Gemini)
            </div>
            <span className="indication">
              La clé Gemini est partagée par toute la plateforme : ce plafond évite qu'un seul compte l'épuise. Une fois
              atteint, l'analyse locale est utilisée jusqu'au lendemain.
            </span>
          </div>

          {q && (
            <div
              className="jauge-quota"
              role="img"
              aria-label={`${q.utilise} appels utilisés sur ${q.max} aujourd'hui`}
            >
              <div className="jauge-quota-entete">
                <span>Aujourd'hui</span>
                <strong>
                  {q.utilise} / {q.max}
                </strong>
              </div>
              <span className="mini-piste" aria-hidden>
                <span style={{ width: `${part * 100}%` }} />
              </span>
            </div>
          )}
          {q?.plateforme_epuisee && (
            <p className="alerte" role="status">
              <Icone nom="info" /> Le plafond commun de la plateforme est atteint pour aujourd'hui : l'analyse locale
              est utilisée jusqu'à demain.
            </p>
          )}
        </div>
      </section>

      <section className="carte" aria-labelledby="t-cle">
        <div className="carte-entete">
          <h2 id="t-cle" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="cle" /> Clé Gemini
          </h2>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
          {donnees.mode === 'supabase' ? (
            <div className="alerte">
              <Icone nom="bouclier" />
              <span>
                La clé API Gemini est un <strong>secret du serveur</strong> (fonction Edge <code>assistant-ia</code>,
                secret <code>GEMINI_API_KEY</code>) : elle n'est jamais transmise au navigateur. Modèle :{' '}
                {GEMINI_MODELE_PAR_DEFAUT} (secret <code>GEMINI_MODEL</code> pour en changer).
              </span>
            </div>
          ) : (
            <CleDemo />
          )}
        </div>
      </section>
    </>
  );
}

function CleDemo() {
  const notifier = useNotifier();
  const [cle, setCle] = useState(cleGeminiDemo.lire() ?? '');
  const [cleEnregistree, setCleEnregistree] = useState(Boolean(cleGeminiDemo.lire()));
  return (
    <>
      <p style={{ fontSize: '0.9rem', color: 'var(--encre-2)' }}>
        Sans clé, l'assistant fonctionne en <strong>lecture locale</strong> (repérage par mots-clés et comparaison des
        réponses). Pour essayer Gemini sur les données fictives, collez une clé API ci-dessous : elle reste dans cet
        onglet du navigateur et disparaît à sa fermeture.
      </p>
      <div className="champ">
        <label htmlFor="p-cle">Clé API Gemini (démonstration uniquement)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="p-cle"
            type="password"
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            style={{ flex: '1 1 260px' }}
          />
          <button
            className="bouton bouton-principal"
            onClick={() => {
              cleGeminiDemo.ecrire(cle);
              setCleEnregistree(Boolean(cle.trim()));
              notifier(cle.trim() ? 'Clé enregistrée pour cet onglet.' : 'Clé effacée.');
            }}
          >
            Utiliser
          </button>
          {cleEnregistree && (
            <button
              className="bouton"
              onClick={() => {
                cleGeminiDemo.ecrire(null);
                setCle('');
                setCleEnregistree(false);
                notifier('Clé effacée : retour à la lecture locale.');
              }}
            >
              Effacer
            </button>
          )}
        </div>
        <span className="indication">
          Modèle : {GEMINI_MODELE_PAR_DEFAUT}. En production, la clé est un secret du serveur et ne passe jamais par le
          navigateur.
        </span>
      </div>
    </>
  );
}

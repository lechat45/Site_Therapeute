// Fiche client : relances et questionnaires de suivi.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { donnees } from '../donnees';
import { dateCourte, dateDuJour, dateLongue, messageErreur } from '../domaine/format';
import { useReglages } from '../etat/reglages';
import { prochaineRelance } from '../domaine/taches';
import type { CanalEnvoi, Client, Envoi, Seance } from '../domaine/types';
import { useNotifier } from './Commun';
import { DialogueEnvoi } from './DialogueEnvoi';
import { Icone } from './Icone';
import { ReponsesQuestionnaire } from './ReponsesQuestionnaire';
import { StatutEnvoi } from './StatutEnvoi';

export function CarteSuiviClient({
  client,
  seances,
  envois,
  recharger,
}: {
  client: Client;
  seances: Seance[];
  envois: Envoi[];
  recharger: () => void;
}) {
  const { parametres } = useReglages();
  const notifier = useNotifier();
  const [canal, setCanal] = useState<CanalEnvoi | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(
    () => envois.find((e) => e.repondu_le && !e.consulte_le)?.id ?? null,
  );

  const resume = {
    ...client,
    nb_seances: seances.length,
    derniere_seance: seances.length ? seances[seances.length - 1].date_seance : null,
    problematiques: [],
  };
  const prochaine = prochaineRelance(resume, envois, parametres);

  async function basculerRelances(actives: boolean) {
    try {
      await donnees.modifierClient(client.id, { relances_actives: actives, relance_reportee_au: null });
      recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function noterAccord(oui: boolean) {
    try {
      await donnees.modifierClient(client.id, { accord_relance_le: oui ? dateDuJour() : null });
      recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function deplier(e: Envoi) {
    setOuvert(ouvert === e.id ? null : e.id);
    if (e.repondu_le && !e.consulte_le) {
      await donnees.marquerConsulte(e.id).catch(() => {});
      recharger();
    }
  }

  return (
    <section className="carte" aria-labelledby="t-suivi" id="questionnaires">
      <div className="carte-entete">
        <div>
          <h2 id="t-suivi" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="questionnaire" /> Relances et questionnaires
          </h2>
          <p className="aide">
            {!parametres.relances_actives
              ? 'Relances désactivées dans vos paramètres.'
              : !client.relances_actives
                ? 'Pas de relance pour ce client.'
                : prochaine
                  ? `Prochaine relance proposée le ${dateLongue(prochaine.echeance)} (${prochaine.rang} sur ${parametres.relance_max}).`
                  : seances.length
                    ? 'Toutes les relances prévues ont été envoyées.'
                    : 'Les relances commencent après la première séance.'}
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 12 }}>
        <label className="interrupteur interrupteur-petit">
          <input
            type="checkbox"
            checked={client.relances_actives}
            onChange={(e) => basculerRelances(e.target.checked)}
          />
          <span>Relancer ce client</span>
        </label>
        <label className="interrupteur interrupteur-petit">
          <input
            type="checkbox"
            checked={Boolean(client.accord_relance_le)}
            onChange={(e) => noterAccord(e.target.checked)}
          />
          <span>
            A accepté d'être recontacté(e) par e-mail ou SMS
            {client.accord_relance_le && (
              <span className="meta"> · noté le {dateCourte(client.accord_relance_le)}</span>
            )}
          </span>
        </label>
        {!client.accord_relance_le && client.relances_actives && (
          <p className="meta">Accord non noté : demandez-le avant de relancer (RGPD).</p>
        )}

        {client.email || client.telephone ? (
          <div className="actions">
            {client.email && (
              <button className="bouton bouton-doux" onClick={() => setCanal('email')}>
                <Icone nom="courriel" taille={16} /> Questionnaire par e-mail
              </button>
            )}
            {client.telephone && (
              <button className="bouton bouton-doux" onClick={() => setCanal('sms')}>
                <Icone nom="sms" taille={16} /> Par SMS
              </button>
            )}
          </div>
        ) : (
          <p className="meta">Ajoutez un e-mail ou un téléphone (bouton « Modifier ») pour envoyer le questionnaire.</p>
        )}

        {envois.filter((e) => e.envoye_le).length > 0 && (
          <ul className="liste-envois">
            {envois
              .filter((e) => e.envoye_le)
              .map((e) => (
                <li key={e.id}>
                  <button className="ligne-envoi" onClick={() => deplier(e)} aria-expanded={ouvert === e.id}>
                    <Icone nom={e.canal === 'email' ? 'courriel' : 'sms'} taille={15} />
                    <span>{dateCourte(e.envoye_le)}</span>
                    <StatutEnvoi envoi={e} />
                    {e.repondu_le && !e.consulte_le && <span className="puce puce-ia">Nouveau</span>}
                  </button>
                  {ouvert === e.id &&
                    (e.reponses ? (
                      <ReponsesQuestionnaire envoi={e} />
                    ) : (
                      <p className="meta" style={{ padding: '6px 4px' }}>
                        Pas encore de réponse. Lien valable jusqu'au {dateLongue(e.expire_le)}.
                      </p>
                    ))}
                </li>
              ))}
          </ul>
        )}
        <Link to="/taches" className="meta">
          Voir toutes les tâches →
        </Link>
      </div>

      {canal && (
        <DialogueEnvoi
          client={client}
          canal={canal}
          fermer={(envoye) => {
            setCanal(null);
            if (envoye) recharger();
          }}
        />
      )}
    </section>
  );
}

// Paramètres > Relances : rythme des relances après la dernière séance,
// validité des liens, rappel des exercices non rendus, modèles d'e-mail et
// de SMS avec aperçu.

import { useState } from 'react';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { PARAMETRES_PAR_DEFAUT, VARIABLES_MODELES } from '../../config/parametresDefaut';
import { dateLongue, messageErreur } from '../../domaine/format';
import { lienQuestionnaire, remplirModele } from '../../domaine/messages';
import { useReglages } from '../../etat/reglages';
import { useTherapeute } from '../../etat/session';
import type { Parametres } from '../../domaine/types';

type Champs = Pick<
  Parametres,
  | 'relances_actives'
  | 'relance_delai_jours'
  | 'relance_intervalle_jours'
  | 'relance_max'
  | 'lien_validite_jours'
  | 'modele_email_objet'
  | 'modele_email'
  | 'modele_sms'
  | 'exercice_rappel_jours'
>;

export function OngletRelances() {
  const { parametres, enregistrer } = useReglages();
  const t = useTherapeute();
  const notifier = useNotifier();
  const [f, setF] = useState<Champs>(() => ({
    relances_actives: parametres.relances_actives,
    relance_delai_jours: parametres.relance_delai_jours,
    relance_intervalle_jours: parametres.relance_intervalle_jours,
    relance_max: parametres.relance_max,
    lien_validite_jours: parametres.lien_validite_jours,
    modele_email_objet: parametres.modele_email_objet,
    modele_email: parametres.modele_email,
    modele_sms: parametres.modele_sms,
    exercice_rappel_jours: parametres.exercice_rappel_jours,
  }));
  const [apercu, setApercu] = useState<'email' | 'sms'>('email');
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = <K extends keyof Champs>(k: K, v: Champs[K]) => setF((x) => ({ ...x, [k]: v }));

  async function valider() {
    setErreur(null);
    if (!f.modele_email.includes('{lien}') || !f.modele_sms.includes('{lien}'))
      return setErreur('Chaque modèle doit contenir {lien}, sans quoi le client ne peut pas répondre.');
    try {
      await enregistrer(f);
      notifier('Relances enregistrées.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const exemple = {
    prenom: 'Léa',
    nom: 'Exemple',
    therapeute: `${t.prenom} ${t.nom}`.trim(),
    signature: parametres.signature,
    lien: lienQuestionnaire('…'),
    expiration: dateLongue(new Date(Date.now() + f.lien_validite_jours * 86_400_000).toISOString()),
    site: parametres.nom_site,
  };

  const nombre = (
    k: 'relance_delai_jours' | 'relance_intervalle_jours' | 'relance_max' | 'lien_validite_jours',
    min: number,
    max: number,
  ) => (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={f[k]}
      onChange={(e) => maj(k, Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      disabled={!f.relances_actives && k !== 'lien_validite_jours'}
    />
  );

  return (
    <>
      <section className="carte" aria-labelledby="t-rythme">
        <div className="carte-entete">
          <div>
            <h2 id="t-rythme" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="envoyer" /> Rythme des relances
            </h2>
            <p className="aide">
              Après la dernière séance d'un client, l'onglet Tâches vous propose de lui envoyer le questionnaire. Une
              nouvelle séance remet le compteur à zéro.
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 16 }}>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={f.relances_actives}
              onChange={(e) => maj('relances_actives', e.target.checked)}
            />
            <span>Me proposer des relances</span>
          </label>
          <div className="grille-reglages">
            <label className="champ">
              <span className="etiquette">Première relance</span>
              <span className="champ-unite">
                {nombre('relance_delai_jours', 1, 365)}
                <span>jours après la dernière séance</span>
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Puis tous les</span>
              <span className="champ-unite">
                {nombre('relance_intervalle_jours', 1, 365)}
                <span>jours</span>
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Au plus</span>
              <span className="champ-unite">
                {nombre('relance_max', 1, 20)}
                <span>relances</span>
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Lien valable</span>
              <span className="champ-unite">
                {nombre('lien_validite_jours', 1, 180)}
                <span>jours</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="carte" aria-labelledby="t-exercices">
        <div className="carte-entete">
          <div>
            <h2 id="t-exercices" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="document" /> Exercices à compléter
            </h2>
            <p className="aide">
              Quand un client n'a pas répondu à un exercice reçu par lien, l'onglet Tâches vous propose de le lui
              rappeler (nouveau lien, message préparé).
            </p>
          </div>
        </div>
        <div className="carte-corps">
          <label className="champ" style={{ maxWidth: 360 }}>
            <span className="etiquette">Proposer un rappel</span>
            <span className="champ-unite">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={f.exercice_rappel_jours}
                onChange={(e) => maj('exercice_rappel_jours', Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              />
              <span>jours après la remise (0 : jamais)</span>
            </span>
          </label>
        </div>
      </section>

      <section className="carte" aria-labelledby="t-modeles">
        <div className="carte-entete">
          <div>
            <h2 id="t-modeles" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="courriel" /> Modèles de messages
            </h2>
            <p className="aide">
              Le texte proposé à chaque relance. Vous pourrez encore le retoucher avant chaque envoi.
            </p>
          </div>
        </div>
        <div className="carte-corps grille-modeles">
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="champ">
              <label htmlFor="m-objet">Objet de l'e-mail</label>
              <input
                id="m-objet"
                maxLength={200}
                value={f.modele_email_objet}
                onChange={(e) => maj('modele_email_objet', e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor="m-email">E-mail</label>
              <textarea
                id="m-email"
                rows={10}
                value={f.modele_email}
                onChange={(e) => maj('modele_email', e.target.value)}
              />
            </div>
            <div className="champ">
              <label htmlFor="m-sms">SMS</label>
              <textarea id="m-sms" rows={3} value={f.modele_sms} onChange={(e) => maj('modele_sms', e.target.value)} />
              <span className="indication">
                Environ {remplirModele(f.modele_sms, exemple).length} caractères une fois rempli.
              </span>
            </div>
            <div className="variables">
              <span className="etiquette">Variables</span>
              <ul>
                {VARIABLES_MODELES.map((v) => (
                  <li key={v.cle}>
                    <code>{v.cle}</code> {v.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <button
                className="bouton-lien"
                onClick={() =>
                  setF((x) => ({
                    ...x,
                    modele_email_objet: PARAMETRES_PAR_DEFAUT.modele_email_objet,
                    modele_email: PARAMETRES_PAR_DEFAUT.modele_email,
                    modele_sms: PARAMETRES_PAR_DEFAUT.modele_sms,
                  }))
                }
              >
                Revenir aux textes d'origine
              </button>
            </div>
          </div>
          <div className="apercu-message">
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span className="etiquette">Aperçu (client fictif)</span>
              <div className="bascule-vue" role="group" aria-label="Aperçu">
                <button aria-pressed={apercu === 'email'} onClick={() => setApercu('email')}>
                  E-mail
                </button>
                <button aria-pressed={apercu === 'sms'} onClick={() => setApercu('sms')}>
                  SMS
                </button>
              </div>
            </div>
            {apercu === 'email' && <p className="apercu-objet">{remplirModele(f.modele_email_objet, exemple)}</p>}
            <p className={`message-envoye ${apercu === 'sms' ? 'bulle-sms' : ''}`}>
              {remplirModele(apercu === 'email' ? f.modele_email : f.modele_sms, exemple)}
            </p>
          </div>
        </div>
      </section>

      {erreur && <Erreur message={erreur} />}
      <div>
        <button className="bouton bouton-principal" onClick={valider}>
          Enregistrer les relances
        </button>
      </div>
    </>
  );
}

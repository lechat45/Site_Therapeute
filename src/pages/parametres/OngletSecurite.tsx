// Paramètres > Sécurité : mot de passe, double authentification (TOTP),
// délai de déconnexion automatique, journal des connexions.

import { useState, type FormEvent } from 'react';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { donnees } from '../../donnees';
import { dateHeure, messageErreur } from '../../domaine/format';
import { useReglages } from '../../etat/reglages';
import { LONGUEUR_MOT_DE_PASSE } from '../../domaine/securite';
import type { InscriptionMfa } from '../../domaine/types';
import { useChargement } from '../../etat/useChargement';

/** Mot de passe, double authentification, déconnexion automatique, journal. */
export function OngletSecurite() {
  return (
    <>
      <MotDePasse />
      <DoubleAuthentification />
      <Inactivite />
      <Journal />
    </>
  );
}

function MotDePasse() {
  const notifier = useNotifier();
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (nouveau !== confirmation) return setErreur('Les deux saisies du nouveau mot de passe diffèrent.');
    try {
      await donnees.changerMotDePasse(actuel, nouveau);
      setActuel('');
      setNouveau('');
      setConfirmation('');
      notifier('Mot de passe modifié.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <form className="carte" onSubmit={valider} aria-labelledby="t-mdp">
      <div className="carte-entete">
        <div>
          <h2 id="t-mdp">Mot de passe</h2>
          <p className="aide">
            Au moins {LONGUEUR_MOT_DE_PASSE} caractères, avec des lettres et des chiffres ou symboles.
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
        <div className="champ">
          <label htmlFor="m-actuel">Mot de passe actuel</label>
          <input
            id="m-actuel"
            type="password"
            autoComplete="current-password"
            value={actuel}
            onChange={(e) => setActuel(e.target.value)}
          />
        </div>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="m-nouveau">Nouveau mot de passe</label>
            <input
              id="m-nouveau"
              type="password"
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="m-conf">Confirmation</label>
            <input
              id="m-conf"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </div>
        {erreur && <Erreur message={erreur} />}
        <div>
          <button className="bouton bouton-principal" type="submit" disabled={!actuel || !nouveau}>
            Changer le mot de passe
          </button>
        </div>
      </div>
    </form>
  );
}

function DoubleAuthentification() {
  const notifier = useNotifier();
  const etat = useChargement(() => donnees.mfaActive(), []);
  const [inscription, setInscription] = useState<InscriptionMfa | null>(null);
  const [desactivation, setDesactivation] = useState(false);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  async function commencer() {
    setErreur(null);
    try {
      setInscription(await donnees.mfaCommencer());
      setCode('');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }
  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      if (inscription) {
        await donnees.mfaActiver(inscription.id, code);
        setInscription(null);
        notifier('Double authentification activée.');
      } else {
        await donnees.mfaDesactiver(code);
        setDesactivation(false);
        notifier('Double authentification désactivée.');
      }
      setCode('');
      etat.recharger();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const active = etat.donnees;
  return (
    <section className="carte" aria-labelledby="t-mfa">
      <div className="carte-entete">
        <div>
          <h2 id="t-mfa" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="cle" /> Double authentification
          </h2>
          <p className="aide">
            En plus du mot de passe, un code à 6 chiffres donné par une application (Google Authenticator, Microsoft
            Authenticator, 1Password…). Fortement conseillée pour des données de santé.
          </p>
        </div>
        {active !== undefined && (
          <span className={`puce ${active ? 'puce-succes' : 'puce-alerte'}`}>{active ? 'Activée' : 'Désactivée'}</span>
        )}
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
        {!inscription && !desactivation && (
          <div>
            {active ? (
              <button className="bouton bouton-danger" onClick={() => setDesactivation(true)}>
                Désactiver
              </button>
            ) : (
              <button className="bouton bouton-principal" onClick={commencer} disabled={active === undefined}>
                Activer
              </button>
            )}
          </div>
        )}
        {(inscription || desactivation) && (
          <form onSubmit={valider} style={{ display: 'grid', gap: 14 }}>
            {inscription && (
              <div className="mfa-inscription">
                <img
                  src={inscription.qr}
                  alt="QR code à scanner avec l'application d'authentification"
                  width={180}
                  height={180}
                />
                <div style={{ display: 'grid', gap: 8 }}>
                  <p>1. Scannez ce QR code avec votre application d'authentification.</p>
                  <p className="meta">
                    Ou saisissez la clé :{' '}
                    <code className="cle-mfa">{inscription.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
                  </p>
                  <p>2. Saisissez le code affiché pour confirmer.</p>
                </div>
              </div>
            )}
            {desactivation && <p>Saisissez un code de votre application pour confirmer la désactivation.</p>}
            <div className="champ" style={{ maxWidth: 220 }}>
              <label htmlFor="mfa-code">Code à 6 chiffres</label>
              <input
                id="mfa-code"
                className="champ-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
              />
            </div>
            {erreur && <Erreur message={erreur} />}
            <div className="actions">
              <button className="bouton bouton-principal" type="submit" disabled={code.replace(/\s/g, '').length !== 6}>
                {inscription ? 'Activer' : 'Désactiver'}
              </button>
              <button
                className="bouton"
                type="button"
                onClick={() => {
                  setInscription(null);
                  setDesactivation(false);
                  setErreur(null);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        )}
        {!inscription && !desactivation && erreur && <Erreur message={erreur} />}
      </div>
    </section>
  );
}

function Inactivite() {
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();
  return (
    <section className="carte" aria-labelledby="t-inactivite">
      <div className="carte-entete">
        <div>
          <h2 id="t-inactivite">Déconnexion automatique</h2>
          <p className="aide">
            Après une période sans activité, la session se ferme (appareil oublié, partagé ou volé).
          </p>
        </div>
      </div>
      <div className="carte-corps">
        <div className="champ" style={{ maxWidth: 280 }}>
          <label htmlFor="inact">Délai sans activité</label>
          <select
            id="inact"
            value={parametres.deconnexion_minutes}
            onChange={async (e) => {
              try {
                await enregistrer({ deconnexion_minutes: Number(e.target.value) });
                notifier('Délai enregistré.');
              } catch (err) {
                notifier(messageErreur(err), true);
              }
            }}
          >
            {[10, 15, 30, 60, 120, 240].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} heure${m > 60 ? 's' : ''}`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

function Journal() {
  const journal = useChargement(() => donnees.journalConnexions(), []);
  return (
    <section className="carte" aria-labelledby="t-journal">
      <div className="carte-entete">
        <div>
          <h2 id="t-journal">Dernières connexions</h2>
          <p className="aide">Une connexion que vous ne reconnaissez pas ? Changez votre mot de passe.</p>
        </div>
      </div>
      <div className="carte-corps" style={{ paddingTop: 6 }}>
        {journal.donnees?.length ? (
          <ul className="journal">
            {journal.donnees.map((j, i) => (
              <li key={j.le + i}>
                <span>{dateHeure(j.le)}</span>
                <span className="meta">{j.appareil}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">{journal.chargement ? 'Chargement…' : 'Aucune connexion enregistrée.'}</p>
        )}
      </div>
    </section>
  );
}

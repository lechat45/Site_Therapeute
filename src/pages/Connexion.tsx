// Connexion. Volontairement : ni création de compte, ni « mot de passe
// oublié ». Les comptes sont créés et réinitialisés par l'administrateur
// de la plateforme (scripts/comptes.mjs).

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Erreur } from '../composants/Commun';
import { Icone } from '../composants/Icone';
import { Presentation } from '../composants/Presentation';
import { donnees } from '../donnees';
import { EMAIL_DEMO, MOT_DE_PASSE_DEMO } from '../donnees/cleDemo';
import { messageErreur } from '../domaine/format';
import { themeMemorise } from '../etat/reglages';
import { DRAPEAU_ACCUEIL, useSession } from '../etat/session';

export function Connexion() {
  const { therapeute, ouvrir } = useSession();
  const naviguer = useNavigate();
  const depuis = (useLocation().state as { depuis?: string } | null)?.depuis ?? '/';
  const demo = donnees.mode === 'demo';
  const { nomSite } = themeMemorise();

  const [etape, setEtape] = useState<'identifiants' | 'code'>('identifiants');
  const [email, setEmail] = useState(demo ? EMAIL_DEMO : '');
  const [motDePasse, setMotDePasse] = useState(demo ? MOT_DE_PASSE_DEMO : '');
  const [code, setCode] = useState('');
  const [resterConnecte, setResterConnecte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (therapeute) return <Navigate to={depuis} replace />;

  const entrer = (t: Parameters<typeof ouvrir>[0]) => {
    if (depuis === '/')
      try {
        sessionStorage.setItem(DRAPEAU_ACCUEIL, '1');
      } catch {
        /* stockage indisponible : on reste sur le tableau de bord */
      }
    ouvrir(t);
    naviguer(depuis, { replace: true });
  };

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      if (etape === 'identifiants') {
        const r = await donnees.connexion(email, motDePasse, resterConnecte);
        if (r.etape === 'double_authentification') {
          setCode('');
          setEtape('code');
        } else entrer(r.therapeute);
      } else {
        entrer(await donnees.verifierCodeConnexion(code));
      }
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="connexion">
      <section className="connexion-visuel">
        <div className="marque" style={{ padding: 0 }}>
          <span className="marque-pastille" /> {nomSite}
        </div>
        <div>
          <h1>L'espace de suivi des thérapeutes comportementalistes émotionnels</h1>
          <ul>
            <li>
              <Icone nom="cadenas" />
              <span>Fiches clients numérisées, strictement privées : vous seul(e) y accédez.</span>
            </li>
            <li>
              <Icone nom="tableau" />
              <span>Vos statistiques : émotions, tranches d'âge, problématiques, durée des parcours.</span>
            </li>
            <li>
              <Icone nom="questionnaire" />
              <span>Relances et questionnaires de suivi : vos clients répondent en une minute.</span>
            </li>
            <li>
              <Icone nom="etincelles" />
              <span>Une synthèse évolutive et une lecture des questionnaires, avec ou sans IA.</span>
            </li>
          </ul>
          {/* Présentation détaillée du site, sans compte (config/presentation.ts) */}
          <button type="button" className="bouton bouton-decouvrir" onClick={() => setPresentation(true)}>
            <Icone nom="etoile" taille={16} /> Découvrir le site
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          Conçu pour le suivi en séances : parcours initial, bilan, séances complémentaires.
        </p>
      </section>

      <section className="connexion-formulaire">
        <form onSubmit={valider} noValidate>
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>{etape === 'code' ? 'Double authentification' : 'Connexion'}</h2>
            <p className="meta" style={{ marginTop: 4, fontSize: '0.9rem' }}>
              {etape === 'code'
                ? 'Saisissez le code à 6 chiffres affiché par votre application.'
                : 'Connectez-vous pour accéder à votre espace.'}
            </p>
          </div>

          {demo && etape === 'identifiants' && (
            <div className="alerte">
              <Icone nom="info" />
              <span>
                <strong>Mode démonstration.</strong> Données fictives conservées dans ce navigateur. Identifiants
                pré-remplis : {EMAIL_DEMO} / {MOT_DE_PASSE_DEMO}.
              </span>
            </div>
          )}

          {etape === 'code' ? (
            <div className="champ">
              <label htmlFor="c-code">Code à 6 chiffres</label>
              <input
                id="c-code"
                className="champ-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="champ">
                <label htmlFor="c-email">Adresse électronique</label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="champ">
                <label htmlFor="c-mdp">Mot de passe</label>
                <input
                  id="c-mdp"
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <label className="case-a-cocher">
                <input type="checkbox" checked={resterConnecte} onChange={(e) => setResterConnecte(e.target.checked)} />
                <span>
                  Rester connecté(e) 8 h sur cet appareil
                  <span className="meta"> — uniquement sur un appareil personnel</span>
                </span>
              </label>
            </>
          )}

          {erreur && <Erreur message={erreur} />}

          <button className="bouton bouton-principal" type="submit" disabled={envoi} style={{ minHeight: 46 }}>
            {envoi ? 'Patientez…' : etape === 'code' ? 'Valider le code' : 'Se connecter'}
          </button>

          {etape === 'code' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="bouton-lien"
                onClick={() => {
                  setEtape('identifiants');
                  setErreur(null);
                }}
              >
                ← Retour
              </button>
              {donnees.reinitialiserDemo && (
                <p className="meta">
                  Application d'authentification perdue ?{' '}
                  <button
                    type="button"
                    className="bouton-lien"
                    onClick={() => {
                      donnees.reinitialiserDemo?.();
                      setEtape('identifiants');
                      setErreur(null);
                    }}
                  >
                    Réinitialiser la démonstration
                  </button>{' '}
                  (données fictives d'origine, sans double authentification).
                </p>
              )}
            </div>
          ) : (
            <p className="meta">
              Pas de compte, ou mot de passe perdu ? Les comptes sont créés et réinitialisés par l'administrateur de la
              plateforme.
            </p>
          )}
        </form>
      </section>
      {presentation && <Presentation fermer={() => setPresentation(false)} />}
    </div>
  );
}

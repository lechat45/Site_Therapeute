// Paramètres : un onglet par fichier dans pages/parametres/ (profil,
// affichage, questionnaires, relances, emploi du temps, tarifs, sécurité,
// assistant IA) ; l'onglet Confidentialité est ici.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dialogue, useNotifier } from '../composants/Commun';
import { Icone, type NomIcone } from '../composants/Icone';
import { SEUIL_CLIENTS_PAR_CASE, SEUIL_THERAPEUTES } from '../config/referentiels';
import { donnees } from '../donnees';
import { OngletAffichage } from './parametres/OngletAffichage';
import { OngletEmploiDuTemps } from './parametres/OngletEmploiDuTemps';
import { OngletIA } from './parametres/OngletIA';
import { OngletProfil } from './parametres/OngletProfil';
import { OngletQuestionnaires } from './parametres/OngletQuestionnaires';
import { OngletRelances } from './parametres/OngletRelances';
import { OngletSecurite } from './parametres/OngletSecurite';
import { OngletTarifs } from './parametres/OngletTarifs';
import { ARGENT_VISIBLE } from '../config/fonctions';

/** Rubriques, dans l'ordre du menu ; `?onglet=<cle>` ouvre directement l'une d'elles. */
const ONGLETS: { cle: string; libelle: string; icone: NomIcone }[] = [
  { cle: 'profil', libelle: 'Mon profil', icone: 'utilisateur' },
  { cle: 'affichage', libelle: 'Affichage', icone: 'palette' },
  { cle: 'securite', libelle: 'Sécurité', icone: 'cadenas' },
  ...(ARGENT_VISIBLE ? [{ cle: 'tarifs', libelle: 'Tarifs', icone: 'euro' as const }] : []),
  { cle: 'agenda', libelle: 'Emploi du temps', icone: 'calendrier' },
  { cle: 'relances', libelle: 'Relances et messages', icone: 'envoyer' },
  { cle: 'questionnaires', libelle: 'Questionnaires', icone: 'questionnaire' },
  { cle: 'ia', libelle: 'Assistant IA', icone: 'etincelles' },
  { cle: 'confidentialite', libelle: 'Confidentialité', icone: 'bouclier' },
];

export function Parametres() {
  const [recherche, setRecherche] = useSearchParams();
  const onglet = ONGLETS.some((o) => o.cle === recherche.get('onglet')) ? recherche.get('onglet')! : 'profil';

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Paramètres</h1>
          <p className="sous-titre">Tout se règle ici, pour votre seul espace.</p>
        </div>
      </div>

      {/* Sur téléphone : une liste déroulante plutôt que 8 onglets à faire défiler */}
      <div className="champ choix-rubrique">
        <label htmlFor="p-rubrique">Rubrique</label>
        <select
          id="p-rubrique"
          value={onglet}
          onChange={(e) => setRecherche({ onglet: e.target.value }, { replace: true })}
        >
          {ONGLETS.map((o) => (
            <option key={o.cle} value={o.cle}>
              {o.libelle}
            </option>
          ))}
        </select>
      </div>

      <nav className="onglets-page" aria-label="Rubriques des paramètres">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            className="onglet-page"
            aria-current={onglet === o.cle ? 'page' : undefined}
            onClick={() => setRecherche({ onglet: o.cle }, { replace: true })}
          >
            <Icone nom={o.icone} taille={16} /> {o.libelle}
          </button>
        ))}
      </nav>

      <div className="page-etroite" style={{ display: 'grid', gap: 18, width: '100%', marginInline: 0 }}>
        {onglet === 'profil' && <OngletProfil />}
        {onglet === 'affichage' && <OngletAffichage />}
        {onglet === 'securite' && <OngletSecurite />}
        {ARGENT_VISIBLE && onglet === 'tarifs' && <OngletTarifs />}
        {onglet === 'agenda' && <OngletEmploiDuTemps />}
        {onglet === 'relances' && <OngletRelances />}
        {onglet === 'questionnaires' && <OngletQuestionnaires />}
        {onglet === 'ia' && <OngletIA />}
        {onglet === 'confidentialite' && <OngletConfidentialite />}
      </div>
    </div>
  );
}

function OngletConfidentialite() {
  const notifier = useNotifier();
  const [reinit, setReinit] = useState(false);
  return (
    <>
      <section className="carte" aria-labelledby="t-confidentialite">
        <div className="carte-entete">
          <h2 id="t-confidentialite" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="bouclier" /> Confidentialité
          </h2>
        </div>
        <div className="carte-corps">
          <ul className="liste-points" style={{ display: 'grid', gap: 6 }}>
            <li>
              Chaque fiche client n'est lisible que par son thérapeute : la règle est appliquée par la base de données
              elle-même (sécurité au niveau des lignes), pas seulement par l'interface.
            </li>
            <li>
              Si vous activez la double authentification, la base refuse l'accès aux fiches tant que le code n'a pas été
              saisi.
            </li>
            <li>
              L'espace de groupe ne reçoit que des agrégats : il s'ouvre à partir de {SEUIL_THERAPEUTES} thérapeutes, et
              chaque case exige au moins {SEUIL_CLIENTS_PAR_CASE} clients d'autres thérapeutes.
            </li>
            <li>
              Le lien du questionnaire est personnel, à usage unique et limité dans le temps ; la base n'en garde qu'une
              empreinte. La page du questionnaire n'affiche rien du client.
            </li>
            <li>Les messages partent de votre propre messagerie : aucun service d'envoi tiers ne voit vos clients.</li>
            <li>Avant tout envoi à l'IA, le nom et le prénom du client sont retirés du texte.</li>
            <li>La suppression d'un client efface l'ensemble de son parcours (droit à l'effacement).</li>
          </ul>
        </div>
      </section>

      {donnees.reinitialiserDemo && (
        <section className="carte" aria-labelledby="t-demo">
          <div className="carte-entete">
            <div>
              <h2 id="t-demo">Données de démonstration</h2>
              <p className="aide">Restaure le jeu fictif d'origine (8 thérapeutes, environ 150 clients).</p>
            </div>
          </div>
          <div className="carte-corps">
            <button className="bouton bouton-danger" onClick={() => setReinit(true)}>
              Réinitialiser les données fictives
            </button>
          </div>
          <Dialogue
            ouvert={reinit}
            fermer={() => setReinit(false)}
            titre="Réinitialiser la démonstration ?"
            pied={
              <>
                <button className="bouton" onClick={() => setReinit(false)}>
                  Annuler
                </button>
                <button
                  className="bouton bouton-principal"
                  onClick={() => {
                    donnees.reinitialiserDemo?.();
                    setReinit(false);
                    notifier('Données fictives restaurées. Rechargement…');
                    setTimeout(() => location.reload(), 800);
                  }}
                >
                  Réinitialiser
                </button>
              </>
            }
          >
            <p>Les clients, séances, relances et réglages saisis dans la démonstration seront remplacés.</p>
          </Dialogue>
        </section>
      )}
    </>
  );
}

// Politique de confidentialité (RGPD, articles 13 et 14), page publique : /confidentialite.
// Lue par les thérapeutes ET par leurs clients (liens depuis la connexion et depuis les
// pages ouvertes par lien : questionnaire, document, reçu). Les informations de l'éditeur
// viennent de config/rgpd.ts. Texte à faire valider par un juriste ou un DPO (docs/RGPD.md).

import { Link, useNavigate } from 'react-router-dom';
import { Icone } from '../composants/Icone';
import { DUREE_CONSERVATION_ANS, DUREE_JOURNAL_CONNEXIONS_MOIS, EDITEUR, POLITIQUE_MISE_A_JOUR } from '../config/rgpd';

export function Confidentialite() {
  const naviguer = useNavigate();
  return (
    <div className="page-publique">
      <article className="politique carte">
        <div className="carte-corps">
          <p className="sur-titre-politique">Données personnelles</p>
          <h1>Politique de confidentialité</h1>
          <p className="meta">Mise à jour le {POLITIQUE_MISE_A_JOUR}.</p>

          <p>
            Cette application sert à des thérapeutes à suivre leurs clients : fiches, séances, rendez-vous,
            questionnaires de suivi. Elle traite donc des <strong>données de santé</strong>, que la loi protège tout
            particulièrement (RGPD, article 9). Voici, simplement, qui fait quoi de vos données et quels sont vos
            droits.
          </p>

          <h2>Qui est responsable de vos données ?</h2>
          <ul>
            <li>
              <strong>Vous êtes client d’un thérapeute</strong> : votre thérapeute est responsable des données de votre
              suivi. C’est à lui ou à elle que vous vous adressez en premier.
            </li>
            <li>
              <strong>L’éditeur de la plateforme</strong> héberge et fait fonctionner l’application pour le compte des
              thérapeutes (sous-traitant), et il est responsable des comptes des thérapeutes : {EDITEUR.nom},{' '}
              {EDITEUR.adresse}. Contact : {EDITEUR.contact}.
            </li>
          </ul>

          <h2>Quelles données, et pourquoi ?</h2>
          <ul>
            <li>
              <strong>Pour vous, client</strong> : nom, prénom, année de naissance, coordonnées si vous les donnez,
              notes et fiches de vos séances, rendez-vous, réponses aux questionnaires et exercices, reçus. But :
              assurer votre accompagnement et son suivi.
            </li>
            <li>
              <strong>Pour le thérapeute</strong> : identité, adresse de connexion, réglages, journal de ses connexions
              (sécurité).
            </li>
            <li>
              <strong>Statistiques de groupe</strong> : uniquement des totaux anonymes, publiés seulement quand assez de
              personnes y contribuent ; aucun nom, aucune note n’en sort.
            </li>
          </ul>

          <h2>Sur quelle base ?</h2>
          <ul>
            <li>
              Vos données de suivi : votre <strong>consentement explicite</strong>, recueilli par votre thérapeute. Vous
              pouvez le retirer à tout moment, sans avoir à vous justifier.
            </li>
            <li>
              Être recontacté (relances, questionnaires) : votre accord, que votre thérapeute note sur votre fiche.
            </li>
            <li>Les comptes des thérapeutes : le contrat qui les lie à l’éditeur.</li>
          </ul>

          <h2>Qui y a accès ?</h2>
          <ul>
            <li>
              Votre fiche n’est lisible que par <strong>votre thérapeute</strong> : la base de données elle-même refuse
              tout autre accès, y compris aux autres thérapeutes de la plateforme.
            </li>
            <li>L’hébergeur des données : {EDITEUR.hebergeur}.</li>
            <li>
              <strong>Assistant IA (facultatif)</strong> : si votre thérapeute l’utilise, le texte d’une séance ou d’un
              questionnaire peut être transmis à un service d’intelligence artificielle (Gemini, Google), seulement
              quand il le demande, après retrait de votre nom et de votre prénom. Ce service peut traiter les données
              hors de l’Union européenne.
            </li>
            <li>
              Aucune donnée n’est vendue, ni utilisée pour de la publicité. Les messages vous sont envoyés depuis la
              propre messagerie de votre thérapeute : aucun service d’envoi tiers ne les voit.
            </li>
          </ul>

          <h2>Combien de temps ?</h2>
          <ul>
            <li>
              Votre fiche : le temps de votre suivi, puis {DUREE_CONSERVATION_ANS} ans après la dernière séance ; elle
              est ensuite proposée à l’effacement. Une fiche supprimée reste 30 jours dans une corbeille, puis elle est
              effacée définitivement avec tout ce qui la concerne.
            </li>
            <li>Les liens envoyés (questionnaire, document, reçu) expirent après quelques semaines.</li>
            <li>Le journal des connexions des thérapeutes : {DUREE_JOURNAL_CONNEXIONS_MOIS} mois.</li>
            <li>
              Les reçus sont des pièces comptables : ils sont conservés le temps exigé par la loi, même après
              l’effacement de la fiche.
            </li>
          </ul>

          <h2>Vos droits</h2>
          <p>
            Vous pouvez demander à <strong>accéder</strong> à vos données et en recevoir une copie (portabilité), les
            faire <strong>rectifier</strong>, les faire <strong>effacer</strong>, en <strong>limiter</strong>{' '}
            l’utilisation, vous y <strong>opposer</strong>, et <strong>retirer votre consentement</strong>.
            Adressez-vous à votre thérapeute : l’application lui permet d’exporter votre fiche complète et de l’effacer.
            Vous pouvez aussi écrire à l’éditeur ({EDITEUR.contact}).
          </p>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (
            <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer noopener">
              cnil.fr/fr/plaintes
            </a>
            ).
          </p>

          <h2>Sécurité</h2>
          <ul>
            <li>
              Connexion chiffrée ; accès aux fiches contrôlé par la base de données ; double authentification proposée à
              chaque thérapeute.
            </li>
            <li>
              Déconnexion automatique après une période d’inactivité ; comptes créés par l’administrateur seulement.
            </li>
            <li>
              Les liens envoyés sont personnels et à durée limitée ; la base n’en garde qu’une empreinte, jamais le lien
              lui-même.
            </li>
          </ul>

          <h2>Cookies et stockage</h2>
          <p>
            Aucun cookie publicitaire ni de mesure d’audience. Le navigateur garde seulement ce qui est nécessaire au
            fonctionnement (session, préférences d’affichage) : ces éléments ne demandent pas de consentement.
          </p>

          <div className="actions" style={{ marginTop: 24 }}>
            <button type="button" className="bouton" onClick={() => naviguer(-1)}>
              <Icone nom="precedent" taille={15} /> Retour
            </button>
            <Link to="/connexion" className="bouton-lien">
              Page de connexion
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}

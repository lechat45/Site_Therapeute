// Cadre de l'espace connecté : menu latéral (ou barre du haut sur téléphone),
// badge des tâches, déconnexion automatique, puis la page courante (<Outlet>).
// Ajouter un écran au menu : un <Lien> ici + une route dans App.tsx.

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { donnees } from '../donnees';
import { useInactivite } from '../etat/inactivite';
import { useReglages } from '../etat/reglages';
import { DRAPEAU_ACCUEIL, useSession, useTherapeute } from '../etat/session';
import { useTaches } from '../etat/tachesContexte';
import { Avatar } from './Avatar';
import { Dialogue, useNotifier } from './Commun';
import { Icone, type NomIcone } from './Icone';

function Lien({
  vers,
  icone,
  libelle,
  exact,
  badge,
}: {
  vers: string;
  icone: NomIcone;
  libelle: string;
  exact?: boolean;
  badge?: number;
}) {
  return (
    <NavLink to={vers} end={exact} className="nav-lien">
      <Icone nom={icone} /> {libelle}
      {badge ? (
        <span className="badge-nav" aria-label={`${badge} à faire`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Structure() {
  const t = useTherapeute();
  const { fermer } = useSession();
  const { parametres } = useReglages();
  const { taches } = useTaches();
  const notifier = useNotifier();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { pathname } = useLocation();
  const naviguer = useNavigate();

  useEffect(() => setMenuOuvert(false), [pathname]);

  // Juste après la connexion : page d'ouverture choisie (Paramètres > Affichage).
  useEffect(() => {
    let drapeau = false;
    try {
      drapeau = sessionStorage.getItem(DRAPEAU_ACCUEIL) !== null;
      sessionStorage.removeItem(DRAPEAU_ACCUEIL);
    } catch {
      /* stockage indisponible */
    }
    if (drapeau && pathname === '/' && parametres.page_accueil !== '/')
      naviguer(parametres.page_accueil, { replace: true });
    // une seule fois, à l'ouverture de l'espace
  }, []);

  const avertissement = useInactivite(parametres.deconnexion_minutes, () => {
    void fermer();
    notifier("Déconnexion automatique après une période d'inactivité.");
  });

  return (
    <div className="app">
      <header className="barre-mobile">
        <span className="marque" style={{ padding: 0 }}>
          <span className="marque-pastille" /> {parametres.nom_site}
        </span>
        <button
          className="bouton bouton-icone bouton-menu"
          onClick={() => setMenuOuvert(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={menuOuvert}
        >
          <Icone nom="menu" />
          {taches.length > 0 && <span className="pastille-menu" aria-hidden />}
        </button>
      </header>
      {menuOuvert && <div className="voile" onClick={() => setMenuOuvert(false)} />}

      <nav className={`barre-laterale${menuOuvert ? ' ouverte' : ''}`} aria-label="Navigation principale">
        <div className="marque">
          <span className="marque-pastille" /> {parametres.nom_site}
        </div>
        {donnees.mode === 'demo' && (
          <div className="badge-demo">
            <strong>Mode démonstration</strong>
            <br />
            Données fictives, conservées dans ce navigateur.
          </div>
        )}
        <div className="nav-titre">Espace privé</div>
        <Lien vers="/" icone="tableau" libelle="Mon tableau de bord" exact />
        <Lien vers="/clients" icone="clients" libelle="Mes clients" />
        <Lien vers="/emploi-du-temps" icone="calendrier" libelle="Emploi du temps" />
        <Lien vers="/taches" icone="taches" libelle="Tâches" badge={taches.length} />
        <Lien vers="/journal" icone="livre" libelle="Journal" />
        <Lien vers="/exercices" icone="document" libelle="Exercices et documents" />
        <div className="nav-titre">Suivi de l'activité</div>
        <Lien vers="/activite" icone="activite" libelle="Activité" />
        <div className="nav-titre">Espace partagé</div>
        <Lien vers="/groupe" icone="groupe" libelle="Espace de groupe" />
        <div className="nav-titre">Compte</div>
        <Lien vers="/parametres" icone="reglages" libelle="Paramètres" />

        <div className="pied">
          <Link to="/parametres?onglet=profil" className="utilisateur" title="Mon profil">
            <Avatar />
            <div style={{ minWidth: 0 }}>
              <div className="utilisateur-nom">
                {t.prenom} {t.nom}
              </div>
              <div className="utilisateur-courriel">{parametres.specialite || t.email}</div>
            </div>
          </Link>
          <button className="bouton-deconnexion" onClick={fermer}>
            <Icone nom="sortir" taille={16} /> Se déconnecter
          </button>
        </div>
      </nav>

      <main className="contenu" id="contenu">
        <Outlet />
      </main>

      <Dialogue
        ouvert={avertissement}
        fermer={() => {}}
        titre="Toujours là ?"
        pied={
          <button className="bouton bouton-principal" onClick={() => window.dispatchEvent(new Event('pointerdown'))}>
            Rester connecté(e)
          </button>
        }
      >
        <p>
          Sans activité, vous serez déconnecté(e) dans une minute pour protéger les données de vos clients. Les
          modifications non enregistrées seraient perdues.
        </p>
      </Dialogue>
    </div>
  );
}

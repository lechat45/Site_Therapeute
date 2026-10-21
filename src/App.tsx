// Routes de l'application. Publiques (sans compte, par jeton) : /connexion,
// /q/:jeton (questionnaire), /d/:jeton (document remis), /r/:jeton (reçu).
// Tout le reste passe par <Protege> : session, réglages, tâches, puis
// <Structure> (menu + page). Pages lourdes ou rares chargées en `lazy`.

import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { Chargement, FournisseurNotifications } from './composants/Commun';
import { Structure } from './composants/Structure';
import { FournisseurReglages } from './etat/reglages';
import { FournisseurSession, useSession } from './etat/session';
import { FournisseurTaches } from './etat/tachesContexte';
import { Clients } from './pages/Clients';
import { Connexion } from './pages/Connexion';
import { EmploiDuTemps } from './pages/EmploiDuTemps';
import { FicheClient } from './pages/FicheClient';
import { FicheSeance } from './pages/FicheSeance';
import { EspaceGroupe, TableauDeBord } from './pages/Statistiques';
import { Taches } from './pages/Taches';

// Pages moins fréquentes, chargées à la demande. Le questionnaire public,
// ouvert par les clients sur leur téléphone, reste ainsi léger.
const Parametres = lazy(() => import('./pages/Parametres').then((m) => ({ default: m.Parametres })));
const Rentabilite = lazy(() => import('./pages/Rentabilite').then((m) => ({ default: m.Rentabilite })));
const QuestionnairePublic = lazy(() =>
  import('./pages/QuestionnairePublic').then((m) => ({ default: m.QuestionnairePublic })),
);
const DocumentPublic = lazy(() => import('./pages/DocumentPublic').then((m) => ({ default: m.DocumentPublic })));
const RecuPublic = lazy(() => import('./pages/RecuPublic').then((m) => ({ default: m.RecuPublic })));
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })));
const Exercices = lazy(() => import('./pages/Exercices').then((m) => ({ default: m.Exercices })));
const ImpressionDocument = lazy(() => import('./pages/Exercices').then((m) => ({ default: m.ImpressionDocument })));
const Activite = lazy(() => import('./pages/Activite').then((m) => ({ default: m.Activite })));
const Recus = lazy(() => import('./pages/Recus').then((m) => ({ default: m.Recus })));
const ImpressionRecu = lazy(() => import('./pages/Recus').then((m) => ({ default: m.ImpressionRecu })));

const differe = (page: ReactNode) => <Suspense fallback={<Chargement />}>{page}</Suspense>;

function Protege() {
  const { therapeute } = useSession();
  const { pathname, search } = useLocation();
  if (therapeute === undefined) return <Chargement texte="Vérification de la session…" />;
  // `search` conservé : ex. /parametres?onglet=affichage après reconnexion
  if (!therapeute) return <Navigate to="/connexion" replace state={{ depuis: pathname + search }} />;
  return (
    <FournisseurReglages key={therapeute.id}>
      <FournisseurTaches>
        <Structure />
      </FournisseurTaches>
    </FournisseurReglages>
  );
}

const routeur = createBrowserRouter(
  [
    { path: '/connexion', element: <Connexion /> },
    // Questionnaire du client : sans compte, par son lien personnel.
    { path: '/q/:jeton', element: differe(<QuestionnairePublic />) },
    // Exercice ou document remis au client, par son lien personnel.
    { path: '/d/:jeton', element: differe(<DocumentPublic />) },
    // Reçu envoyé au client, par son lien personnel.
    { path: '/r/:jeton', element: differe(<RecuPublic />) },
    {
      path: '/',
      element: <Protege />,
      children: [
        { index: true, element: <TableauDeBord /> },
        { path: 'clients', element: <Clients /> },
        { path: 'clients/:clientId', element: <FicheClient /> },
        { path: 'clients/:clientId/seances/:seanceId', element: <FicheSeance /> },
        { path: 'taches', element: <Taches /> },
        { path: 'emploi-du-temps', element: <EmploiDuTemps /> },
        { path: 'activite', element: differe(<Activite />) },
        { path: 'journal', element: differe(<Journal />) },
        { path: 'exercices', element: differe(<Exercices />) },
        { path: 'exercices/:ressourceId/imprimer', element: differe(<ImpressionDocument />) },
        { path: 'recus', element: differe(<Recus />) },
        { path: 'recus/:recuId', element: differe(<ImpressionRecu />) },
        { path: 'rentabilite', element: differe(<Rentabilite />) },
        { path: 'groupe', element: <EspaceGroupe /> },
        { path: 'parametres', element: differe(<Parametres />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  // Le site peut être publié dans un sous-dossier (GitHub Pages) : voir `base` dans vite.config.ts.
  { basename: import.meta.env.BASE_URL },
);

export function App() {
  return (
    <FournisseurSession>
      <FournisseurNotifications>
        <RouterProvider router={routeur} />
      </FournisseurNotifications>
    </FournisseurSession>
  );
}

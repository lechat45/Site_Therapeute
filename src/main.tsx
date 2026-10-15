// Point d'entrée : applique le thème mémorisé (avant la connexion) puis
// monte <App>.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { affichageMemorise, appliquerAffichage, appliquerTheme, themeMemorise } from './etat/reglages';
import './styles/index.css';

// Thème et affichage du dernier thérapeute connecté sur cet appareil
// (écran de connexion lisible avec ses préférences).
const { couleur, nomSite } = themeMemorise();
appliquerTheme(couleur, nomSite, false);
appliquerAffichage(affichageMemorise(), false);

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

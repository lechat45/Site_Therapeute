// Configuration de Vite (serveur de développement, construction) et de Vitest (tests).
// Publication sur GitHub Pages et variable CHEMIN_BASE : voir docs/DEPLOIEMENT.md.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Sous-dossier de publication (GitHub Pages : « /<dépôt>/ ») ; « / » partout ailleurs.
  // Encodé comme dans la barre d'adresse : le nom du dépôt peut contenir des accents.
  base: encodeURI(process.env.CHEMIN_BASE ?? '/'),
  server: { port: 5190, strictPort: true },
  // Postgres (PGlite) s'initialise en WebAssembly : délais généreux.
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120_000, hookTimeout: 300_000 },
});

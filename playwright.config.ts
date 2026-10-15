// Tests de bout en bout (navigateur réel) sur le mode démonstration.
//   npm run test:e2e
// En local, Chrome ou Edge déjà installé est utilisé (rien à télécharger).
// Sinon, et en intégration continue : `npx playwright install chromium`.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5191;

function navigateurInstalle(): 'chrome' | 'msedge' | undefined {
  if (process.env.CI) return undefined;
  if (process.platform === 'darwin')
    return existsSync('/Applications/Google Chrome.app')
      ? 'chrome'
      : existsSync('/Applications/Microsoft Edge.app')
        ? 'msedge'
        : undefined;
  if (process.platform !== 'win32') return undefined;
  const dossiers = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA];
  const existe = (...chemin: string[]) => dossiers.some((d) => d && existsSync(join(d, ...chemin)));
  if (existe('Google', 'Chrome', 'Application', 'chrome.exe')) return 'chrome';
  if (existe('Microsoft', 'Edge', 'Application', 'msedge.exe')) return 'msedge';
  return undefined;
}
const canal = navigateurInstalle();

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], channel: canal } },
    // parcours principaux, écran de téléphone
    { name: 'telephone', grep: /@telephone/, use: { ...devices['Pixel 7'], channel: canal } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // toujours le mode démonstration, même si .env.local pointe vers Supabase
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});

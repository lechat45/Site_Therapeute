// Étapes communes des tests de bout en bout (mode démonstration).

import { expect, type Page } from '@playwright/test';

export async function seConnecter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click(); // identifiants de démo pré-remplis
  await expect(page.getByRole('heading', { name: /^Bonjour / })).toBeVisible();
}

export async function creerClient(page: Page, prenom = 'Alex', nom = 'Testeur') {
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Nouveau client' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Prénom').fill(prenom);
  await page.getByLabel('Année de naissance').fill('1990');
  await page.getByLabel('E-mail (facultatif)').fill(`${prenom}.${nom}@exemple.fr`.toLowerCase());
  await page.getByLabel(/accepte d'être recontacté/).check();
  await page.getByRole('button', { name: 'Créer la fiche' }).click();
  await expect(page.getByRole('heading', { name: `${prenom} ${nom.toUpperCase()}` })).toBeVisible();
}

/** Date du jour à Paris (fuseau des tests), au format AAAA-MM-JJ. */
export const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Version 0.9.0 : rappel d'un exercice non rendu, exercices rendus sur la
// fiche de séance, reçu groupé, livre des recettes.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { creerClient, seConnecter } from './aides';
import { ARGENT_VISIBLE, EXERCICES_VISIBLES } from '../src/config/fonctions';

test('exercice non rendu : le rappel prépare un nouveau lien', async ({ page, context }) => {
  test.skip(!EXERCICES_VISIBLES, 'Exercices et documents masqués (src/config/fonctions.ts)');
  await seConnecter(page);
  await page.goto('/taches?filtre=exercices');
  const carte = page.locator('article', { has: page.getByRole('heading', { name: /^Rappeler l'exercice à / }) });
  await carte.getByRole('button', { name: 'Préparer le rappel' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('button', { name: 'Préparer le rappel' }).click();
  await expect(dialogue.getByLabel('Message')).toHaveValue(/Petit rappel[\s\S]*\/d\/[0-9a-f]{64}/);

  const [client] = await Promise.all([
    context.waitForEvent('page'),
    dialogue.getByRole('link', { name: 'Voir comme le client' }).click(),
  ]);
  await expect(client.getByRole('button', { name: 'Envoyer mes réponses' })).toBeVisible();
  await client.close();
  await dialogue.getByRole('button', { name: 'Terminé' }).click();
  await expect(carte).toHaveCount(0); // rappel noté : la tâche disparaît
});

test('fiche de séance : l’exercice rendu par le client s’affiche en tête', async ({ page, context }) => {
  test.skip(!EXERCICES_VISIBLES, 'Exercices et documents masqués (src/config/fonctions.ts)');
  await seConnecter(page);
  await creerClient(page, 'Lina', 'Seance');
  await page.getByRole('button', { name: 'Démarrer la séance 1' }).click();
  await expect(page.getByRole('heading', { name: 'Séance 1' })).toBeVisible();
  const seance = page.url();

  await page.getByRole('link', { name: 'Lina Seance' }).click();
  const carte = page.locator('section', { has: page.getByRole('heading', { name: 'Exercices remis' }) });
  await carte.getByRole('button', { name: 'Remettre' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Document').selectOption({ label: 'Journal des émotions' });
  await dialogue.getByRole('button', { name: 'Créer le lien' }).click();
  const [client] = await Promise.all([
    context.waitForEvent('page'),
    dialogue.getByRole('link', { name: 'Voir comme le client' }).click(),
  ]);
  await client.getByLabel(/Où l’avez-vous sentie/).fill('Une boule dans la gorge.');
  await client.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(client.getByText(/Merci, vos réponses ont été transmises/)).toBeVisible();
  await client.close();
  await dialogue.getByRole('button', { name: 'Terminé' }).click();

  await page.goto(seance);
  const rendus = page.locator('section', { has: page.getByRole('heading', { name: /Exercice rendu/ }) });
  await expect(rendus.getByText('Une boule dans la gorge.')).toBeVisible();
});

test('reçu groupé pour plusieurs séances d’un même client ; livre des recettes', async ({ page }) => {
  test.skip(!ARGENT_VISIBLE, 'Tarifs, reçus et rentabilité masqués (src/config/fonctions.ts)');
  await seConnecter(page);
  await page.goto('/recus');
  await page.getByRole('button', { name: /^Tout afficher/ }).click();
  // un client qui a au moins deux séances sans reçu
  const noms = await page.locator('.liste-a-emettre li strong').allTextContents();
  const nom = noms.find((n, i) => noms.indexOf(n) !== i)!;
  const lignes = page.locator('.liste-a-emettre li').filter({ has: page.getByText(nom, { exact: true }) });
  await lignes.nth(0).getByRole('checkbox').check();
  await lignes.nth(1).getByRole('checkbox').check();
  await expect(page.getByText(/2 séances de/)).toBeVisible();
  await page.getByRole('button', { name: 'Émettre un reçu groupé' }).click();
  const dialogue = page.getByRole('dialog', { name: `Reçu groupé pour ${nom}` });
  await expect(dialogue.getByText(/2 séances · total/)).toBeVisible();
  await dialogue.getByRole('button', { name: 'Émettre le reçu' }).click();

  await expect(page).toHaveURL(/\/recus\/[0-9a-f-]+$/);
  await expect(page.locator('.tableau-recu tbody tr')).toHaveCount(2);
  const numero = (await page.getByText(/^Reçu n° \d{4}-\d{4}$/).textContent())!.replace('Reçu n° ', '');
  await page.getByRole('link', { name: 'Reçus' }).first().click();
  await expect(page.getByRole('row', { name: new RegExp(numero) }).getByText('2 séances')).toBeVisible();

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Livre des recettes/ }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toBe('livre-des-recettes.csv');
  const csv = readFileSync((await telechargement.path())!, 'utf8');
  expect(csv).toContain('Date;N° de reçu;Client;Nature de la prestation;Règlement;Montant (€)');
  expect(csv).toContain('Totaux par trimestre');
  expect(csv).toContain(`;${numero};`);
});

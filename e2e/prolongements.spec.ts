// Version 0.8.0 : exercice complété par le client, reçu envoyé par lien,
// export des reçus, tâches récurrentes.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { aujourdhui, creerClient, seConnecter } from './aides';

test('exercice à compléter : le client répond, ses réponses arrivent dans les tâches', async ({ page, context }) => {
  await seConnecter(page);
  await creerClient(page, 'Inès', 'Devoir');
  const carte = page.locator('section', { has: page.getByRole('heading', { name: 'Exercices remis' }) });
  await carte.getByRole('button', { name: 'Remettre' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Document').selectOption({ label: 'Journal des émotions' });
  await dialogue.getByRole('button', { name: 'Créer le lien' }).click();
  await expect(dialogue.getByLabel('Message')).toHaveValue(/\/d\/[0-9a-f]{64}/);

  const [client] = await Promise.all([
    context.waitForEvent('page'),
    dialogue.getByRole('link', { name: 'Voir comme le client' }).click(),
  ]);
  await client.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(client.getByText('Répondez à au moins une question.')).toBeVisible();
  await client.getByLabel(/Quelle émotion avez-vous ressentie/).fill('De la tristesse, en fin de journée.');
  await client.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(client.getByText(/Merci, vos réponses ont été transmises/)).toBeVisible();
  await client.reload();
  await expect(client.getByText(/Vos réponses ont été envoyées le/)).toBeVisible();
  await expect(client.getByRole('button', { name: 'Envoyer mes réponses' })).toHaveCount(0);
  await client.close();

  await dialogue.getByRole('button', { name: 'Terminé' }).click();
  await page.goto('/taches?filtre=exercices');
  const tache = page.locator('article', {
    has: page.getByRole('heading', { name: 'Exercice complété par Inès Devoir' }),
  });
  await tache.getByRole('button', { name: 'Voir les réponses' }).click();
  await expect(page.getByRole('dialog').getByText('De la tristesse, en fin de journée.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await expect(tache).toHaveCount(0); // lues : la tâche disparaît
});

test('reçus : envoyé par lien, ouvert par le client ; export pour le tableur', async ({ page, context }) => {
  await seConnecter(page);
  await page.goto('/recus');
  const ligne = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Envoyer' }) })
    .first();
  const numero = (await ligne.getByRole('cell').first().textContent())!;
  await ligne.getByRole('button', { name: 'Envoyer' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('button', { name: 'Créer le lien' }).click();
  await expect(dialogue.getByLabel('Message')).toHaveValue(/\/r\/[0-9a-f]{64}/);

  const [client] = await Promise.all([
    context.waitForEvent('page'),
    dialogue.getByRole('link', { name: 'Voir comme le client' }).click(),
  ]);
  await expect(client.getByRole('heading', { name: "Note d'honoraires" })).toBeVisible();
  await expect(client.getByText(`Reçu n° ${numero}`)).toBeVisible();
  await client.close();
  await dialogue.getByRole('button', { name: 'Terminé' }).click();
  await expect(page.getByRole('row', { name: new RegExp(numero) }).getByText(/lien ouvert le/)).toBeVisible();

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter pour le tableur (CSV)' }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/^recus-\d{4}\.csv$/);
  const csv = readFileSync((await telechargement.path())!, 'utf8');
  expect(csv).toContain('Numéro;Date du reçu;Client');
  expect(csv).toContain(`${numero};`);
});

test('tâches récurrentes : cochée, la suivante est programmée @telephone', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/taches');
  await page.getByLabel('Nouvelle tâche').fill('Point de supervision');
  await page.getByLabel('Échéance (facultatif)').fill(aujourdhui());
  await page.getByLabel('Répéter').selectOption({ label: 'Chaque mois' });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText('« Point de supervision » ajoutée.')).toBeVisible();

  await page
    .getByRole('group', { name: 'Afficher' })
    .getByRole('button', { name: /^Mes tâches/ })
    .click();
  const carte = page.locator('article', { has: page.getByRole('heading', { name: 'Point de supervision' }) });
  await expect(carte.getByText('chaque mois')).toBeVisible();
  await carte.getByRole('button', { name: "C'est fait" }).click();
  await expect(page.getByText(/« Point de supervision » : c'est fait\. Prochaine fois :/)).toBeVisible();
  await expect(carte).toHaveCount(0);
  // la suivante attend dans « À venir », la faite dans « Faites ces 7 derniers jours »
  await expect(page.locator('.liste-miennes').getByText('Point de supervision')).toHaveCount(2);
});

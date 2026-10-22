// Journal, exercices, reçus, activité et améliorations des tâches (0.7.0).

import { expect, test } from '@playwright/test';
import { creerClient, seConnecter } from './aides';
import { ARGENT_VISIBLE, EXERCICES_VISIBLES } from '../src/config/fonctions';

test('tâches : ma tâche, « plus tard », filtres et tâches reportées @telephone', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/taches');
  const filtres = page.getByRole('group', { name: 'Afficher' });
  await expect(filtres).toBeVisible();

  // seulement des tâches : pas de planning des rendez-vous du jour (choix de l'utilisateur, 0.10.2)
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Rendez-vous', exact: true })).toHaveCount(0);

  // tâche personnelle sans échéance : elle apparaît tout de suite dans « À faire »
  await page.getByLabel('Nouvelle tâche').fill('Appeler la mutuelle');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText('« Appeler la mutuelle » ajoutée.')).toBeVisible();
  await filtres.getByRole('button', { name: /^Mes tâches/ }).click();
  const carte = page.locator('article', { has: page.getByRole('heading', { name: 'Appeler la mutuelle' }) });
  await expect(carte).toBeVisible();

  // « Plus tard » sur une tâche personnelle : elle prend l'échéance de demain
  await carte.getByText('Plus tard').click();
  await carte.getByRole('button', { name: 'Demain' }).click();
  await expect(page.getByText('« Appeler la mutuelle » reviendra demain.')).toBeVisible();
  await expect(carte).toHaveCount(0);
  await expect(page.locator('.liste-miennes').getByText('Appeler la mutuelle')).toBeVisible(); // « À venir »

  // « Plus tard » sur une tâche calculée : elle passe dans « Reportées »
  await filtres.getByRole('button', { name: /^Tout/ }).click();
  const premiere = page.locator('article.tache:not(.tache-perso)').first();
  const titre = (await premiere.getByRole('heading').textContent())!;
  await premiere.getByText('Plus tard').click();
  await premiere.getByRole('button', { name: 'Dans 3 jours' }).click();
  await expect(page.getByText(/reviendra/)).toBeVisible();
  await filtres.getByRole('button', { name: /^Reportées/ }).click();
  await expect(filtres.getByRole('button', { name: /^Reportées/ })).toContainText('1');
  await page.getByRole('button', { name: 'Remettre maintenant' }).click();
  await expect(page.getByText(/est de retour dans la liste/)).toBeVisible();
  await filtres.getByRole('button', { name: /^Tout/ }).click();
  await expect(page.locator('article.tache').getByRole('heading', { name: titre, exact: true })).toBeVisible();
});

test('journal : une note liée à un client, retrouvée sur sa fiche et dans le journal', async ({ page }) => {
  await seConnecter(page);
  await creerClient(page, 'Jade', 'Journal');
  const carte = page.locator('section', { has: page.getByRole('heading', { name: 'Notes du journal' }) });
  await carte.getByRole('button', { name: 'Ajouter' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Titre (facultatif)').fill('Point à reprendre');
  await dialogue.getByLabel('Texte').fill('Évoquer la peur de conduire la prochaine fois.');
  await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Note ajoutée au journal.')).toBeVisible();
  await expect(carte.getByText('Point à reprendre')).toBeVisible();

  await page.goto('/journal');
  await page.getByLabel('Rechercher dans les notes').fill('peur de conduire');
  const note = page.locator('article', { has: page.getByRole('heading', { name: 'Point à reprendre' }) });
  await expect(note).toBeVisible();
  await expect(note.getByRole('link', { name: /Jade Journal/ })).toBeVisible();
});

test('exercices : remis par lien, le client l’ouvre sans compte', async ({ page, context }) => {
  test.skip(!EXERCICES_VISIBLES, 'Exercices et documents masqués (src/config/fonctions.ts)');
  await seConnecter(page);
  await creerClient(page, 'Léo', 'Exercice');
  const carte = page.locator('section', { has: page.getByRole('heading', { name: 'Exercices remis' }) });
  await carte.getByRole('button', { name: 'Remettre' }).click();
  const dialogue = page.getByRole('dialog');
  const document = (await dialogue.getByLabel('Document').locator('option:checked').textContent())!;
  await dialogue.getByRole('button', { name: 'Créer le lien' }).click();
  await expect(dialogue.getByLabel('Message')).toHaveValue(/\/d\/[0-9a-f]{64}/);

  const [client] = await Promise.all([
    context.waitForEvent('page'),
    dialogue.getByRole('link', { name: 'Voir comme le client' }).click(),
  ]);
  await expect(client.getByRole('heading', { name: document, exact: true })).toBeVisible();
  await expect(client.getByText(/Proposé par/)).toBeVisible();
  await client.close();

  await dialogue.getByRole('button', { name: 'Terminé' }).click();
  await page.reload();
  await expect(carte.getByText(document)).toBeVisible();
  await expect(carte.getByText(/ouvert le/)).toBeVisible();
});

test('reçus : émettre, imprimer, annuler avec un motif', async ({ page }) => {
  test.skip(!ARGENT_VISIBLE, 'Tarifs, reçus et rentabilité masqués (src/config/fonctions.ts)');
  await seConnecter(page);
  await page.goto('/recus');
  await page.getByRole('button', { name: 'Émettre un reçu' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Émettre le reçu' }).click();
  await expect(page).toHaveURL(/\/recus\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: "Note d'honoraires" })).toBeVisible();
  const numero = (await page.getByText(/^Reçu n° \d{4}-\d{4}$/).textContent())!.replace('Reçu n° ', '');
  await expect(page.getByRole('button', { name: 'Imprimer ou enregistrer en PDF' })).toBeVisible();

  await page.getByRole('link', { name: 'Reçus' }).first().click();
  const ligne = page.getByRole('row', { name: new RegExp(numero) });
  await ligne.getByRole('button', { name: 'Annuler' }).click();
  const dialogue = page.getByRole('dialog');
  await dialogue.getByRole('button', { name: 'Annuler le reçu' }).click();
  await expect(dialogue.getByText("Indiquez le motif de l'annulation.")).toBeVisible();
  await dialogue.getByLabel('Motif').fill('Erreur de date');
  await dialogue.getByRole('button', { name: 'Annuler le reçu' }).click();
  await expect(page.getByText(`Reçu n° ${numero} annulé.`)).toBeVisible();
  await expect(ligne.getByText('Annulé')).toBeVisible();
});

test('activité : statistiques de l’emploi du temps', async ({ page }) => {
  await seConnecter(page);
  await page.getByRole('link', { name: 'Activité' }).click();
  await expect(page.getByRole('heading', { name: 'Activité', exact: true })).toBeVisible();
  await expect(page.getByText('Heures de consultation').first()).toBeVisible();
  await page.getByRole('button', { name: '4 semaines' }).click();
  await expect(
    page.getByRole('list', { name: 'Heures de consultation par semaine' }).getByRole('listitem'),
  ).toHaveCount(4);
  await expect(page.getByRole('table', { name: /jour de la semaine et heure/ })).toBeVisible();
});

test('parties masquées : ni exercices ni argent dans l’interface @telephone', async ({ page }) => {
  test.skip(EXERCICES_VISIBLES || ARGENT_VISIBLE, 'au moins une partie est affichée (src/config/fonctions.ts)');
  await seConnecter(page);

  // menu : ni « Exercices et documents », ni « Rentabilité », ni « Reçus »
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const nom of ['Exercices et documents', 'Rentabilité', 'Reçus'])
    await expect(menu.getByRole('link', { name: nom })).toHaveCount(0);

  // leurs adresses ramènent à l'accueil
  for (const adresse of ['/exercices', '/recus', '/rentabilite']) {
    await page.goto(adresse);
    await expect(page.getByRole('heading', { name: /^Bonjour / })).toBeVisible();
  }

  // fiche client : pas de prix, pas d'exercices remis
  await page.goto('/clients');
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('€')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Exercices remis' })).toHaveCount(0);

  // paramètres : pas d'onglet « Tarifs », pas de coordonnées pour les reçus
  await page.goto('/parametres');
  await expect(page.getByRole('button', { name: 'Tarifs' })).toHaveCount(0);
  await expect(page.getByText('Pour les reçus')).toHaveCount(0);

  // tâches : pas de filtre « Exercices »
  await page.goto('/taches');
  await expect(page.getByRole('group', { name: 'Afficher' }).getByRole('button', { name: /^Exercices/ })).toHaveCount(
    0,
  );
});

// Parcours principaux, dans un vrai navigateur, sur le mode démonstration.
// Chaque test démarre avec un navigateur vierge : jeu de données fictif neuf.

import { expect, test } from '@playwright/test';
import { aujourdhui, creerClient, seConnecter } from './aides';

test('connexion, tableau de bord et choix de la période @telephone', async ({ page }) => {
  await seConnecter(page);
  await expect(page.getByText('Séances par client (moyenne)')).toBeVisible();
  await page.getByRole('button', { name: '3 derniers mois' }).click();
  await expect(page.getByText('Séances par client (moyenne)')).toBeVisible();
});

test('nouvelle séance : les notes sont enregistrées automatiquement', async ({ page }) => {
  await seConnecter(page);
  await creerClient(page);
  await page.getByRole('button', { name: 'Démarrer la séance 1' }).click();
  await page.getByLabel('Notes de séance').fill('Crises d’angoisse en voiture, surtout sur autoroute.');
  await expect(page.getByText(/Enregistrée automatiquement à/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Notes de séance')).toHaveValue(/Crises d’angoisse en voiture/);
});

test('relance : le client répond, la réponse arrive dans les tâches', async ({ page, context }) => {
  await seConnecter(page);
  await creerClient(page);
  await page.getByRole('button', { name: 'Questionnaire par e-mail' }).click();
  const message = page.getByLabel('Message');
  await expect(message).toHaveValue(/\/q\/[0-9a-f]{64}/);

  // le lien n'est actif qu'une fois sorti de l'application (ici : « Tester »)
  const [client] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: 'Tester le questionnaire' }).click(),
  ]);
  await expect(client.getByRole('heading', { name: 'Questionnaire de suivi' })).toBeVisible();
  const curseurs = client.getByRole('slider');
  for (let i = 0; i < 3; i++) await curseurs.nth(i).fill('7');
  await client.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(client.getByRole('heading', { name: 'Réponses envoyées' })).toBeVisible();
  await client.close();

  await page.getByRole('button', { name: "J'ai envoyé le message" }).click();
  await page.goto('/taches');
  await expect(page.getByRole('heading', { name: 'Questionnaire reçu de Alex Testeur' })).toBeVisible();
});

test('fermer après avoir copié le message : on demande s’il est parti', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seConnecter(page);
  await creerClient(page, 'Lou', 'Copie');
  await page.getByRole('button', { name: 'Questionnaire par e-mail' }).click();
  const dialogue = page.getByRole('dialog');
  await expect(dialogue.getByLabel('Message')).toHaveValue(/\/q\/[0-9a-f]{64}/);
  await dialogue.getByRole('button', { name: 'Copier le message' }).click();
  // avant : « Annuler » supprimait le lien déjà copié, le client tombait sur « Lien introuvable »
  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialogue.getByText('Le message est-il parti ?')).toBeVisible();
  await dialogue.getByRole('button', { name: 'Oui, il est parti' }).click();
  await expect(page.getByText('Envoi à Lou Copie enregistré.')).toBeVisible();
});

test('corbeille : un client supprimé se restaure', async ({ page }) => {
  await seConnecter(page);
  await creerClient(page, 'Camille', 'Corbeille');
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.getByRole('button', { name: 'Mettre à la corbeille' }).click();
  await expect(page.getByRole('heading', { name: 'Mes clients' })).toBeVisible();
  await expect(page.getByRole('link', { name: /CORBEILLE Camille/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Corbeille' }).click();
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('link', { name: /CORBEILLE Camille/ })).toBeVisible();
});

test('affichage : mode daltonien rouge-vert @telephone', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/parametres?onglet=affichage');
  await page.getByRole('radio', { name: /Daltonisme rouge-vert/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-vision', 'rouge_vert');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-vision', 'rouge_vert');
});

test('emploi du temps : planifier depuis la fiche, retrouver, commencer la séance @telephone', async ({ page }) => {
  await seConnecter(page);
  await creerClient(page, 'Noé', 'Agenda');
  await page.getByRole('button', { name: 'Planifier' }).click();
  const dialogue = page.getByRole('dialog');
  // nouveau client sans séance : « premier rendez-vous » proposé d'office
  await expect(dialogue.getByRole('radio', { name: /Premier rendez-vous/ })).toHaveAttribute('aria-checked', 'true');
  await dialogue.getByLabel('Jour').fill(aujourdhui());
  await dialogue.getByLabel('Heure').fill('10:00');
  await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Rendez-vous ajouté.')).toBeVisible();

  await page.goto('/emploi-du-temps');
  await page.getByRole('button', { name: 'Jour', exact: true }).click();
  const rdv = page.getByRole('button', { name: /Noé Agenda/ });
  await expect(rdv).toBeVisible();
  // l'accessibilité ne repose pas sur la couleur : type, heure et statut sont dits en toutes lettres
  await expect(rdv).toHaveAttribute('aria-label', /de 10 h à 11 h, Premier rendez-vous, Noé Agenda, au cabinet, prévu/);
  await rdv.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Commencer la séance' }).click();
  await expect(page).toHaveURL(/\/seances\//);
  await expect(page.getByRole('heading', { name: 'Séance 1' })).toBeVisible();
});

test('emploi du temps : couleurs vérifiées pour les personnes daltoniennes', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/parametres?onglet=agenda');
  await expect(page.getByText(/Toutes les couleurs restent distinctes/)).toBeVisible();
  // un vert pour les séances se confond avec le rouge des bilans (daltonisme vert)
  await page
    .getByRole('radiogroup', { name: 'Couleur : Séance de suivi' })
    .getByRole('radio', { name: '#15803d' })
    .click();
  await expect(page.getByText(/Séance de suivi et Bilan — confondues en cas de daltonisme vert/)).toBeVisible();
  await page.getByRole('button', { name: 'Revenir aux couleurs adaptées à tous' }).click();
  await expect(page.getByText(/Toutes les couleurs restent distinctes/)).toBeVisible();
});

test('questionnaires : création d’un questionnaire avec une question à choix', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/parametres?onglet=questionnaires');
  await page.getByRole('button', { name: 'Nouveau questionnaire' }).click();
  await expect(page.getByRole('heading', { name: 'Modifier « Nouveau questionnaire »' })).toBeVisible();
  await page.getByRole('button', { name: 'Choix unique' }).click();
  await page.getByLabel('Intitulé de la question 2').fill('Comment s’est passée la semaine ?');
  await page.getByLabel('Réponse 1', { exact: true }).fill('Bien');
  await page.getByLabel('Réponse 2', { exact: true }).fill('Difficile');
  await page.getByRole('button', { name: 'Enregistrer le questionnaire' }).click();
  await expect(page.getByText('Questionnaire enregistré.')).toBeVisible();
});

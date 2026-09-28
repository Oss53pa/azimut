import { test, expect } from '@playwright/test';

/**
 * Q5 — les clients de l'organisation (entités juridiques), sous la liste des
 * sites. Sans dépôt configuré, la commande est acceptée sans être envoyée :
 * l'essai vérifie le formulaire et ses refus, pas l'écriture en base, que
 * `write-path.db.test.ts` couvre.
 */
test.describe('Q5 — création d’un client', () => {
  test('le formulaire s’ouvre depuis la page des sites', async ({ page }) => {
    await page.goto('/sites');
    await expect(page.getByRole('region', { name: 'Clients' })).toBeVisible();
    await page.getByRole('button', { name: /^Nouveau client$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Raison sociale/)).toBeVisible();
  });

  test('les champs requis sont refusés ensemble, sans effacer la saisie', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau client$/ }).click();
    await page.getByLabel(/Numéro fiscal/).fill('NCC-1');
    await page.getByRole('button', { name: /^Créer le client$/ }).click();

    await expect(page.getByText('Nom requis')).toBeVisible();
    await expect(page.getByText('Pays requis')).toBeVisible();
    await expect(page.getByText(/Devise requise/)).toBeVisible();
    await expect(page.getByLabel(/Numéro fiscal/)).toHaveValue('NCC-1');
  });

  test('un client complet est accepté', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau client$/ }).click();
    await page.getByLabel(/Raison sociale/).fill('Société d’essai');
    await page.getByLabel(/^Pays/).selectOption('CI');
    await page.getByLabel(/^Devise/).fill('xof');
    await expect(page.getByLabel(/^Devise/)).toHaveValue('XOF');
    await page.getByRole('button', { name: /^Créer le client$/ }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Client créé.')).toBeVisible();
  });

  test('la même rubrique se lit en anglais', async ({ page }) => {
    await page.goto('/sites?lang=en');
    await page.getByRole('button', { name: /^New client$/ }).click();
    await expect(page.getByLabel(/Legal name/)).toBeVisible();
  });
});

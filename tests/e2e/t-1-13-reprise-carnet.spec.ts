import { test, expect } from '@playwright/test';

/**
 * T-1.13 — la reprise d'un carnet existant, depuis l'écran des supports. Sans
 * dépôt, le rapport se lit ligne à ligne et rien ne s'écrit ; un fichier qui
 * n'est pas en UTF-8 est refusé, jamais deviné.
 */
async function openSupports(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Écrans du module Socle du site' }).click();
  await page.getByRole('button', { name: /^Supports$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Reprendre un carnet existant' })).toBeVisible();
}

test('un carnet partiellement erroné : le rapport dit chaque ligne, rien n’est tronqué', async ({ page }) => {
  await openSupports(page);
  const csv = [
    'reference;typology;building;level;node_ref;azimuth_deg',
    'D-1;directional;Galerie;RDC;n-rt-g-lobby;90',
    'D-2;directional;Inconnu;RDC;n-rt-g-lobby;90',
    ';directional;Galerie;RDC;n-rt-g-lobby;90',
  ].join('\n');
  await page.getByLabel('Fichier du carnet').setInputFiles({ name: 'carnet.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await expect(page.getByText(/3 ligne\(s\)/)).toBeVisible();
  const rows = page.getByRole('row');
  await expect(rows).toHaveCount(4);
  await expect(page.getByText('IMPORT.ROW_INVALID').first()).toBeVisible();
  await expect(page.getByText('Aucun dépôt n’est configuré : le rapport se lit, rien ne s’écrit.')).toBeVisible();
});

test('un fichier qui n’est pas en UTF-8 est refusé', async ({ page }) => {
  await openSupports(page);
  await page.getByLabel('Fichier du carnet').setInputFiles({
    name: 'carnet.csv', mimeType: 'text/csv', buffer: Buffer.from([0x72, 0x65, 0x66, 0xe9, 0x72, 0x65, 0x6e, 0x63, 0x65]),
  });
  await expect(page.getByText(/IMPORT\.ENCODING_UNSUPPORTED|Encodage non reconnu/).first()).toBeVisible();
});

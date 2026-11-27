import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * T-1.14 — le rapport de rapprochement s'exporte depuis l'écran des
 * divergences : un tableur dont chaque ligne porte l'identifiant de son
 * entité.
 */
test('l’écran des divergences exporte le rapport, une ligne par écart, identifiant compris', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Écrans du module Maintenance' }).click();
  await page.getByRole('button', { name: /^Divergences$/ }).first().click();
  const button = page.getByRole('button', { name: 'Exporter le rapport (tableur)' });
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(download.suggestedFilename()).toMatch(/^rapprochement-.+\.csv$/);
  const path = await download.path();
  const lines = (await readFile(path, 'utf-8')).split('\n');
  expect(lines[0]).toBe('Nature;Identifiant;Libellé;Écart;Détail');
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines.slice(1)) expect(line.split(';')[1]).not.toBe('');
});

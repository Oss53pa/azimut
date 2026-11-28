import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T-1.3 — « Un volume sans hauteur est refusé. Les valeurs par défaut
 * proviennent du niveau, jamais d'une constante. »
 *
 * Ce qui se prouve ici, et nulle part ailleurs : l'atelier des empreintes
 * montre les volumes du niveau, propose l'altitude du niveau et l'écart au
 * niveau suivant, n'en propose aucun sur le dernier niveau, refuse le volume
 * sans hauteur et la matière non choisie, et écrit le volume d'un geste.
 *
 * Le site est `ref-multilevel`, site de référence du dépôt : RDC à 0 m, R+1 à
 * 3 m, dans un même bâtiment. Aucune donnée client (A13.1).
 */
const SITE = 'ref-multilevel';
const footprints = (level: string): string => `/sites/${SITE}/levels/${level}/footprints`;

const panel = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: /^Volumes$/ }) });
const base = (page: Page) => panel(page).getByLabel(/Altitude de base|Base elevation/);
const height = (page: Page) => panel(page).getByLabel(/^(Hauteur|Height)/);

async function choose(page: Page, label: string): Promise<void> {
  await panel(page).getByLabel(/^(Empreinte|Footprint)$/).selectOption({ label });
}

test.describe('T-1.3 — le volume d’une empreinte', () => {
  test('le niveau montre ses volumes, avec leur matière', async ({ page }) => {
    await page.goto(footprints('lvl-ml-rdc'));
    const row = panel(page).getByRole('row', { name: /C-000/ });
    await expect(row).toContainText('0');
    await expect(row).toContainText('3');
    await expect(row).toContainText(/Béton|Concrete/);
  });

  test('les valeurs proposées viennent du niveau, la matière se choisit, le volume s’écrit', async ({ page }) => {
    await page.goto(footprints('lvl-ml-rdc'));
    await choose(page, 'Place de stationnement sans code, nº 1');
    await expect(base(page)).toHaveValue('0');
    await expect(height(page)).toHaveValue('3');
    await expect(panel(page).getByText(/écart au niveau suivant/)).toBeVisible();

    await panel(page).getByRole('button', { name: /Enregistrer le volume|Save volume/ }).click();
    await expect(panel(page).getByText(/Choisir la matière du volume/)).toBeVisible();
    await expect(panel(page).getByRole('row')).toHaveCount(2);

    await panel(page).getByLabel(/^(Matière|Material)$/).selectOption({ label: 'Verre' });
    await panel(page).getByRole('button', { name: /Enregistrer le volume|Save volume/ }).click();
    await expect(panel(page).getByText(/Volume enregistré/)).toBeVisible();
    await expect(panel(page).getByRole('row', { name: /Place de stationnement sans code, nº 1/ })).toContainText('Verre');
  });

  test('le dernier niveau ne propose aucune hauteur, et un volume sans hauteur est refusé', async ({ page }) => {
    await page.goto(footprints('lvl-ml-r1'));
    await page.getByLabel(/Code de cellule|Unit code/).fill('C-101');
    await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
    await choose(page, 'C-101');
    await expect(base(page)).toHaveValue('3');
    await expect(height(page)).toHaveValue('');
    await expect(panel(page).getByText(/Dernier niveau du bâtiment/)).toBeVisible();

    await panel(page).getByLabel(/^(Matière|Material)$/).selectOption({ label: 'Non précisée' });
    await panel(page).getByRole('button', { name: /Enregistrer le volume|Save volume/ }).click();
    await expect(panel(page).getByText(/Volume sans hauteur/)).toBeVisible();
    await expect(panel(page).getByRole('row', { name: /C-101/ })).toHaveCount(0);
  });

  test('un volume existant se reprend tel quel, sans valeur proposée par-dessus', async ({ page }) => {
    await page.goto(footprints('lvl-ml-r1'));
    await choose(page, 'C-100');
    await expect(base(page)).toHaveValue('3');
    await expect(height(page)).toHaveValue('3');
    await expect(panel(page).getByLabel(/^(Matière|Material)$/)).toHaveValue('concrete');
  });
});

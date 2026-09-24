import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M4 (partie M), propriétés d'une arête : « Largeur utile — défaut : hérité du
 * bâtiment, `building.default_edge_width_m`. »
 *
 * Le jugement tient dans `state/__tests__/edge-width.test.ts`. Ce qui se
 * prouve ici et nulle part ailleurs : l'écran lit bien le bâtiment du niveau
 * courant. Une fonction juste, appelée avec le mauvais niveau, ou pas appelée
 * du tout, laisserait passer ces essais unitaires.
 *
 * Le site est `ref-retail`, site de référence du dépôt de code (C1) : deux
 * bâtiments, l'un déclarant 2,4 m et l'autre 1,1 m. C'est cette différence qui
 * rend la preuve possible — deux bâtiments à la même largeur ne diraient pas
 * lequel a été lu. Aucune donnée client (A13.1).
 */
const GALERIE = '/sites/ref-retail/levels/lvl-rt-g-rdc/graph';
const ANNEXE = '/sites/ref-retail/levels/lvl-rt-a-rdc/graph';

const DRAW = /Tracer l’axe|Draw the axis/;

async function ready(page: Page): Promise<void> {
  await page.locator('[role="toolbar"] button').first().waitFor({ state: 'attached' });
}

/**
 * Trace un segment sur le niveau courant et sélectionne l'arête produite.
 *
 * La longueur sert à la désigner : les nœuds tracés n'ont pas de libellé, et
 * c'est la longueur qui distingue l'arête neuve de celles du relevé. Les deux
 * longueurs choisies ne figurent sur aucune arête de leur niveau.
 */
async function drawAndSelect(
  page: Page, x1: string, y1: string, x2: string, y2: string, length: string,
): Promise<void> {
  await page.keyboard.press('x');
  await page.getByLabel(/Point 1 · X/).fill(x1);
  await page.getByLabel(/Point 1 · Y/).fill(y1);
  await page.getByLabel(/Point 2 · X/).fill(x2);
  await page.getByLabel(/Point 2 · Y/).fill(y2);
  await page.getByRole('button', { name: DRAW }).click();

  await page.getByRole('button', {
    name: new RegExp(`${length}\\.000 (mètres|metres)`),
  }).first().click();
}

test.describe('M4 (partie M) — la largeur héritée du bâtiment', () => {
  test('une arête tracée dans la galerie hérite des 2,4 m du bâtiment', async ({ page }) => {
    await page.goto(GALERIE);
    await ready(page);
    await drawAndSelect(page, '60', '30', '73', '30', '13');

    await expect(page.getByLabel(/Largeur utile|Usable width/)).toHaveValue('2.4');
  });

  /**
   * Le contre-exemple, sur le même site et dans la même session : l'autre
   * bâtiment déclare 1,1 m, et c'est ce que l'arête reçoit. Sans lui, une
   * largeur écrite en dur à 2,4 passerait l'essai précédent.
   */
  test('la même arête tracée dans l’annexe en hérite 1,1 m', async ({ page }) => {
    await page.goto(ANNEXE);
    await ready(page);
    await drawAndSelect(page, '60', '40', '71', '40', '11');

    await expect(page.getByLabel(/Largeur utile|Usable width/)).toHaveValue('1.1');
  });
});

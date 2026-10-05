import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J3.3 (partie J) — la promotion d'une esquisse : l'entourer, puis demander
 * sa conversion.
 *
 * Le choix au lasso et la mise bout à bout sont essayés dans
 * `state/__tests__/sketch-promotion.test.ts`. Ce qui ne se prouve qu'à
 * l'écran : la conversion n'a lieu qu'à la demande ; elle produit le contour
 * en cours, reconnu et arbitré comme un trait ; l'esquisse, elle, reste.
 */
const FOOTPRINTS = '/sites/site-promotion/levels/niveau-promotion/footprints';
const ZONE = /Zone de travail : tracez au stylet|Work area: draw with a stylus/;

type Box = { x: number; y: number; width: number; height: number };

async function zoneBox(page: Page): Promise<Box> {
  const box = await page.getByRole('img', { name: ZONE }).boundingBox();
  if (box === null) throw new Error('zone introuvable');
  return box;
}

async function trace(page: Page, points: readonly (readonly [number, number])[]): Promise<void> {
  const first = points[0];
  if (first === undefined) return;
  await page.mouse.move(first[0], first[1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.up();
}

/** Les quatre coins d'un rectangle esquissé, un peu de travers. */
function corners(box: Box): readonly (readonly [number, number])[] {
  const x0 = box.x + box.width * 0.35;
  const y0 = box.y + box.height * 0.35;
  return [[x0, y0], [x0 + 160, y0 + 3], [x0 + 162, y0 + 100], [x0 - 2, y0 + 98]];
}

/** Un lasso qui entoure largement le milieu de la zone. */
async function lasso(page: Page, box: Box): Promise<void> {
  const [l, t, r, b] = [box.x + box.width * 0.15, box.y + 15, box.x + box.width * 0.9, box.y + box.height - 15];
  await trace(page, [[l, t], [r, t], [r, b], [l, b], [l, t + 2]]);
}

async function vertexValues(page: Page, axis: 'X' | 'Y'): Promise<readonly string[]> {
  return page.getByLabel(new RegExp(`(Sommet|Vertex) \\d+ · ${axis}`))
    .evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value));
}

const PROMOTE = /Convertir en forme|Convert to a shape/;

test.describe('J3.3 (partie J) — la promotion d’une esquisse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('img', { name: ZONE })).toBeVisible();
    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
  });

  test('une esquisse entourée puis convertie devient le contour en cours ; l’esquisse reste', async ({ page }) => {
    const box = await zoneBox(page);
    const c = corners(box);
    const first = c[0];
    if (first === undefined) throw new Error('coin manquant');
    await trace(page, [...c, [first[0] + 1, first[1] + 1]]);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await expect(page.getByRole('button', { name: PROMOTE })).toHaveCount(0);

    await page.getByRole('button', { name: /^(Entourer|Lasso)$/ }).click();
    await lasso(page, box);
    await expect(page.locator('[data-testid="sketch-stroke"][data-selected="true"]')).toHaveCount(1);
    // Rien n'est converti tant qu'on ne le demande pas.
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue|Recognised shape/ })).toHaveCount(0);

    await page.getByRole('button', { name: PROMOTE }).click();
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue : rectangle|Recognised shape: rectangle/ }))
      .toBeVisible();
    expect(new Set(await vertexValues(page, 'X')).size).toBe(2);
    expect(new Set(await vertexValues(page, 'Y')).size).toBe(2);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^(Esquisser|Sketch)$/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('une suite de traits fermée se convertit d’un seul tenant', async ({ page }) => {
    const box = await zoneBox(page);
    const c = corners(box);
    for (let i = 0; i < c.length; i++) {
      const from = c[i];
      const to = c[(i + 1) % c.length];
      if (from === undefined || to === undefined) continue;
      await trace(page, [from, to]);
    }
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(4);

    await page.getByRole('button', { name: /^(Entourer|Lasso)$/ }).click();
    await lasso(page, box);
    await page.getByRole('button', { name: /Convertir en forme \(4 traits\)|Convert to a shape \(4 strokes\)/ }).click();
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue|Recognised shape/ })).toBeVisible();
    expect(await vertexValues(page, 'X')).toHaveLength(4);
  });

  test('un lasso qui n’entoure rien le dit', async ({ page }) => {
    await page.getByRole('button', { name: /^(Entourer|Lasso)$/ }).click();
    await lasso(page, await zoneBox(page));
    await expect(page.getByText(/Le lasso n’entoure entièrement aucun trait|does not fully enclose any sketch stroke/))
      .toBeVisible();
    await expect(page.getByRole('button', { name: PROMOTE })).toHaveCount(0);
  });
});

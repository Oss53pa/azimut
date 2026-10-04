import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J3 (partie J) — la couche d'esquisse dans la zone de travail des empreintes.
 *
 * Les commandes et la lecture sont essayées dans `state/__tests__/sketch.test.ts`
 * et contre la base dans `sketch.db.test.ts`. Ce qui ne se prouve qu'à l'écran :
 * qu'en mode esquisse le trait est gardé tel quel au lieu d'être lu, dans la
 * couleur choisie ; que la pression du stylet en module l'épaisseur ; que la
 * gomme le retire ; que la couche se masque ; que le geste s'annule.
 */
const FOOTPRINTS = '/sites/site-esquisse/levels/niveau-esquisse/footprints';
const ZONE = /Zone de travail : tracez au stylet|Work area: draw with a stylus/;

async function zoneBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.getByRole('img', { name: ZONE }).boundingBox();
  if (box === null) throw new Error('zone introuvable');
  return box;
}

/** Une vague à main levée, de gauche à droite au milieu de la zone. */
async function scribble(page: Page, dy = 0): Promise<void> {
  const box = await zoneBox(page);
  const x0 = box.x + box.width * 0.3;
  const y0 = box.y + box.height * 0.5 + dy;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const [x, y] of [[x0 + 60, y0 - 20], [x0 + 120, y0 + 15], [x0 + 180, y0 - 5]] as const) {
    await page.mouse.move(x, y, { steps: 8 });
  }
  await page.mouse.up();
}

/** Un trait vertical qui coupe la vague, pour la gomme. */
async function crossOut(page: Page): Promise<void> {
  const box = await zoneBox(page);
  const x = box.x + box.width * 0.3 + 120;
  await page.mouse.move(x, box.y + box.height * 0.5 - 60);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * 0.5 + 60, { steps: 12 });
  await page.mouse.up();
}

async function sketchMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
  await expect(page.getByRole('button', { name: /^(Esquisser|Sketch)$/ })).toHaveAttribute('aria-pressed', 'true');
}

test.describe('J3 (partie J) — la couche d’esquisse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('img', { name: ZONE })).toBeVisible();
  });

  test('en mode esquisse, le trait est gardé tel quel, dans la couleur choisie', async ({ page }) => {
    await sketchMode(page);
    await page.getByRole('button', { name: /^(Brique|Brick)$/ }).click();
    await scribble(page);

    const stroke = page.getByTestId('sketch-stroke');
    await expect(stroke).toHaveCount(1);
    await expect(stroke.locator('line').first()).toHaveAttribute('stroke', 'var(--sketch-brick)');
    // Le trait n'est pas lu : aucune forme reconnue, le contour proposé intact.
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue|Recognised shape/ })).toHaveCount(0);
    expect(await stroke.locator('line').count()).toBeGreaterThan(10);
  });

  test('hors mode esquisse, le même trait est lu comme une forme', async ({ page }) => {
    await sketchMode(page);
    await scribble(page);
    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
    await scribble(page, 40);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await expect(page.getByText(/Forme reconnue|ne ressemble à aucune forme|Recognised shape|does not look like/).first())
      .toBeVisible();
  });

  test('la pression du stylet module l’épaisseur du trait', async ({ page }) => {
    await sketchMode(page);
    const zone = page.getByRole('img', { name: ZONE });
    const box = await zoneBox(page);
    const at = (k: number): { clientX: number; clientY: number } =>
      ({ clientX: box.x + box.width * (0.3 + k * 0.1), clientY: box.y + box.height * 0.5 });
    const pen = { pointerType: 'pen', pointerId: 7, bubbles: true };
    await zone.dispatchEvent('pointerdown', { ...pen, ...at(0), buttons: 1, pressure: 0.1 });
    await zone.dispatchEvent('pointermove', { ...pen, ...at(1), buttons: 1, pressure: 0.1 });
    await zone.dispatchEvent('pointermove', { ...pen, ...at(2), buttons: 1, pressure: 1 });
    await zone.dispatchEvent('pointerup', { ...pen, ...at(2), buttons: 0, pressure: 0 });

    const widths = await page.getByTestId('sketch-stroke').locator('line')
      .evaluateAll(lines => lines.map(l => Number(l.getAttribute('stroke-width'))));
    expect(widths).toHaveLength(2);
    expect(widths[1]).toBeGreaterThan(widths[0] ?? Infinity);
  });

  test('la gomme retire le trait qu’elle touche', async ({ page }) => {
    await sketchMode(page);
    await scribble(page);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await page.getByRole('button', { name: /^(Gomme|Eraser)$/ }).click();
    await crossOut(page);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(0);
  });

  test('la couche se masque, et l’on ne trace pas sur une couche masquée', async ({ page }) => {
    await sketchMode(page);
    await scribble(page);
    await page.getByRole('button', { name: /Masquer l’esquisse|Hide the sketch/ }).click();
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(0);
    await scribble(page, 30);
    await expect(page.getByText(/L’esquisse est masquée|The sketch is hidden/)).toBeVisible();
    await page.getByRole('button', { name: /Montrer l’esquisse|Show the sketch/ }).click();
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
  });

  test('un trait d’esquisse s’annule d’une frappe', async ({ page }) => {
    await sketchMode(page);
    await scribble(page);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(0);
  });
});

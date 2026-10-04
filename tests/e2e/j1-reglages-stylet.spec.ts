import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J1.4 et J1.5 (partie J) — les réglages du fond de décalque et la gomme du
 * stylet.
 *
 * Les réglages sont essayés en mémoire dans `viewport/__tests__/backdrop-settings.test.ts`,
 * la lecture des boutons dans `editor/ink/__tests__/pen-eraser.test.ts`. Ce qui
 * ne se prouve qu'à l'écran : l'opacité appliquée au plan, les formes tracées
 * masquées puis retrouvées au rechargement, et le bout gomme qui efface
 * l'esquisse mais jamais une empreinte.
 */
const SITE = 'site-reglages';
const LEVEL = 'niveau-reglages';
const FOOTPRINTS = `/sites/${SITE}/levels/${LEVEL}/footprints`;
const ZONE = /Zone de travail : tracez au stylet|Work area: draw with a stylus/;

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function navigate(page: Page, path: string): Promise<void> {
  await page.evaluate(target => {
    history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function zoneBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.getByRole('img', { name: ZONE }).boundingBox();
  if (box === null) throw new Error('zone introuvable');
  return box;
}

async function drawRectangle(page: Page): Promise<void> {
  const box = await zoneBox(page);
  const x0 = box.x + box.width * 0.3;
  const y0 = box.y + box.height * 0.3;
  const corners = [[x0, y0], [x0 + 200, y0 + 4], [x0 + 203, y0 + 130], [x0 - 2, y0 + 127], [x0 + 1, y0 + 2]] as const;
  await page.mouse.move(corners[0][0], corners[0][1]);
  await page.mouse.down();
  for (const [x, y] of corners.slice(1)) await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

/** Un trait de stylet horizontal au milieu de la zone, boutons au choix. */
async function penStroke(page: Page, buttons: number): Promise<void> {
  const zone = page.getByRole('img', { name: ZONE });
  const box = await zoneBox(page);
  const y = box.y + box.height * 0.5;
  const pen = { pointerType: 'pen', pointerId: 11, bubbles: true, pressure: 0.5 };
  await zone.dispatchEvent('pointerdown', { ...pen, clientX: box.x + box.width * 0.2, clientY: y, buttons });
  for (const k of [0.35, 0.5, 0.65, 0.8]) {
    await zone.dispatchEvent('pointermove', { ...pen, clientX: box.x + box.width * k, clientY: y, buttons });
  }
  await zone.dispatchEvent('pointerup', { ...pen, clientX: box.x + box.width * 0.8, clientY: y, buttons: 0 });
}

test.describe('J1.4 (partie J) — les réglages du fond de décalque', () => {
  test('l’opacité du plan calé se règle', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/plan`);
    await page.getByLabel(/Fichier du fond de plan|Base plan file/)
      .setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
    for (const [label, value] of [
      [/Point A · X/, '0'], [/Point A · Y/, '0'], [/Point B · X/, '200'], [/Point B · Y/, '0'],
    ] as const) {
      await page.getByLabel(label).fill(value);
    }
    await page.getByLabel(/Distance réelle|Real distance/).fill('20');
    await page.getByLabel(/Azimut du nord|North azimuth/).fill('0');
    await page.getByRole('button', { name: /^Valider le calage$|^Validate calibration$/ }).click();
    await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();

    await navigate(page, FOOTPRINTS);
    const image = page.getByRole('img', { name: ZONE }).locator('image');
    await expect(image).toHaveAttribute('opacity', '0.6');
    await page.getByLabel(/Opacité du fond|Background opacity/).fill('0.3');
    await expect(image).toHaveAttribute('opacity', '0.3');
  });

  test('les formes tracées se masquent, et le réglage se retrouve au rechargement', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await drawRectangle(page);
    await page.getByLabel(/Code de cellule|Unit code/).fill('R01');
    await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
    await expect(page.getByTestId('ink-footprint')).toHaveCount(1);

    await page.getByLabel(/Montrer les formes tracées|Show drawn shapes/).uncheck();
    await expect(page.getByTestId('ink-footprint')).toHaveCount(0);
    // Sans fond, l'opacité n'a rien à régler et n'est pas proposée.
    await expect(page.getByLabel(/Opacité du fond|Background opacity/)).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel(/Montrer les formes tracées|Show drawn shapes/)).not.toBeChecked();
  });
});

test.describe('J1.5 (partie J) — la gomme du stylet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('img', { name: ZONE })).toBeVisible();
  });

  test('le bout gomme efface l’esquisse, quel que soit l’outil choisi', async ({ page }) => {
    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
    await penStroke(page, 1);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^(Feutre|Felt pen)$/ })).toHaveAttribute('aria-pressed', 'true');
    await penStroke(page, 32);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(0);
  });

  test('le bouton latéral gomme aussi', async ({ page }) => {
    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
    await penStroke(page, 1);
    await penStroke(page, 2);
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(0);
  });

  test('hors esquisse, la gomme du stylet ne touche à rien et le dit', async ({ page }) => {
    await penStroke(page, 32);
    await expect(page.getByText(/La gomme du stylet n’efface que l’esquisse|The stylus eraser only erases the sketch/))
      .toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue|Recognised shape/ })).toHaveCount(0);
  });
});

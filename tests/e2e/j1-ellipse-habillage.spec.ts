import { test, expect } from '@playwright/test';
import type { Locator } from '@playwright/test';

/**
 * J1.2 (partie J) — « Cercle ou ovale approximatif : ellipse, cercle si
 * proche », dans l'éditeur d'habillage, avec l'outil Ellipse et le stylet.
 *
 * La lecture du trait est essayée dans `editor/ink/__tests__/editor-shapes.test.ts`.
 * Ce qui ne se prouve qu'à l'écran : le trait au stylet devient une ellipse
 * de l'habillage, et la souris garde le cadre tiré d'un coin à l'autre.
 */
async function penOval(canvas: Locator, rx: number, ry: number, tilt_deg = 0): Promise<void> {
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canevas introuvable');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const t = (tilt_deg * Math.PI) / 180;
  const pen = { pointerType: 'pen', pointerId: 21, bubbles: true, pressure: 0.5, button: 0 };
  const at = (a: number): { clientX: number; clientY: number } => {
    const x = rx * Math.cos(a) * (1 + 0.02 * Math.sin(5 * a));
    const y = ry * Math.sin(a);
    return { clientX: cx + x * Math.cos(t) - y * Math.sin(t), clientY: cy + x * Math.sin(t) + y * Math.cos(t) };
  };
  await canvas.dispatchEvent('pointerdown', { ...pen, ...at(0), buttons: 1 });
  for (let i = 1; i <= 40; i++) {
    await canvas.dispatchEvent('pointermove', { ...pen, ...at((i / 40) * 2 * Math.PI), buttons: 1 });
  }
  await canvas.dispatchEvent('pointerup', { ...pen, ...at(2 * Math.PI), buttons: 0 });
}

test.describe('J1.2 (partie J) — le cercle et l’ovale dans l’éditeur d’habillage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^(Atelier de dessin|Drawing workshop)$/ }).first().click();
    await page.getByRole('toolbar', { name: /./ }).getByRole('button', { name: /^Ellipse/ }).click();
    await expect(page.getByRole('button', { name: /^Ellipse/, pressed: true })).toBeVisible();
  });

  test('un ovale au stylet devient une ellipse ; un cercle approximatif, un cercle', async ({ page }) => {
    const canvas = page.getByRole('img', { name: /Éditeur|Editor/ });
    const before = await canvas.locator('ellipse').count();
    await penOval(canvas, 120, 60);
    await expect(canvas.locator('ellipse')).toHaveCount(before + 1);
    const added = canvas.locator('ellipse').last();
    expect(Number(await added.getAttribute('rx'))).toBeGreaterThan(Number(await added.getAttribute('ry')));

    await penOval(canvas, 70, 68);
    await expect(canvas.locator('ellipse')).toHaveCount(before + 2);
    const circle = canvas.locator('ellipse').last();
    expect(await circle.getAttribute('rx')).toBe(await circle.getAttribute('ry'));
  });

  test('un ovale de biais n’est pas redressé d’office, et le dit', async ({ page }) => {
    const canvas = page.getByRole('img', { name: /Éditeur|Editor/ });
    const before = await canvas.locator('ellipse').count();
    await penOval(canvas, 120, 50, 45);
    await expect(page.getByText(/Ovale tracé de biais|Oval drawn at an angle/)).toBeAttached();
    await expect(canvas.locator('ellipse')).toHaveCount(before);
  });
});

test.describe('J1.2 (partie J) — le rectangle au stylet dans l’éditeur d’habillage', () => {
  test('un rectangle approximatif au stylet devient un rectangle de l’habillage', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^(Atelier de dessin|Drawing workshop)$/ }).first().click();
    await page.getByRole('toolbar', { name: /./ }).getByRole('button', { name: /^Rectangle/ }).click();
    await expect(page.getByRole('button', { name: /^Rectangle/, pressed: true })).toBeVisible();

    const canvas = page.getByRole('img', { name: /Éditeur|Editor/ });
    const before = await canvas.locator('rect').count();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error('canevas introuvable');
    const [x0, y0] = [box.x + box.width * 0.35, box.y + box.height * 0.35];
    const corners = [[x0, y0], [x0 + 180, y0 + 3], [x0 + 182, y0 + 110], [x0 - 2, y0 + 108], [x0 + 1, y0 + 2]] as const;
    const pen = { pointerType: 'pen', pointerId: 22, bubbles: true, pressure: 0.5, button: 0 };
    await canvas.dispatchEvent('pointerdown', { ...pen, clientX: x0, clientY: y0, buttons: 1 });
    for (let i = 0; i < corners.length - 1; i++) {
      const [ax, ay] = corners[i] ?? [x0, y0];
      const [bx, by] = corners[i + 1] ?? [x0, y0];
      for (let k = 1; k <= 8; k++) {
        await canvas.dispatchEvent('pointermove', {
          ...pen, clientX: ax + ((bx - ax) * k) / 8, clientY: ay + ((by - ay) * k) / 8, buttons: 1,
        });
      }
    }
    await canvas.dispatchEvent('pointerup', { ...pen, clientX: x0 + 1, clientY: y0 + 2, buttons: 0 });
    await expect(canvas.locator('rect')).toHaveCount(before + 1);
    await expect(page.getByText(/Rectangle reconnu|Rectangle recognised/)).toBeAttached();
  });
});

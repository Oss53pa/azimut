import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M2 (partie M), version 27 — « Un fichier sans contenu vectoriel exploitable
 * est accepté en dernier recours et lève `IMPORT.RASTER_PRECISION_LIMITED`.
 * [...] c'est le contenu qui est contrôlé, jamais l'extension. »
 *
 * Éprouvé sur l'écran réel : l'avertissement paraît pour un PDF sans tracé et
 * pour une image, il ne paraît pas pour un PDF qui porte un tracé, et il
 * n'empêche pas le calage.
 */

const PLAN = '/sites/site-essai/levels/niveau-essai/plan';
const WARNING = /Plan sans contenu vectoriel exploitable|Plan without usable vector content/;

async function drop(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<void> {
  await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles({ name, mimeType, buffer });
}

const PDF_WITH_PATH = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Length 15 >>\nstream\n0 0 m 100 0 l S\nendstream\nendobj\n%%EOF\n',
  'latin1',
);
const PDF_WITHOUT_PATH = Buffer.from('%PDF-1.4 fond de plan d’essai');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

test.describe('M2 (partie M) — précision limitée, jugée sur le contenu', () => {
  test('un PDF sans tracé lève l’avertissement, sans bloquer le calage', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', PDF_WITHOUT_PATH);
    await expect(page.getByText(WARNING)).toBeVisible();
    await expect(page.getByRole('button', { name: /Valider le calage|Validate calibration/ })).toBeEnabled();
  });

  test('une image nommée .pdf est jugée sur son contenu', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', PNG);
    await expect(page.getByText(WARNING)).toBeVisible();
  });

  /**
   * L'absence d'un avertissement ne se constate qu'une fois la lecture finie.
   * Le fond vectoriel est donc déposé entre deux fonds sans tracé : le second
   * avertissement prouve que les lectures aboutissent, et entre les deux
   * l'écran n'en montre aucun.
   */
  test('un PDF qui porte un tracé ne lève rien', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', PDF_WITHOUT_PATH);
    await expect(page.getByText(WARNING)).toBeVisible();
    await drop(page, 'niveau-0.pdf', 'application/pdf', PDF_WITH_PATH);
    await expect(page.getByText(WARNING)).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(WARNING)).toHaveCount(0);
    await drop(page, 'niveau-1.pdf', 'application/pdf', PDF_WITHOUT_PATH);
    await expect(page.getByText(WARNING)).toBeVisible();
  });
});

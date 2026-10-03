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
 *
 * Version 28 : le format aussi se juge sur le contenu, et le nombre de pages
 * d'un PDF se lit : un PDF de plusieurs pages demande la sienne.
 *
 * Version 29 : la nature se juge sur la page retenue. Les PDF d'essai portent
 * donc un arbre de pages, que le lecteur suit depuis le catalogue.
 */

const PLAN = '/sites/site-essai/levels/niveau-essai/plan';
const WARNING = /Plan sans contenu vectoriel exploitable|Plan without usable vector content/;

async function drop(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<void> {
  await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles({ name, mimeType, buffer });
}

/** Un PDF dont les objets sont écrits dans l'ordre, numérotés à partir de 1. */
function pdf(...objects: readonly string[]): Buffer {
  const body = objects.map((object, i) => `${i + 1} 0 obj\n${object}\nendobj\n`).join('');
  return Buffer.from(`%PDF-1.7\n${body}trailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}

const CATALOG = '<< /Type /Catalog /Pages 2 0 R >>';
const TRACE = '<< /Length 15 >>\nstream\n0 0 m 100 0 l S\nendstream';
const PDF_WITH_PATH = pdf(CATALOG, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>', TRACE);
const PDF_WITHOUT_PATH = pdf(CATALOG, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R >>');
/** Deux pages : la première porte un tracé, la seconde n'en porte aucun. */
const PDF_TRACE_ON_FIRST_PAGE = pdf(
  CATALOG,
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>',
  '<< /Type /Page /Parent 2 0 R >>',
  TRACE,
);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
/** L'en-tête d'un DWG : aucun des formats que M2 (partie M) accepte. */
const DWG = Buffer.from('AC1032\0\0\0\0\0', 'latin1');
const PDF_THREE_PAGES = pdf(
  CATALOG,
  '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
  '<< /Type /Page /Parent 2 0 R >>',
  '<< /Type /Page /Parent 2 0 R >>',
  '<< /Type /Page /Parent 2 0 R >>',
);

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

  test('un DWG nommé .pdf est refusé : le contenu décide, non le nom', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', DWG);
    await expect(page.getByText(/Format de fichier non pris en charge|File format not supported/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Valider le calage|Validate calibration/ })).toBeDisabled();
  });

  test('un PDF de trois pages demande la sienne, puis l’accepte', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', PDF_THREE_PAGES);
    const field = page.getByLabel(/Page du fond de plan|Base plan page/);
    await expect(field).toBeVisible();
    await expect(page.getByRole('button', { name: /Valider le calage|Validate calibration/ })).toBeDisabled();
    await field.fill('2');
    await expect(page.getByRole('button', { name: /Valider le calage|Validate calibration/ })).toBeEnabled();
  });

  test('la nature se juge sur la page retenue, non sur le fichier entier', async ({ page }) => {
    await page.goto(PLAN);
    await drop(page, 'niveau-0.pdf', 'application/pdf', PDF_TRACE_ON_FIRST_PAGE);
    const field = page.getByLabel(/Page du fond de plan|Base plan page/);
    await field.fill('2');
    await expect(page.getByText(WARNING)).toBeVisible();
    await field.fill('1');
    await expect(page.getByText(WARNING)).toHaveCount(0);
    await field.fill('2');
    await expect(page.getByText(WARNING)).toBeVisible();
  });
});

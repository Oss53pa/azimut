import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M3 (partie M) critère 4 — « La duplication en série de 20 cellules se fait
 * en une commande annulable d'un seul geste. »
 *
 * Les deux moitiés se prouvent ici, et nulle part ailleurs : le jugement de la
 * série tient dans `state/__tests__/footprint-series.test.ts`, mais « un seul
 * geste » et « une commande annulable » tiennent au magasin de commandes et à
 * l'écran. Vingt copies qui s'annulent en vingt frappes passeraient tous les
 * essais unitaires et rateraient le critère.
 */
const SITE = 'site-serie';
const LEVEL = 'niveau-serie';
const FOOTPRINTS = `/sites/${SITE}/levels/${LEVEL}/footprints`;

/** Trace une première cellule : c'est d'elle que la série part. */
async function drawReference(page: Page, code: string): Promise<void> {
  await page.getByLabel(/Code de cellule|Unit code/).fill(code);
  await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
  await expect(page.getByText(/Empreintes\s*1|Footprints\s*1/)).toBeVisible();
}

async function setSeries(page: Page, dx: string, count: string): Promise<void> {
  await page.getByLabel(/Pas en X|Step in X/).fill(dx);
  await page.getByLabel(/Nombre de copies|Number of copies/).fill(count);
}

test.describe('M3 (partie M) critère 4 — la duplication en série', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FOOTPRINTS);
  });

  test('vingt copies s’écrivent d’un seul geste', async ({ page }) => {
    await drawReference(page, 'B01');
    await setSeries(page, '6', '20');
    await page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }).click();
    await expect(page.getByText(/Empreintes\s*21|Footprints\s*21/)).toBeVisible();
  });

  /**
   * Le cœur du critère : une seule annulation défait les vingt copies, et
   * laisse l'original. Vingt annulations successives seraient une punition
   * (E5.2), et c'est exactement ce que vérifie ce passage.
   */
  test('une seule annulation défait les vingt copies', async ({ page }) => {
    await drawReference(page, 'B01');
    await setSeries(page, '6', '20');
    await page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }).click();
    await expect(page.getByText(/Empreintes\s*21|Footprints\s*21/)).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByText(/Empreintes\s*1|Footprints\s*1/)).toBeVisible();
  });

  /**
   * M3 (partie M) annonce `Ctrl+D` dans sa table des raccourcis. La table
   * était affichée et liée à rien.
   */
  test('le raccourci Ctrl+D déclenche la série', async ({ page }) => {
    await drawReference(page, 'B01');
    await setSeries(page, '6', '3');
    // Hors d'un champ de saisie : c'est là qu'un raccourci d'écran agit.
    await page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }).focus();
    await page.keyboard.press('Control+d');
    await expect(page.getByText(/Empreintes\s*4|Footprints\s*4/)).toBeVisible();
  });

  /**
   * « Elle est en évidence et non enfouie. » L'action est visible sans ouvrir
   * de menu, dès l'ouverture de l'écran, et elle nomme son sujet.
   */
  test('l’action est visible sans menu, et dit de quoi la série part', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }),
    ).toBeVisible();
    await expect(page.getByText(
      /Fermez une empreinte|Close a footprint/,
    )).toBeVisible();

    await drawReference(page, 'B01');
    await expect(page.getByText(/Série à partir de B01|Series from B01/)).toBeVisible();
  });

  /**
   * Le contre-exemple : la série entière est refusée quand un de ses codes est
   * déjà pris, et rien n'est écrit. Une série à moitié écrite laisserait une
   * trame trouée, à défaire copie par copie.
   *
   * Le cas se produit au deuxième appui sur le même bouton : la référence
   * reste l'empreinte tracée, et la série redemande les codes qu'elle vient
   * d'écrire.
   */
  test('un second appui refuse la série entière, sans rien écrire', async ({ page }) => {
    await drawReference(page, 'B01');
    await setSeries(page, '6', '3');
    await page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }).click();
    await expect(page.getByText(/Empreintes\s*4|Footprints\s*4/)).toBeVisible();

    await page.getByRole('button', { name: /Dupliquer en série|Duplicate in series/ }).click();
    await expect(page.getByText(
      /Deux cellules portent le même code|Two cells share the same code/,
    ).first()).toBeVisible();
    // Rien n'a été écrit : ni les copies en conflit, ni les autres.
    await expect(page.getByText(/Empreintes\s*4|Footprints\s*4/)).toBeVisible();
  });
});

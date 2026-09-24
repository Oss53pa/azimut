import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M1bis (partie M) — fiche de site, bâtiments et niveaux.
 *
 * Critère 1 : « Un site à deux bâtiments et quatre niveaux se crée
 * entièrement par cet écran, sans intervention en base. » C'est le critère qui
 * ne se prouve nulle part ailleurs, et c'est lui qui débloque T-1.5 : sans
 * second niveau, l'outil de liaison verticale n'a rien à relier.
 *
 * Critère 5 : le parcours complet au clavier seul. Aucun clic dans l'essai
 * correspondant.
 */
const SITE = 'site-fiche';
const RECORD = `/sites/${SITE}`;

const NEW_BUILDING = /^Nouveau bâtiment$|^New building$/;
const CREATE_BUILDING = /^Créer le bâtiment$|^Create the building$/;
const NEW_LEVEL = /^Nouveau niveau$|^New level$/;
const CREATE_LEVEL = /^Créer le niveau$|^Create the level$/;

async function ready(page: Page): Promise<void> {
  await page.getByRole('button', { name: NEW_BUILDING }).first().waitFor({ state: 'attached' });
}

/** Ouvre le formulaire de bâtiment et le renseigne. */
async function addBuilding(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: NEW_BUILDING }).first().click();
  // Le champ du formulaire, et non celui de renommage d'un bâtiment déjà
  // créé : les deux portent le même libellé, et seul le panneau les sépare.
  const form = page.locator('section', {
    has: page.getByRole('heading', { name: NEW_BUILDING }),
  });
  await form.getByLabel(/Nom du bâtiment|Building name/).fill(name);
  await form.getByRole('button', { name: CREATE_BUILDING }).click();
}

/** Ajoute un niveau au bâtiment nommé. */
async function addLevel(
  page: Page, building: string, name: string, ordinal: string, elevation: string,
): Promise<void> {
  const panel = page.locator('section', { has: page.getByRole('heading', { name: building }) });
  await panel.getByRole('button', { name: NEW_LEVEL }).click();
  await panel.getByLabel(/^Nom du niveau$|^Level name$/).last().fill(name);
  await panel.getByLabel(/^Rang$|^Ordinal$/).last().fill(ordinal);
  await panel.getByLabel(/^Altitude/).last().fill(elevation);
  await panel.getByRole('button', { name: CREATE_LEVEL }).click();
}

test.describe('M1bis (partie M) — la fiche de site', () => {
  test('un site vide invite à créer un bâtiment, et le dit', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);
    await expect(page.getByText(
      /ne porte aucun bâtiment|holds no building/,
    )).toBeVisible();
    await expect(page.getByText(/Bâtiments\s*0|Buildings\s*0/)).toBeVisible();
    await expect(page.getByText(/Niveaux\s*0|Levels\s*0/)).toBeVisible();
  });

  /** Critère 1, le cœur de l'écran. */
  test('deux bâtiments et quatre niveaux se créent par l’écran seul', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);

    await addBuilding(page, 'Bâtiment A');
    await addBuilding(page, 'Bâtiment B');
    // Chaque bâtiment naît avec son premier niveau : deux bâtiments, deux
    // niveaux. Un bâtiment sans niveau est un état inutile.
    await expect(page.getByText(/Bâtiments\s*2|Buildings\s*2/)).toBeVisible();
    await expect(page.getByText(/Niveaux\s*2|Levels\s*2/)).toBeVisible();

    await addLevel(page, 'Bâtiment A', 'R+1', '1', '4.2');
    await addLevel(page, 'Bâtiment B', 'R+1', '1', '3.8');
    await expect(page.getByText(/Niveaux\s*4|Levels\s*4/)).toBeVisible();
  });

  /** Critère 2. */
  test('deux niveaux de même rang dans un bâtiment sont refusés', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);
    await addBuilding(page, 'Bâtiment A');
    // Le premier niveau porte le rang zéro : le reprendre doit échouer.
    await addLevel(page, 'Bâtiment A', 'Mezzanine', '0', '2.5');

    await expect(page.getByText(
      /Deux niveaux de même rang|Two levels share the same ordinal/,
    )).toBeVisible();
    await expect(page.getByText(/Niveaux\s*1|Levels\s*1/)).toBeVisible();
  });

  /**
   * Critère 3. Le niveau du parcours porte des nœuds : la suppression est
   * refusée par prévention, et l'écran dit ce qu'il porte.
   */
  test('un niveau peuplé ne se supprime pas, et l’écran dit pourquoi', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);
    await addBuilding(page, 'Bâtiment A');

    // Le rang du niveau créé avec le bâtiment est zéro ; son identifiant vient
    // de la session, on l'atteint par le graphe en posant un nœud dessus.
    const levelId = await page.evaluate(() => {
      const raw = localStorage.getItem('azimut.session.site-fiche') ?? '{}';
      const parsed = JSON.parse(raw) as {
        rows?: { table: string; id: string }[];
      };
      return (parsed.rows ?? []).find(row => row.table === 'level')?.id ?? '';
    });
    expect(levelId).not.toBe('');

    await page.goto(`/sites/${SITE}/levels/${levelId}/graph`);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();

    await page.goto(RECORD);
    await ready(page);
    await expect(page.getByText(
      /Un niveau peuplé ne se supprime pas|A populated level cannot be deleted/,
    )).toBeVisible();
    await expect(page.getByRole('button', { name: /^Supprimer$|^Delete$/ }).first())
      .toBeDisabled();
  });

  /** M7 (partie M), règle 9 : la confirmation nomme la conséquence. */
  test('supprimer un niveau vide demande une confirmation qui nomme la conséquence', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);
    await addBuilding(page, 'Bâtiment A');
    await addLevel(page, 'Bâtiment A', 'R+1', '1', '4.2');
    await expect(page.getByText(/Niveaux\s*2|Levels\s*2/)).toBeVisible();

    await page.getByRole('button', { name: /^Supprimer$|^Delete$/ }).last().click();
    await expect(page.getByText(
      /Son plan calé et son calage partent avec lui|Its calibrated plan and its calibration go with it/,
    )).toBeVisible();

    await page.getByRole('button', { name: /^Supprimer le niveau$|^Delete the level$/ }).click();
    await expect(page.getByText(/Niveaux\s*1|Levels\s*1/)).toBeVisible();

    // E5.2 : un geste, une entrée d'annulation. Le niveau revient.
    await page.keyboard.press('Control+z');
    await expect(page.getByText(/Niveaux\s*2|Levels\s*2/)).toBeVisible();
  });

  /** Critère 5 : le parcours complet au clavier seul, sans un clic. */
  test('un bâtiment et un niveau se créent au clavier seul', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);

    await page.getByRole('button', { name: NEW_BUILDING }).first().press('Enter');
    const form = page.locator('section', {
      has: page.getByRole('heading', { name: NEW_BUILDING }),
    });
    await form.getByLabel(/Nom du bâtiment|Building name/).fill('Bâtiment A');
    await form.getByRole('button', { name: CREATE_BUILDING }).press('Enter');
    await expect(page.getByText(/Bâtiments\s*1|Buildings\s*1/)).toBeVisible();

    await page.getByRole('button', { name: NEW_LEVEL }).first().press('Enter');
    await page.getByLabel(/^Nom du niveau$|^Level name$/).last().fill('R+1');
    await page.getByLabel(/^Rang$|^Ordinal$/).last().fill('1');
    await page.getByLabel(/^Altitude/).last().fill('4.2');
    await page.getByRole('button', { name: CREATE_LEVEL }).press('Enter');
    await expect(page.getByText(/Niveaux\s*2|Levels\s*2/)).toBeVisible();
  });

  /**
   * Critère 4 : « L'altitude saisie est celle que lit la géométrie. » La
   * liaison verticale en tire sa longueur, et c'est le seul endroit où
   * l'altitude se lit sans intermédiaire.
   */
  test('l’altitude saisie est celle que lit la géométrie', async ({ page }) => {
    await page.goto(RECORD);
    await ready(page);
    await addBuilding(page, 'Bâtiment A');
    await addLevel(page, 'Bâtiment A', 'R+1', '1', '4.2');

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('azimut.session.site-fiche') ?? '{}';
      const parsed = JSON.parse(raw) as {
        rows?: { table: string; values: Record<string, unknown> }[];
      };
      return (parsed.rows ?? [])
        .filter(row => row.table === 'level')
        .map(row => String(row.values['elevation_m']));
    });
    expect(stored).toContain('4.2');
  });
});

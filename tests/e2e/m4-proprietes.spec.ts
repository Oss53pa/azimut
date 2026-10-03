import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M4 (partie M) — « Propriétés d'un nœud » et « Propriétés d'une arête ».
 *
 * Les deux panneaux étaient spécifiés au champ près et inatteignables : la
 * sélection restait nulle, et aucun geste ne la posait. Libellé, position,
 * largeur, pente, sens et cheminement d'évacuation existaient à l'écran sans
 * qu'on puisse jamais les voir.
 *
 * L'essai porte donc sur la chaîne entière : la vue rend le graphe, un geste
 * y sélectionne, le panneau se remplit, la modification s'écrit, et la
 * longueur se recalcule quand la position change.
 */
const SITE = 'site-props';
const LEVEL = 'niveau-props';
const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;

const NEXT_KIND = /Type du prochain nœud|Type of the next node/;

/** Pose deux nœuds et l'arête qui les relie. */
async function drawPair(page: Page): Promise<void> {
  await page.getByLabel(NEXT_KIND).selectOption('entrance');
  await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
  await page.getByLabel(NEXT_KIND).selectOption('junction');
  await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
  await page.getByRole('button', { name: /Tracer les arêtes|Draw the edges/ }).click();
  await expect(page.getByText(/Arêtes\s*1|Edges\s*1/)).toBeVisible();
}

test.describe('M4 (partie M) — le panneau de propriétés', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GRAPH);
  });

  test('la zone de travail rend le graphe et la sélection le remplit', async ({ page }) => {
    await drawPair(page);

    // Sans sélection, le panneau le dit plutôt que d'afficher des champs vides.
    await expect(page.getByText(/Sélectionnez un nœud|Select a node/)).toBeVisible();

    await page.getByRole('button', { name: /Nœud Entrée|Entrance node/ }).click();
    await expect(page.getByLabel(/^Type$/)).toHaveValue('entrance');
    await expect(page.getByLabel(/Position X/)).toBeVisible();
  });

  test('une modification de nœud s’écrit, et s’annule', async ({ page }) => {
    await drawPair(page);
    await page.getByRole('button', { name: /Nœud Entrée|Entrance node/ }).click();

    await page.getByLabel(/Libellé|Label/).fill('Entrée nord');
    await page.getByRole('button', { name: /Appliquer les propriétés|Apply properties/ }).click();

    // Le nom accessible du nœud vient de ses données métier (E6.3) : il porte
    // donc le libellé écrit.
    await expect(page.getByRole('button', { name: /Entrée nord/ })).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: /Entrée nord/ })).toHaveCount(0);
  });

  /**
   * Le cœur de M4 (partie M) : « La longueur est recalculée à toute modification de
   * position. » L'incohérence ne se verrait pas à l'écran — une arête dont la
   * longueur ne correspond plus à ses extrémités a la même allure qu'une arête
   * juste — et se paierait au premier calcul d'itinéraire.
   */
  test('déplacer un nœud recalcule la longueur de son arête', async ({ page }) => {
    await drawPair(page);

    await page.getByRole('button', { name: /Arête de/ }).click();
    const length = page.getByLabel(/Longueur|Length/);
    await expect(length).toHaveValue('5');

    await page.getByRole('button', { name: /Nœud Carrefour|Junction node/ }).click();
    await page.getByLabel(/Position X/).fill('20');
    await page.getByRole('button', { name: /Appliquer les propriétés|Apply properties/ }).click();

    await page.getByRole('button', { name: /Arête de/ }).click();
    await expect(page.getByLabel(/Longueur|Length/)).toHaveValue('20');
  });

  test('une modification d’arête s’écrit', async ({ page }) => {
    await drawPair(page);
    await page.getByRole('button', { name: /Arête de/ }).click();

    await page.getByLabel(/Largeur utile|Usable width/).fill('2.2');
    await page.getByLabel(/Accessible/).uncheck();
    await page.getByRole('button', { name: /Appliquer les propriétés|Apply properties/ }).click();

    await page.getByRole('button', { name: /Nœud Entrée|Entrance node/ }).click();
    await page.getByRole('button', { name: /Arête de/ }).click();
    await expect(page.getByLabel(/Largeur utile|Usable width/)).toHaveValue('2.2');
    await expect(page.getByLabel(/Accessible/)).not.toBeChecked();
  });

  /**
   * M7.2 (partie M) : « Toute valeur saisissable au pointeur l'est aussi au
   * clavier. » La sélection en fait partie : un graphe qu'on ne peut
   * sélectionner qu'à la souris rend le panneau inatteignable au clavier.
   */
  test('la sélection se fait au clavier', async ({ page }) => {
    await drawPair(page);
    await page.getByRole('button', { name: /Nœud Entrée|Entrance node/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel(/^Type$/)).toHaveValue('entrance');
  });
});

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M4 (partie M) critère 1 — « Un axe tracé en une passe produit les nœuds et
 * arêtes attendus, sans doublon. »
 *
 * Le jugement de l'axe tient dans `state/__tests__/graph-axis.test.ts`. Ce
 * qui se prouve ici et nulle part ailleurs : la passe est un geste — un seul
 * appui, une seule annulation — et l'écran dit ce qu'il a repris. Sans ce
 * compte rendu, « sans doublon » serait invérifiable à l'usage : un graphe a
 * la même allure qu'il ait doublé un nœud ou non.
 */
const SITE = 'site-axe';
const LEVEL = 'niveau-axe';
const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;

const DRAW = /Tracer l’axe|Draw the axis/;
const ADD = /Ajouter un point|Add a point/;

async function setPoint(page: Page, n: number, x: string, y: string): Promise<void> {
  await page.getByLabel(new RegExp(`Point ${String(n)} · X`)).fill(x);
  await page.getByLabel(new RegExp(`Point ${String(n)} · Y`)).fill(y);
}

test.describe('M4 (partie M) critère 1 — l’axe de circulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GRAPH);
    // M4 (partie M) donne une touche à chaque outil, et les champs de l'axe
    // n'appartiennent qu'à l'outil « Axe de circulation ». La frappe vaut
    // preuve que la table des touches est liée : elle ne l'était pas, et la
    // barre annonçait `X` sans que rien ne l'écoute.
    await page.locator('[role="toolbar"] button').first().waitFor({ state: 'attached' });
    await page.keyboard.press('x');
    await expect(
      page.getByRole('button', { name: /Axe de circulation|Circulation axis/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('une passe produit les nœuds et les arêtes attendus', async ({ page }) => {
    await page.getByRole('button', { name: ADD }).click();
    await setPoint(page, 1, '0', '0');
    await setPoint(page, 2, '10', '0');
    await setPoint(page, 3, '20', '0');
    await page.getByRole('button', { name: DRAW }).click();

    await expect(page.getByText(/Nœuds\s*3|Nodes\s*3/)).toBeVisible();
    await expect(page.getByText(/Arêtes\s*2|Edges\s*2/)).toBeVisible();
  });

  /**
   * Le cœur du critère. La seconde passe repart du même point : elle doit
   * reprendre les deux nœuds au lieu d'en empiler deux autres au même
   * endroit, et ne pas redoubler le segment déjà tracé.
   */
  test('une seconde passe sur le même tracé ne double ni nœud ni arête', async ({ page }) => {
    await setPoint(page, 1, '0', '0');
    await setPoint(page, 2, '10', '0');
    await page.getByRole('button', { name: DRAW }).click();
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();

    await page.getByRole('button', { name: DRAW }).click();
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();
    await expect(page.getByText(/Arêtes\s*1|Edges\s*1/)).toBeVisible();
    // L'écran nomme ce qu'il a repris : sans cela, rien ne distingue une
    // passe qui a doublé d'une passe qui n'a rien fait.
    await expect(page.getByText(
      /0 nœuds et 0 arêtes tracés\. 2 nœuds repris, 1 segments/,
    )).toBeVisible();
  });

  /** Le contre-exemple : un tracé voisin crée bien ses propres nœuds. */
  test('un tracé décalé crée ses propres nœuds', async ({ page }) => {
    await setPoint(page, 1, '0', '0');
    await setPoint(page, 2, '10', '0');
    await page.getByRole('button', { name: DRAW }).click();
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();

    await setPoint(page, 1, '0', '5');
    await setPoint(page, 2, '10', '5');
    await page.getByRole('button', { name: DRAW }).click();
    await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();
    await expect(page.getByText(/Arêtes\s*2|Edges\s*2/)).toBeVisible();
  });

  /**
   * « En une passe » veut dire un geste, donc une annulation : trois nœuds et
   * deux arêtes se défont d'un seul `Ctrl+Z`.
   */
  test('la passe entière s’annule d’une seule frappe', async ({ page }) => {
    await page.getByRole('button', { name: ADD }).click();
    await setPoint(page, 1, '0', '0');
    await setPoint(page, 2, '10', '0');
    await setPoint(page, 3, '20', '0');
    await page.getByRole('button', { name: DRAW }).click();
    await expect(page.getByText(/Nœuds\s*3|Nodes\s*3/)).toBeVisible();

    await page.getByRole('button', { name: DRAW }).focus();
    await page.keyboard.press('Control+z');
    await expect(page.getByText(/Nœuds\s*0|Nodes\s*0/)).toBeVisible();
    await expect(page.getByText(/Arêtes\s*0|Edges\s*0/)).toBeVisible();
  });

  /**
   * Un axe sans segment ne trace rien. Plutôt qu'un code d'anomalie — le
   * cahier des charges n'en donne aucun pour ce cas — l'écran empêche d'y
   * descendre : le retrait est refusé à deux points, et le tracé ne peut donc
   * jamais être pressé sur un axe vide.
   */
  test('l’axe ne peut pas descendre sous deux points', async ({ page }) => {
    const remove = page.getByRole('button', {
      name: /Retirer le dernier point|Remove the last point/,
    });
    await expect(remove).toBeDisabled();

    await page.getByRole('button', { name: ADD }).click();
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(remove).toBeDisabled();
    await expect(page.getByRole('button', { name: DRAW })).toBeEnabled();
  });
});

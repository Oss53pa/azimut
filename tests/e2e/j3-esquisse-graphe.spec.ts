import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J3 et J3.3 (partie J) — la couche d'esquisse dans l'atelier du graphe (M4,
 * partie M).
 *
 * La couche est celle du niveau : ce qui est esquissé dans un atelier se voit
 * dans l'autre. Une esquisse promue se lit comme un trait du réseau : tracée
 * d'un nœud à un autre avec l'outil Arête, elle les relie.
 */
const SITE = 'site-esquisse-graphe';
const LEVEL = 'niveau-esquisse-graphe';
const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;
const VIEW = /Graphe du niveau|Level graph/;

async function centreOf(page: Page, index: number): Promise<{ x: number; y: number }> {
  const node = page.getByRole('group', { name: VIEW }).getByRole('button', { name: /Nœud|Node/ }).nth(index);
  const box = await node.boundingBox();
  if (box === null) throw new Error('nœud introuvable');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function viewBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.getByRole('group', { name: VIEW }).boundingBox();
  if (box === null) throw new Error('vue introuvable');
  return box;
}

test.describe('J3 (partie J) — l’esquisse dans l’atelier du graphe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GRAPH);
    await expect(page.getByRole('button', { name: /Nœud N|Node N/, pressed: true })).toBeVisible();
  });

  test('une esquisse d’un nœud à l’autre, entourée puis convertie, devient une arête', async ({ page }) => {
    const box = await viewBox(page);
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();
    await page.keyboard.press('e');
    await expect(page.getByRole('button', { name: /Arête E|Edge E/, pressed: true })).toBeVisible();

    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
    const a = await centreOf(page, 0);
    const b = await centreOf(page, 1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, a.y - 10, { steps: 10 });
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
    // L'esquisse ne relie rien par elle-même.
    await expect(page.getByText(/Arêtes\s*0|Edges\s*0/)).toBeVisible();

    await page.getByRole('button', { name: /^(Entourer|Lasso)$/ }).click();
    const [l, t, r, bt] = [box.x + 12, box.y + 12, box.x + box.width - 12, box.y + box.height - 12];
    await page.mouse.move(l, t);
    await page.mouse.down();
    for (const [x, y] of [[r, t], [r, bt], [l, bt], [l, t + 3]] as const) {
      await page.mouse.move(x, y, { steps: 8 });
    }
    await page.mouse.up();
    await page.getByRole('button', { name: /Convertir en forme|Convert to a shape/ }).click();

    await expect(page.getByText(/Arêtes\s*1|Edges\s*1/)).toBeVisible();
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);
  });

  test('la couche est celle du niveau : esquissée ici, elle se voit dans l’atelier des empreintes', async ({ page }) => {
    const box = await viewBox(page);
    await page.getByRole('button', { name: /^(Esquisser|Sketch)$/ }).click();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId('sketch-stroke')).toHaveCount(1);

    await page.evaluate(target => {
      history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/sites/${SITE}/levels/${LEVEL}/footprints`);
    await expect(page.getByRole('img', { name: /Zone de travail|Work area/ }).getByTestId('sketch-stroke'))
      .toHaveCount(1);
  });
});

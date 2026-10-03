import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M4 (partie M), outil « Arête » : « Relie deux nœuds, ou crée les nœuds
 * manquants aux extrémités. » Deux nœuds du **niveau courant**.
 *
 * L'outil relisait le magasin entier au lieu des nœuds du niveau, alors que la
 * portée était posée dans le même fichier et que son bouton compte déjà les
 * seuls nœuds du niveau. Il appariait donc des nœuds d'étages différents, en
 * les écrivant tous deux comme s'ils étaient sur le niveau courant : une arête
 * entre deux étages sans sa liaison verticale (A5.3), et posée au mauvais
 * endroit. Tant que l'atelier ne connaissait qu'un niveau, le défaut était
 * hors d'atteinte ; la fiche de site de M1bis et la session multiniveau de
 * T-1.5 l'ont rendu atteignable.
 *
 * Ce qui se prouve ici et nulle part ailleurs : tracer sur un niveau ne touche
 * pas l'autre. Le site est `ref-multilevel`, site de référence du dépôt de
 * code, dont les deux niveaux portent des nœuds. Aucune donnée client (A13.1).
 */
const RDC = '/sites/ref-multilevel/levels/lvl-ml-rdc/graph';

async function ready(page: Page): Promise<void> {
  await page.locator('[role="toolbar"] button').first().waitFor({ state: 'attached' });
}

/** Le compte d'arêtes que la barre d'état annonce pour le niveau affiché. */
async function edgeCount(page: Page): Promise<number> {
  const text = await page.getByText(/(Arêtes|Edges)\s*\d+/).first().innerText();
  return Number(/\d+/.exec(text)?.[0] ?? -1);
}

test.describe('M4 (partie M) — l’outil « Arête » est tenu à son niveau', () => {
  test('tracer au rez-de-chaussée ne pose aucune arête à l’étage', async ({ page }) => {
    await page.goto(RDC);
    await ready(page);

    const bar = page.getByRole('navigation', { name: /Niveaux|Levels/ });
    await bar.getByRole('button', { name: 'R+1' }).click();
    const upstairsBefore = await edgeCount(page);
    expect(upstairsBefore).toBeGreaterThan(0);

    await bar.getByRole('button', { name: 'RDC' }).click();
    const groundBefore = await edgeCount(page);

    await page.getByRole('button', { name: /^Tracer les arêtes$|^Draw the edges$/ }).click();

    // L'outil a bien agi : sans cette borne, l'essai passerait aussi sur un
    // outil qui ne fait rien.
    await expect
      .poll(async () => edgeCount(page))
      .toBeGreaterThan(groundBefore);

    // Et il n'a agi que là. Sur l'ancien comportement, relevé en retirant la
    // borne le temps d'une exécution, l'étage passait de trois arêtes à six :
    // ses propres nœuds appariés au passage, plus celle qui le reliait au
    // rez-de-chaussée.
    await bar.getByRole('button', { name: 'R+1' }).click();
    expect(await edgeCount(page)).toBe(upstairsBefore);
  });
});

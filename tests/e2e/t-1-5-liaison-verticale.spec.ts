import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T-1.5 — « Liaisons verticales et inter-bâtiments ».
 *
 * Acceptation : « Une arête entre deux niveaux sans liaison verticale associée
 * est refusée. » Le refus était tenu, et rien ne le levait : l'atelier ne
 * connaissait qu'un niveau, celui du chemin, et aucun geste ne pouvait
 * produire une arête inter-niveaux — ni donc la liaison qui l'accompagne.
 * L'outil `L` de M4 (partie M) existait à la barre et ne faisait rien.
 *
 * Ce qui se prouve ici, et nulle part ailleurs : la session porte les deux
 * niveaux, on passe de l'un à l'autre, et l'outil écrit l'arête et sa liaison
 * en un geste.
 *
 * Le site est `ref-multilevel`, site de référence du dépôt de code : deux
 * niveaux d'un même bâtiment, RDC à l'altitude 0 et R+1 à 3 m. Aucune donnée
 * client (A13.1).
 */
const SITE = 'ref-multilevel';
const RDC = 'lvl-ml-rdc';
const R1 = 'lvl-ml-r1';
const GRAPH = `/sites/${SITE}/levels/${RDC}/graph`;

/** La barre d'outils est rendue : l'écran a fini son rendu. */
async function ready(page: Page): Promise<void> {
  await page.locator('[role="toolbar"] button').first().waitFor({ state: 'attached' });
}

test.describe('T-1.5 — la liaison verticale', () => {
  test('la session porte les deux niveaux, et l’on passe de l’un à l’autre', async ({ page }) => {
    await page.goto(GRAPH);
    await ready(page);

    const bar = page.getByRole('navigation', { name: /Niveaux|Levels/ });
    await expect(bar.getByRole('button', { name: 'RDC' })).toHaveAttribute('aria-current', 'page');

    // Le compte du RDC, puis celui du R+1 : deux comptes distincts prouvent
    // que l'écran est tenu à son niveau. Ils étaient confondus, l'écran
    // affichant les nœuds de tout le site.
    await expect(page.getByText(/Nœuds\s*5|Nodes\s*5/)).toBeVisible();

    await bar.getByRole('button', { name: 'R+1' }).click();
    await expect(page).toHaveURL(new RegExp(`/levels/${R1}/graph$`));
    await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();
  });

  /**
   * M4 (partie M) : « Liaison verticale | `L` | Relie deux nœuds de niveaux
   * différents. » La touche était annoncée par la barre et écoutée par
   * personne.
   */
  test('la touche L ouvre l’outil', async ({ page }) => {
    await page.goto(GRAPH);
    await ready(page);
    await page.keyboard.press('l');
    await expect(
      page.getByRole('button', { name: /Liaison verticale|Vertical link/ }).first(),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('l’outil écrit l’arête et sa liaison en un geste, annulable', async ({ page }) => {
    await page.goto(GRAPH);
    await ready(page);

    // `ref-multilevel` porte déjà deux liaisons, ascenseur et escalier, dont
    // une seule touche le RDC par ses deux extrémités… les deux le touchent.
    const links = page.getByText(/Liaisons\s*2|Links\s*2/);
    await expect(links).toBeVisible();

    // Le nœud de départ se prend dans la zone de travail, au clavier.
    await page.getByRole('button', { name: /^Nœud Entrée, Entrée/ }).first().press('Enter');

    await page.keyboard.press('l');
    await page.getByLabel(/Niveau relié|Linked level/).selectOption({ label: 'R+1' });
    await page.getByLabel(/Nœud du niveau relié|Node on the linked level/)
      .selectOption({ index: 1 });
    await page.getByLabel(/^Nature|^Kind/).selectOption('stair');
    await page.getByRole('button', { name: /^Créer la liaison$|^Create the link$/ }).click();

    await expect(page.getByText(/Liaisons\s*3|Links\s*3/)).toBeVisible();

    // E5.2 : un geste, une entrée d'annulation. L'arête et la liaison partent
    // ensemble — les séparer laisserait une arête inter-niveaux sans liaison,
    // c'est-à-dire l'état que T-1.5 refuse.
    await page.keyboard.press('Control+z');
    await expect(page.getByText(/Liaisons\s*2|Links\s*2/)).toBeVisible();
  });

  /**
   * M7 (partie M), règle 11 : « Aucun résultat vide n'est présenté comme un succès si le
   * calcul n'a pas eu lieu. » Sur un site d'un seul niveau, l'outil dit
   * pourquoi il ne peut rien faire, au lieu de proposer des champs inertes.
   */
  test('sur un site d’un seul niveau, l’outil dit pourquoi il ne peut rien', async ({ page }) => {
    await page.goto('/sites/ref-minimal/levels/lvl-001/graph');
    await ready(page);
    await page.keyboard.press('l');
    await expect(page.getByText(
      /ne porte qu’un niveau|holds a single level/,
    )).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

/**
 * E5.4 et N1.7 critère 1 — l'atelier repart de l'état enregistré.
 *
 * Le chemin d'écriture était prouvé, le retour ne l'était pas : l'atelier
 * s'ouvrait vide dès que le stockage local ne portait rien, et un site
 * modélisé la veille se présentait comme un site neuf.
 *
 * Le dépôt servi ici est celui des sites de référence du dépôt de code —
 * aucune donnée client, conformément à A13.1.
 */
const SITE = 'ref-minimal';
const LEVEL = 'lvl-001';

test.describe('E5.4 — l’atelier repart de l’état enregistré', () => {
  test('ouvre le graphe du site tel que le dépôt le porte', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/graph`);

    // `ref-minimal` porte six nœuds et cinq arêtes. Le compte vient du dépôt,
    // et non d'un geste : rien n'a été saisi dans cette session.
    await expect(page.getByText(/Nœuds\s*6|Nodes\s*6/)).toBeVisible();
    await expect(page.getByText(/Arêtes\s*5|Edges\s*5/)).toBeVisible();
  });

  test('ouvre les empreintes du même site', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/footprints`);
    await expect(page.getByText(/Empreintes\s*1|Footprints\s*1/)).toBeVisible();
  });

  /**
   * Un site que le dépôt ne connaît pas n'est pas une défaillance : c'est un
   * site qui n'existe que sur ce poste. L'atelier s'ouvre vide, et sans rien
   * annoncer de faux.
   */
  test('ouvre vide un site que le dépôt ne connaît pas, sans erreur', async ({ page }) => {
    await page.goto('/sites/site-absent-du-depot/levels/niveau-x/graph');
    await expect(page.getByText(/Nœuds\s*0|Nodes\s*0/)).toBeVisible();
    await expect(page.getByText(/n’a pas pu être lu|could not be read/)).toHaveCount(0);
  });

  /**
   * E5.4 — « choix explicite de l'utilisateur entre l'état local et l'état
   * serveur. Aucune fusion silencieuse. » Un travail local laissé sur le poste
   * ne se fait pas écraser par le dépôt : la reprise est proposée.
   */
  test('propose le choix quand le poste porte un travail local', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/graph`);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    await expect(page.getByText(/Nœuds\s*7|Nodes\s*7/)).toBeVisible();

    await page.evaluate(
      (site: string) => { sessionStorage.removeItem(`azimut.session.open.${site}`); }, SITE);
    await page.reload();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', {
      name: /Repartir de l’état enregistré|Start from the stored state/,
    }).click();

    // Écarter le travail local ramène à l'état du dépôt, et non à zéro.
    await expect(page.getByText(/Nœuds\s*6|Nodes\s*6/)).toBeVisible();
  });
});

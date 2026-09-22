import { test, expect } from '@playwright/test';

/**
 * F16 — « Rendu en niveaux de gris : aucune information perdue. »
 *
 * Et M7.7 (partie M) : « Aucune information n'est portée par la seule
 * couleur. » L'essai retire la couleur et vérifie que ce qui distinguait deux
 * éléments distingue encore.
 *
 * La méthode : deux éléments dont le sens diffère — une anomalie bloquante et
 * un avertissement, un outil actif et un outil au repos — doivent différer par
 * autre chose que leur teinte. Le texte, la bordure, l'état ARIA. Si leur
 * seule différence est une couleur, le rendu en niveaux de gris les confond.
 */

const SITE = 'site-essai';
const LEVEL = 'niveau-essai';

/** Applique le filtre de désaturation, comme le ferait un écran monochrome. */
async function desaturate(page: import('@playwright/test').Page): Promise<void> {
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
}

test.describe('F16 — le produit se lit sans les couleurs', () => {
  test('l’outil actif se distingue autrement que par sa teinte', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/footprints`);
    await desaturate(page);

    const tools = page.getByRole('button', { pressed: false });
    const active = page.getByRole('button', { pressed: true });

    // L'état est porté par ARIA : un lecteur d'écran l'annonce, et il survit
    // à la désaturation par construction.
    await expect(active).toHaveCount(1);
    expect(await tools.count()).toBeGreaterThan(0);

    // Et il se voit : la bordure de l'outil actif n'est pas transparente.
    const activeBorder = await active.evaluate(el => getComputedStyle(el).borderTopColor);
    const restBorder = await tools.first().evaluate(el => getComputedStyle(el).borderTopColor);
    expect(activeBorder).not.toBe(restBorder);
  });

  /**
   * F8 et M7.7 (partie M) : une anomalie se lit à son texte. La pastille de
   * gravité porte le mot, non la seule couleur.
   */
  test('la gravité d’une anomalie se lit au mot', async ({ page }) => {
    await page.goto(`/sites/${SITE}/validation`);
    await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
    await desaturate(page);

    // Le compteur nomme chaque gravité en toutes lettres.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/bloquantes|blocking/);
    expect(body).toMatch(/avertissements|warnings/);
  });

  /**
   * M5 (partie M) : le taux de couverture « n'affiche jamais zéro ni un
   * tiret » quand il est conditionné. Il dit ce qu'il attend, et ce texte
   * survit à la désaturation.
   */
  test('le taux conditionné dit ce qu’il attend, en mots', async ({ page }) => {
    await page.goto(`/sites/${SITE}/validation`);
    await desaturate(page);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/en attente du calcul|awaiting the computation/);
    // Ni zéro ni tiret à la place du taux.
    expect(body).not.toMatch(/Taux de couverture\s*[0—–-]\s*$/m);
  });

  /**
   * M7.3 (partie M) : « Toute valeur calculée est en lecture seule, et son
   * caractère calculé est visible. » La marque est un signe, pas une teinte.
   */
  test('une valeur calculée se signale sans couleur', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/footprints`);
    await desaturate(page);

    const area = page.getByLabel(/Surface|Area/).first();
    await expect(area).toHaveAttribute('readonly', '');
    await expect(area).toHaveAttribute('aria-readonly', 'true');
  });
});

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * F16 — « Parcours complet au clavier sur chaque écran. »
 *
 * Et M8 (partie M) critère 2 : « Le même parcours est réalisable au clavier
 * seul. » L'essai ne touche jamais la souris : il tabule, et vérifie qu'il
 * atteint ce qu'il doit atteindre.
 */

const SITE = 'site-essai';
const LEVEL = 'niveau-essai';

const SCREENS = [
  { name: 'M1 liste des sites', path: '/sites' },
  { name: 'M2 import et calage', path: `/sites/${SITE}/levels/${LEVEL}/plan` },
  { name: 'M3 tracé des empreintes', path: `/sites/${SITE}/levels/${LEVEL}/footprints` },
  { name: 'M4 saisie du graphe', path: `/sites/${SITE}/levels/${LEVEL}/graph` },
  { name: 'M5 validation', path: `/sites/${SITE}/validation` },
] as const;

/** Ce que le focus désigne, tel qu'un lecteur d'écran l'annoncerait. */
async function focused(page: Page): Promise<{ tag: string; name: string }> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return { tag: 'none', name: '' };
    const label = el.getAttribute('aria-label')
      ?? el.closest('label')?.textContent
      ?? (el.id !== '' ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null)
      ?? el.textContent
      ?? '';
    return { tag: el.tagName.toLowerCase(), name: label.trim() };
  });
}

/**
 * Attend que l'écran porte au moins une cible au clavier.
 *
 * `goto` rend la main au chargement du document, pas au montage de React :
 * sur un exécuteur chargé, la première tabulation partait avant le rendu et
 * le focus restait sur `<body>`, qui n'a pas de contour. L'essai jugeait
 * alors l'instant du rendu, pas l'écran.
 */
async function openScreen(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => document.querySelector(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  ) !== null);
}

/** Tabule jusqu'à revenir au corps du document, et rend ce qui a été atteint. */
async function tabThrough(page: Page, limit = 60): Promise<readonly { tag: string; name: string }[]> {
  const reached: { tag: string; name: string }[] = [];
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const current = await focused(page);
    if (current.tag === 'body') break;
    reached.push(current);
  }
  return reached;
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test('se parcourt entièrement au clavier', async ({ page }) => {
      await openScreen(page, screen.path);
      const reached = await tabThrough(page);

      // Un écran sans aucune cible au clavier est inutilisable au clavier seul.
      expect(reached.length, 'aucun élément atteint au clavier').toBeGreaterThan(0);

      // Chaque cible s'annonce : un contrôle sans nom accessible est un cul-de-sac
      // pour qui n'a pas l'écran sous les yeux (E6.3).
      const anonymous = reached.filter(r => r.name === '');
      expect(anonymous, `cibles sans nom accessible : ${JSON.stringify(anonymous)}`).toEqual([]);
    });

    /**
     * M7.8 (partie M) : « L'indicateur de focus est distinct de l'indicateur de
     * sélection. » Sans contour visible, la tabulation est aveugle.
     */
    test('montre où est le focus', async ({ page }) => {
      await openScreen(page, screen.path);
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        if (el === null) return null;
        const style = getComputedStyle(el);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      });
      expect(outline).not.toBeNull();
      expect(outline?.outlineStyle, 'aucun contour de focus').not.toBe('none');
    });
  });
}

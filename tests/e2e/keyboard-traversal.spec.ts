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

/**
 * Sélecteur de ce qui reçoit le focus par tabulation.
 *
 * Le même qui sert à attendre le rendu et à décrire ce que l'essai parcourt :
 * deux listes différentes feraient attendre autre chose que ce qui est ensuite
 * tabulé.
 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Délai au-delà duquel un rendu manquant est un défaut, et non une lenteur.
 *
 * Volontairement court, et non le délai par défaut de Playwright. L'écran est
 * servi par `preview` depuis un paquet déjà construit, en local : s'il n'a
 * rien rendu au bout de cinq secondes, attendre trente n'y changera rien, et
 * l'essai doit dire ce qu'il constate plutôt que patienter.
 */
const RENDER_TIMEOUT_MS = 5_000;

/**
 * Attend que l'application ait rendu quelque chose d'atteignable au clavier,
 * et échoue en le disant si elle n'a rien rendu.
 *
 * **Ce que cette attente corrige, et ce qui reste supposé.** L'essai échouait
 * une fois sur une dizaine d'exécutions complètes de la suite, jamais
 * isolément : vingt-quatre sondes dédiées et six exécutions complètes après
 * l'ajout de cette attente sont toutes passées, et je n'ai jamais reproduit
 * l'échec. La course décrite ci-dessous est donc une **cause probable, non une
 * cause prouvée** : je ne l'ai pas observée, je l'ai déduite de la forme de
 * l'échec — le focus restant sur `body`, c'est-à-dire un document sans aucune
 * cible. Écrire ici que le défaut est corrigé serait affirmer plus que ce que
 * j'ai constaté. Si l'intermittence revient, la cause est à chercher
 * ailleurs.
 *
 * La course supposée : `page.goto` rend la main à l'événement `load`,
 * c'est-à-dire quand le script est exécuté. React 18 ne rend pas pour autant
 * — `render` planifie le travail au lieu de l'accomplir. Tabuler aussitôt
 * visait alors un document encore vide, où le focus reste sur `body`, qui ne
 * porte aucun contour et qu'aucune tabulation ne quitte.
 *
 * **La garde.** L'attente est bornée et son échec est nommé. Sans elle, un
 * rendu qui cesserait d'arriver se présenterait comme « aucun élément atteint
 * au clavier » — le symptôme d'un défaut d'ordre de tabulation, alors que
 * rien n'a été rendu. Un défaut de rendu doit se présenter comme un défaut de
 * rendu, immédiatement, et le corps du document est rapporté avec lui : c'est
 * ce qui manquait pour trancher la première fois.
 */
async function waitForInteractive(page: Page): Promise<void> {
  try {
    await page.locator(FOCUSABLE).first()
      .waitFor({ state: 'attached', timeout: RENDER_TIMEOUT_MS });
  } catch {
    const body = (await page.locator('body').innerHTML()).trim();
    throw new Error(
      `L'application n'a rendu aucun élément atteignable au clavier en `
      + `${RENDER_TIMEOUT_MS} ms sur ${page.url()}.\n\n`
      + `Ce n'est pas une intermittence de tabulation : l'essai s'arrête avant `
      + `de tabuler, pour qu'un rendu absent ne se présente pas comme un défaut `
      + `d'ordre de tabulation.\n\n`
      + `Corps du document au moment de l'échec :\n`
      + (body === '' ? '(vide)' : body.slice(0, 800)),
    );
  }
}

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
      await page.goto(screen.path);
      await waitForInteractive(page);
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
      await page.goto(screen.path);
      await waitForInteractive(page);
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

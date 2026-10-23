import { test, expect } from '@playwright/test';

/**
 * Lot 7 de l'audit (A3.4) : le studio construit tourne sous sa politique de
 * sécurité du contenu sans la heurter.
 *
 * Une violation n'arrête pas toujours l'écran : une ressource refusée se tait,
 * et l'écran se dégrade sans le dire. L'essai écoute donc l'événement que le
 * navigateur lève à chaque refus, sur les écrans principaux, et en exige zéro.
 * Repris de la PR 28.
 */
const SITE = 'site-essai';
const LEVEL = 'niveau-essai';
const SCREENS = [
  '/sites',
  `/sites/${SITE}/levels/${LEVEL}/plan`,
  `/sites/${SITE}/levels/${LEVEL}/footprints`,
  `/sites/${SITE}/levels/${LEVEL}/graph`,
  `/sites/${SITE}/validation`,
] as const;

test.describe('lot 7 de l’audit : politique de sécurité du contenu', () => {
  test('la politique est posée dans la page servie', async ({ page }) => {
    await page.goto('/sites');
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
  });

  for (const screen of SCREENS) {
    test(`aucune violation sur ${screen}`, async ({ page }) => {
      const violations: string[] = [];
      page.on('console', message => {
        if (message.text().startsWith('Violation de la politique')) violations.push(message.text());
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', event => {
          console.error(`Violation de la politique : ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await page.goto(screen);
      await page.waitForLoadState('networkidle');
      expect(violations).toEqual([]);
    });
  }

  test('un script injecté dans la page est refusé', async ({ page }) => {
    await page.goto('/sites');
    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__injecte = true;';
      document.head.appendChild(script);
      return (window as unknown as { __injecte?: boolean }).__injecte === true;
    });
    expect(ran).toBe(false);
  });
});

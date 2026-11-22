import { test, expect } from '@playwright/test';

/**
 * F5.2 (partie F) — la barre d'état porte « en permanence » l'état de
 * synchronisation, sur chaque écran d'atelier. En permanence : visible dans
 * la fenêtre, sans avoir à faire défiler la page (F5.1, lot de mise en page
 * décidé par Oss53pa le 22 novembre 2026, Q14).
 *
 * Le banc tourne sans base : l'état attendu est « locale », celui que M8
 * (partie M) critère 3 décrit pour un poste nu.
 */
const SITE = 'site-synchro';
const LEVEL = 'niveau-synchro';
const SCREENS = [
  `/sites/${SITE}/levels/${LEVEL}/plan`,
  `/sites/${SITE}/levels/${LEVEL}/footprints`,
  `/sites/${SITE}/levels/${LEVEL}/graph`,
  `/sites/${SITE}`,
];

test.describe('F5.2 — l’état de synchronisation dans la barre d’état', () => {
  for (const path of SCREENS) {
    test(`visible sans défilement : ${path}`, async ({ page }) => {
      await page.goto(path);
      const sync = page.getByRole('status').filter({ hasText: /Synchronisation|Synchronization/ });
      await expect(sync).toContainText(/locale, aucune base configurée|local, no database configured/);
      await expect(sync).toBeInViewport({ ratio: 1 });
    });
  }
});

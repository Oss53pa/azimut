import { test, expect } from '@playwright/test';

/**
 * F5.2 (partie F) — la barre d'état porte l'état de synchronisation, sur
 * chaque écran d'atelier.
 *
 * « En permanence » voudrait aussi : visible sans faire défiler la page. Ce
 * n'est pas tenu aujourd'hui sur les écrans à canevas (graphe, empreintes) :
 * aucun conteneur de l'atelier n'a de hauteur bornée, et la barre d'état
 * tombe sous la fenêtre à 1366 × 768. Défaut de mise en page antérieur,
 * consigné dans `docs/decoupage-s6-edition-simultanee.md`, en attente de
 * décision ; cet essai ne prétend pas le couvrir.
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
    test(`présent et lisible : ${path}`, async ({ page }) => {
      await page.goto(path);
      const sync = page.getByRole('status').filter({ hasText: /Synchronisation|Synchronization/ });
      await expect(sync).toContainText(/locale, aucune base configurée|local, no database configured/);
    });
  }
});

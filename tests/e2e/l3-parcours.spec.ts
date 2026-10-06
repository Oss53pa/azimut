import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * L3.1 (partie L) — le parcours d'un visiteur, montré dans l'atelier du graphe.
 *
 * Le rendu est essayé dans `engine-iso/src/__tests__/route-animation.test.ts`,
 * le calcul dans `state/__tests__/route-preview.test.ts`. Ce qui ne se prouve
 * qu'à l'écran : le tracé progressif d'un niveau, la transition dite au
 * changement de niveau, la vue statique au choix, et d'emblée quand le
 * navigateur demande moins de mouvement.
 */
const SITE = 'site-parcours';
const LEVEL = 'n0';

function node(id: string, level: string, x: number, y: number, kind = 'junction'): unknown {
  return { table: 'node', id, values: { id, level_id: level, kind, label: id, position: { x_m: x, y_m: y } } };
}

function edge(id: string, from: string, to: string, length: number): unknown {
  return {
    table: 'edge', id,
    values: { id, from_node_id: from, to_node_id: to, width_m: 2, slope_pct: 0, length_m: length, direction: 'both', accessible: true, evacuation_route: false },
  };
}

const SESSION = {
  rows: [
    { table: 'level', id: 'n0', values: { id: 'n0', building_id: 'b', name: 'Rez-de-chaussée', ordinal: 0, elevation_m: 0 } },
    { table: 'level', id: 'n1', values: { id: 'n1', building_id: 'b', name: 'Étage 1', ordinal: 1, elevation_m: 4 } },
    node('Entrée nord', 'n0', 0, 0, 'entrance'),
    node('Carrefour', 'n0', 10, 0),
    node('Allée est', 'n0', 10, 5),
    node('Ascenseur RDC', 'n0', 20, 0, 'elevator'),
    node('Ascenseur E1', 'n1', 20, 0, 'elevator'),
    node('Boutique', 'n1', 20, 8, 'destination_access'),
    edge('e1', 'Entrée nord', 'Carrefour', 10),
    edge('e2', 'Carrefour', 'Allée est', 5),
    edge('e3', 'Carrefour', 'Ascenseur RDC', 10),
    edge('e4', 'Ascenseur RDC', 'Ascenseur E1', 4),
    edge('e5', 'Ascenseur E1', 'Boutique', 8),
    { table: 'vertical_link', id: 'v1', values: { id: 'v1', edge_id: 'e4', kind: 'elevator', capacity: 8, accessible: true } },
    { table: 'travel_profile', id: 'p-general', values: { id: 'p-general', key: 'general', name: 'Général', excluded_edge_kinds: [], require_accessible: false, honor_hours: false } },
  ],
  queued: [],
};

async function openWorkshop(page: Page): Promise<void> {
  await page.addInitScript(([key, payload]: readonly string[]) => {
    window.localStorage.setItem(key ?? '', payload ?? '');
  }, [`azimut.session.${SITE}`, JSON.stringify(SESSION)] as const);
  await page.goto(`/sites/${SITE}/levels/${LEVEL}/graph?lang=fr`);
  await page.getByRole('button', { name: /Reprendre le travail local/ }).click();
  await page.getByLabel('Départ').selectOption('Entrée nord');
  await page.getByLabel('Arrivée').selectOption('Boutique');
  await page.getByRole('button', { name: 'Tracer le parcours' }).click();
}

test.describe('L3.1 (partie L) — le parcours d’un visiteur', () => {
  test('le tracé avance niveau par niveau, et le changement de niveau est dit', async ({ page }) => {
    await openWorkshop(page);
    const frame = page.getByTestId('route-frame');
    await expect(frame).toHaveAttribute('data-level', 'n0');
    await expect(frame.locator('animate')).toHaveCount(1);
    await expect(frame.locator('[data-role="decision"]')).toHaveCount(1);
    await expect(page.getByText(/Niveau Rez-de-chaussée — tronçon 1 sur 2/)).toBeVisible();
    await expect(page.getByText(/Changement de niveau : ascenseur, vers Étage 1/)).toBeVisible();

    await page.getByRole('button', { name: 'Niveau suivant' }).click();
    await expect(frame).toHaveAttribute('data-level', 'n1');
    await expect(frame.locator('[data-role="end"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Niveau suivant' })).toHaveCount(0);
  });

  test('la vue statique porte tout, sans mouvement', async ({ page }) => {
    await openWorkshop(page);
    await page.getByLabel('Vue statique').check();
    const frame = page.getByTestId('route-frame');
    await expect(frame).toHaveAttribute('data-still', 'true');
    await expect(frame.locator('animate')).toHaveCount(0);
    await expect(frame.locator('[data-role="route"]')).toHaveCount(1);
  });

  test('avec le mode à animation réduite, la vue statique s’ouvre d’elle-même', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWorkshop(page);
    await expect(page.getByTestId('route-frame')).toHaveAttribute('data-still', 'true');
  });

  test('sans profil de parcours, le site le dit et rien n’est inventé', async ({ page }) => {
    await page.goto(`/sites/site-sans-profil/levels/n0/graph?lang=fr`);
    await expect(page.getByText(/Aucun profil de parcours déclaré pour ce site/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tracer le parcours' })).toHaveCount(0);
  });
});

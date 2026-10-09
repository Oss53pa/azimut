import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * R12 (partie R) — « Émettre pour revue », à l'écran du tableau des messages.
 *
 * Les commandes et les conditions sont essayées dans
 * `state/__tests__/message-schedule-transitions.test.ts` et
 * `schedule-submission.test.ts`. Ce qui ne se prouve qu'à l'écran : le refus
 * dit avec ses codes et sans changement d'état, puis, les prérequis remplis,
 * la version qui passe en revue et l'action qui disparaît, puisqu'une version
 * en revue ne s'émet pas deux fois.
 *
 * Le rôle de la session est `designer` : R2 lui refuse l'approbation, et
 * aucun bouton Approuver ni Rejeter n'apparaît, avant comme après.
 */
const SITE = 'site-emission';
const SCHEDULE = 'sched-emission';

/**
 * L'empreinte du graphe vide (D7.2), celui de cette session, qui ne porte
 * aucun nœud. Un passage de validation ne vaut que pour l'empreinte qu'il
 * porte (M02.W11) : c'est elle qui rend le prérequis rempli.
 */
const EMPTY_GRAPH_HASH = 'sha256:9e55bbed54777f22ea0ad4a19ebfb13d10966ff7d6776b1ee4248c53c0f150f7';

function line(index: number): unknown {
  return {
    table: 'message_line',
    id: `${SCHEDULE}-line-${String(index)}`,
    values: {
      id: `${SCHEDULE}-line-${String(index)}`, org_id: 'org-a', schedule_id: SCHEDULE, support_id: 'sup-a',
      face_index: 0, block_index: index,
      content: JSON.stringify({
        block_kind: 'destination_list',
        entries: [{ destination_id: `dest-${String(index)}`, text: { fr: `Destination ${String(index)}`, en: `Destination ${String(index)}` }, direction: 'left', distance_m: 40 }],
      }),
      pictogram_id: null, direction: 'left', information_level: 2, decision_point_id: 'n-hall',
      stale: false, excluded: false, exclusion_reason: null,
    },
  };
}

const BASE_ROWS = [
  { table: 'support', id: 'sup-a', values: { id: 'sup-a', org_id: 'org-a', site_id: SITE, code: 'D-100' } },
  {
    table: 'message_schedule', id: SCHEDULE,
    values: { id: SCHEDULE, org_id: 'org-a', site_id: SITE, version: 3, state: 'draft', generated_at: '2026-10-01T00:00:00.000Z', inputs_hash: 'abcdef0123456789' },
  },
  line(0), line(1),
];

/**
 * L'annuaire qui rend le jalonnement continu : chaque destination annoncée au
 * point `n-hall` y est atteinte (H2.4). Sans lui, l'émission est refusée pour
 * continuité rompue, et c'est juste. Les lignes portent toutes les colonnes
 * requises d'une destination, comme en base : une ligne incomplète serait
 * illisible, donc écartée, et la continuité se romprait de même.
 */
const DIRECTORY = [0, 1].map(index => ({
  table: 'destination', id: `dest-${String(index)}`,
  values: {
    id: `dest-${String(index)}`, org_id: 'org-a', node_id: 'n-hall', occupant_name: `Destination ${String(index)}`,
    footprint_id: `fp-${String(index)}`, category_id: 'cat-commerce', occupancy_status: 'occupied', display_priority: 1,
  },
}));

const PREREQUISITES = [
  ...DIRECTORY,
  {
    table: 'graph_validation', id: 'gv-1',
    values: { id: 'gv-1', org_id: 'org-a', site_id: SITE, graph_hash: EMPTY_GRAPH_HASH, ran_at: '2026-10-02T00:00:00.000Z', passed: true, blocking_count: 0, warning_count: 0 },
  },
  {
    table: 'site_rules_binding', id: 'rb-1',
    values: { id: 'rb-1', org_id: 'org-a', site_id: SITE, pack_id: 'pack-essai', role: 'primary' },
  },
];

async function open(page: Page, rows: readonly unknown[]): Promise<void> {
  await page.addInitScript(([key, payload]: readonly string[]) => {
    window.localStorage.setItem(key ?? '', payload ?? '');
  }, [`azimut.session.${SITE}`, JSON.stringify({ rows, queued: [] })] as const);
  await page.goto(`/sites/${SITE}/wayfinding/messages?lang=fr`);
  await page.getByRole('button', { name: /Reprendre le travail local/ }).click();
  await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
}

test.describe('R12 (partie R) — émettre pour revue', () => {
  test('sans validation du graphe ni paquet de règles, l’émission est refusée et dit pourquoi', async ({ page }) => {
    await open(page, BASE_ROWS);
    // Les deux codes figurent déjà dans les bandeaux de prérequis (R14) ; le
    // refus les redit, chacun dans son motif.
    await expect(page.getByText('GRAPH.NOT_VALIDATED')).toHaveCount(1);
    await expect(page.getByText('RULES.PACK_NOT_BOUND')).toHaveCount(1);
    await page.getByRole('button', { name: 'Émettre pour revue' }).click();

    await expect(page.getByText(/La transition demandée est refusée/)).toBeVisible();
    await expect(page.getByText('GRAPH.NOT_VALIDATED')).toHaveCount(2);
    await expect(page.getByText('RULES.PACK_NOT_BOUND')).toHaveCount(2);
    // Sans annuaire, les destinations annoncées ne sont jamais atteintes (H2.4).
    await expect(page.getByText('WAYFIND.CONTINUITY_BROKEN').first()).toBeVisible();
    await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Émettre pour revue' })).toBeVisible();
  });

  test('les prérequis remplis, la version passe en revue, et ne s’émet pas deux fois', async ({ page }) => {
    await open(page, [...BASE_ROWS, ...PREREQUISITES]);
    // Le bandeau de M02.W11 ne s'affiche pas : le dernier passage vaut pour ce graphe.
    await expect(page.getByText(/La validation de complétude du graphe n’est pas passée/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Émettre pour revue' }).click();

    await expect(page.getByText('En revue', { exact: true })).toBeVisible();
    await expect(page.getByText(/La transition demandée est refusée/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Émettre pour revue' })).toHaveCount(0);
    // R2 (partie R) : le rôle de la session n'approuve ni ne rejette.
    await expect(page.getByRole('button', { name: 'Approuver' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rejeter' })).toHaveCount(0);
  });
});

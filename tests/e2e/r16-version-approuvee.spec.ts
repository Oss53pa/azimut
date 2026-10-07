import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * R16 (partie R) — « Version approuvée | Bandeau d'état indiquant
 * l'approbateur et la date. Aucune action de génération sur cette version. »
 *
 * L'approbateur n'est connu que par son identifiant : le modèle ne porte
 * aucun nom d'utilisateur. Le bandeau en montre les huit premiers caractères,
 * et dit la valeur complète à côté, comme pour l'empreinte des entrées (R4).
 */
const SITE = 'site-approuve';
const SCHEDULE = 'sched-approuve';
const APPROVER = 'a1b2c3d4-0000-4000-8000-0000000000e1';

const BASE_ROWS = [
  { table: 'support', id: 'sup-a', values: { id: 'sup-a', org_id: 'org-a', site_id: SITE, code: 'D-100' } },
  {
    table: 'message_schedule', id: SCHEDULE,
    values: { id: SCHEDULE, org_id: 'org-a', site_id: SITE, version: 4, state: 'approved', generated_at: '2026-10-01T00:00:00.000Z', inputs_hash: 'abcdef0123456789' },
  },
];

const DECISION = {
  table: 'message_schedule_approval', id: 'dec-1',
  values: { id: 'dec-1', org_id: 'org-a', schedule_id: SCHEDULE, user_id: APPROVER, decision: 'approved', comment: null, decided_at: '2026-10-03T14:00:00+00:00', inputs_hash: 'abcdef0123456789' },
};

async function open(page: Page, rows: readonly unknown[]): Promise<void> {
  await page.addInitScript(([key, payload]: readonly string[]) => {
    window.localStorage.setItem(key ?? '', payload ?? '');
  }, [`azimut.session.${SITE}`, JSON.stringify({ rows, queued: [] })] as const);
  await page.goto(`/sites/${SITE}/wayfinding/messages?lang=fr`);
  await page.getByRole('button', { name: /Reprendre le travail local/ }).click();
  await expect(page.getByText('Approuvé', { exact: true })).toBeVisible();
}

test.describe('R16 (partie R) — la version approuvée', () => {
  test('le bandeau dit l’approbateur et la date, et aucune génération n’est offerte', async ({ page }) => {
    await open(page, [...BASE_ROWS, DECISION]);
    await expect(page.getByText('Version approuvée par a1b2c3d4 le 2026-10-03T14:00:00+00:00. Aucune génération sur cette version.'))
      .toBeVisible();
    await expect(page.getByText(`Identifiant complet de l’approbateur : ${APPROVER}.`)).toBeVisible();
    for (const action of ['Générer', 'Générer à nouveau', 'Émettre pour revue', 'Approuver', 'Rejeter']) {
      await expect(page.getByRole('button', { name: action, exact: true })).toHaveCount(0);
    }
  });

  test('sans décision lue, le bandeau le dit au lieu d’inventer un approbateur', async ({ page }) => {
    await open(page, BASE_ROWS);
    await expect(page.getByText(/La décision qui l’approuve n’a pas pu être lue/)).toBeVisible();
    await expect(page.getByText(/Version approuvée par/)).toHaveCount(0);
  });
});

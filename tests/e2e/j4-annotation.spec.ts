import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J4 (partie J) et R7.4 (partie R) — l'annotation en révision, dans le
 * panneau de détail du tableau des messages.
 *
 * Les commandes et la lecture sont essayées dans
 * `state/__tests__/review-annotation.test.ts`, la base dans
 * `review-annotation.db.test.ts`. Ce qui ne se prouve qu'à l'écran : la
 * remarque posée au clavier ou au stylet sur une ligne, le fil, la clôture, et
 * le bandeau qui dit l'approbation bloquée tant qu'une annotation est ouverte.
 */
const SITE = 'site-annotation';
const SCHEDULE = 'sched-annotation';

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

const SESSION = {
  rows: [
    { table: 'support', id: 'sup-a', values: { id: 'sup-a', org_id: 'org-a', site_id: SITE, code: 'D-100' } },
    {
      table: 'message_schedule', id: SCHEDULE,
      values: { id: SCHEDULE, org_id: 'org-a', site_id: SITE, version: 3, state: 'in_review', generated_at: '2026-10-01T00:00:00.000Z', inputs_hash: 'abcdef0123456789' },
    },
    line(0), line(1),
  ],
  queued: [],
};

async function openLine(page: Page): Promise<void> {
  await page.addInitScript(([key, payload]: readonly string[]) => {
    window.localStorage.setItem(key ?? '', payload ?? '');
  }, [`azimut.session.${SITE}`, JSON.stringify(SESSION)] as const);
  await page.goto(`/sites/${SITE}/wayfinding/messages?lang=fr`);
  await page.getByRole('button', { name: /Reprendre le travail local/ }).click();
  await page.getByText('D-100/F0/B0').click();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: 'Annotations de la ligne' })).toBeAttached();
}

test.describe('J4 (partie J) — l’annotation en révision', () => {
  test('une remarque au clavier bloque l’approbation, jusqu’à ce qu’elle soit traitée', async ({ page }) => {
    await openLine(page);
    await expect(page.getByText(/annotation\(s\) ouverte\(s\) sur ce tableau/)).toHaveCount(0);

    await page.getByLabel('Nouvelle remarque').fill('La flèche doit pointer à droite');
    await page.getByRole('button', { name: /^Annoter$/ }).click();
    const note = page.getByTestId('review-annotation');
    await expect(note).toHaveCount(1);
    await expect(note).toHaveAttribute('data-state', 'open');
    await expect(note.getByText('La flèche doit pointer à droite')).toBeVisible();
    await expect(page.getByText(/1 annotation\(s\) ouverte\(s\) sur ce tableau/)).toBeVisible();

    await note.getByLabel('Répondre').fill('Corrigé dans le plan de jalonnement');
    await note.getByRole('button', { name: 'Envoyer la réponse' }).click();
    await expect(note.getByText('Corrigé dans le plan de jalonnement')).toBeVisible();

    await note.getByRole('button', { name: 'Traiter' }).click();
    await expect(note).toHaveAttribute('data-state', 'resolved');
    await expect(page.getByText(/annotation\(s\) ouverte\(s\) sur ce tableau/)).toHaveCount(0);
  });

  test('une remarque tracée au stylet est gardée telle quelle', async ({ page }) => {
    await openLine(page);
    const pad = page.getByTestId('review-ink-pad');
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    if (box === null) throw new Error('cadre introuvable');
    await page.mouse.move(box.x + 20, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 30, { steps: 10 });
    await page.mouse.move(box.x + 200, box.y + 70, { steps: 10 });
    await page.mouse.up();
    await page.getByRole('button', { name: /^Annoter$/ }).click();

    const note = page.getByTestId('review-annotation');
    await expect(note).toHaveCount(1);
    await expect(note.getByRole('img', { name: 'Note manuscrite' }).locator('path')).toHaveCount(1);
  });

  test('une remarque vide n’est pas enregistrée, et l’écran le dit', async ({ page }) => {
    await openLine(page);
    await page.getByRole('button', { name: /^Annoter$/ }).click();
    await expect(page.getByText(/une annotation vide n’est pas enregistrée/)).toBeVisible();
    await expect(page.getByTestId('review-annotation')).toHaveCount(0);
  });
});

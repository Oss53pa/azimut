import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Partie R — l'écran du tableau des messages, moitié consultation, dans un
 * vrai navigateur.
 *
 * Ce que les essais unitaires ne peuvent pas établir : qu'aucune cellule du
 * tableau rendu ne se laisse modifier — critère 2 de R18, « par aucune voie :
 * clic, clavier, collage » — et que le parcours du clavier de R15 fonctionne
 * sur le document réel, critère 12.
 *
 * Le tableau est posé dans le magasin local par le même format que le chemin
 * d'écriture produit, puis la reprise de session E5.4 est acceptée : c'est le
 * chemin qu'un opérateur suit après une interruption, et le seul qui montre
 * un tableau tant que l'écran de génération n'existe pas.
 */

const SITE = 'site-partie-r';
const PATH = `/sites/${SITE}/wayfinding/messages`;
const SCHEDULE = 'sched-partie-r';

/** Une ligne telle que `writeScheduleCommands` la pose dans le magasin. */
function storedLine(index: number, over: Record<string, unknown> = {}) {
  return {
    table: 'message_line',
    id: `${SCHEDULE}-line-${String(index)}`,
    values: {
      id: `${SCHEDULE}-line-${String(index)}`,
      org_id: 'org-r',
      schedule_id: SCHEDULE,
      support_id: 'sup-1',
      face_index: 0,
      block_index: index,
      content: JSON.stringify({
        block_kind: 'destination_list',
        entries: [{
          destination_id: `dest-${String(index)}`,
          text: { fr: `Destination ${String(index)}`, en: `Destination ${String(index)}` },
          direction: 'left',
          distance_m: 40,
        }],
      }),
      pictogram_id: null,
      direction: 'left',
      information_level: 2,
      decision_point_id: 'n-hall',
      stale: index === 1,
      excluded: false,
      exclusion_reason: null,
      ...over,
    },
  };
}

const SESSION = {
  rows: [
    {
      table: 'support',
      id: 'sup-1',
      values: { id: 'sup-1', org_id: 'org-r', site_id: SITE, code: 'D-042' },
    },
    {
      table: 'message_schedule',
      id: SCHEDULE,
      values: {
        id: SCHEDULE,
        org_id: 'org-r',
        site_id: SITE,
        version: 7,
        state: 'draft',
        generated_at: '2026-04-01T00:00:00.000Z',
        inputs_hash: '0123456789abcdef',
      },
    },
    storedLine(0),
    storedLine(1),
    storedLine(2),
  ],
  queued: [],
};

async function openTable(page: Page, lang = 'fr'): Promise<void> {
  await page.addInitScript(
    ([key, payload]: readonly string[]) => {
      window.localStorage.setItem(key ?? '', payload ?? '');
    },
    [`azimut.session.${SITE}`, JSON.stringify(SESSION)] as const,
  );
  await page.goto(`${PATH}?lang=${lang}`);
  // E5.4 — la reprise est proposée, jamais appliquée d'elle-même.
  await page.getByRole('button', { name: /Reprendre le travail local|Resume local work/ }).click();
  await expect(page.getByRole('table')).toBeVisible();
}

test.describe('partie R — le tableau des messages en consultation', () => {
  test('affiche la version, son état et l’empreinte de ses entrées', async ({ page }) => {
    await openTable(page);
    // R4 (partie R) — les quatre éléments de la barre de version.
    await expect(page.getByText('Version 7')).toBeVisible();
    await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
    // R4 (partie R) : huit premiers caractères, valeur complète en infobulle.
    await expect(page.getByText('01234567', { exact: true })).toBeVisible();
  });

  test('forme l’identifiant stable depuis le code du support', async ({ page }) => {
    await openTable(page);
    // R5 (partie R) : « D-042/F1/B3 », formé de `support.code`, face et bloc.
    await expect(page.getByText('D-042/F0/B0')).toBeVisible();
    await expect(page.getByText('D-042/F0/B2')).toBeVisible();
  });

  /**
   * Critère 2 de R18. Le contrôle porte sur le document rendu : ni champ de
   * saisie, ni élément éditable, dans aucune cellule.
   */
  test('aucune cellule n’est modifiable', async ({ page }) => {
    await openTable(page);
    const table = page.getByRole('table');
    await expect(table.locator('input')).toHaveCount(0);
    await expect(table.locator('textarea')).toHaveCount(0);
    await expect(table.locator('[contenteditable]')).toHaveCount(0);

    const editable = await table.evaluate(node =>
      [...node.querySelectorAll('td')].filter(cell => cell.isContentEditable).length);
    expect(editable).toBe(0);
  });

  /**
   * Critère 12 de R18 : parcours au clavier seul. R15 : flèches, `Entrée`
   * pour ouvrir le détail, `Échap` pour le refermer.
   */
  test('se parcourt au clavier, et ouvre le détail sans souris', async ({ page }) => {
    await openTable(page);

    // R17 : le tableau s'atteint à la tabulation. Une seule ligne y est
    // atteignable, le focus se déplaçant ensuite aux flèches.
    let reached = false;
    for (let step = 0; step < 40 && !reached; step += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.tagName === 'TR');
    }
    expect(reached, 'aucune ligne du tableau n’est atteignable à la tabulation').toBe(true);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Détail de la ligne/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText(/Détail de la ligne/)).toHaveCount(0);
  });

  /** Critère 4 de R18 : « Un filtre actif affiche le nombre de lignes qu'il masque. » */
  test('un filtre dit combien de lignes il masque', async ({ page }) => {
    await openTable(page);
    await page.getByLabel(/Périmées seules/).check();
    await expect(page.getByText(/2 ligne\(s\) masquée\(s\) par les filtres/)).toBeVisible();
  });

  /** R10 : aucun état porté par la seule couleur — la pastille porte son libellé. */
  test('l’état d’une ligne se lit en toutes lettres', async ({ page }) => {
    await openTable(page);
    await expect(page.getByText('Périmée', { exact: true })).toBeVisible();
    await expect(page.getByText(/1 périmée\(s\)/)).toBeVisible();
  });

  /** R16 : l'écran vide invite à générer et nomme ses prérequis. */
  test('sans version enregistrée, il invite plutôt que de montrer un tableau vide', async ({ page }) => {
    await page.goto(`/sites/site-sans-tableau/wayfinding/messages`);
    await expect(page.getByText(/Aucune version de tableau pour ce site/)).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  /**
   * Critère 13 de R18 : « Lisibilité intégrale en niveaux de gris. » R10 :
   * « Aucun état n'est porté par la seule couleur : chaque pastille a son
   * libellé. » L'essai retire la couleur et relit.
   */
  test('se lit entièrement sans les couleurs', async ({ page }) => {
    await openTable(page);
    await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });

    const body = await page.locator('body').innerText();
    for (const word of ['Périmée', 'À jour', 'Brouillon', 'Orientation', 'À gauche']) {
      expect(body, word).toContain(word);
    }

    // Et la ligne focalisée se distingue de la ligne sélectionnée autrement
    // que par une teinte : l'une porte un filet, l'autre un fond.
    const focusedBorder = await page.locator('tr[tabindex="0"]').evaluate(
      el => getComputedStyle(el).borderLeftWidth);
    expect(focusedBorder).not.toBe('0px');
  });

  test('le même écran se lit en anglais', async ({ page }) => {
    await openTable(page, 'en');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByText('D-042/F0/B0')).toBeVisible();
  });
});

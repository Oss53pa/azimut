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

/** Une seconde version, où le bloc 1 change de direction et le bloc 2 disparaît. */
const SCHEDULE_V8 = 'sched-partie-r-8';

function storedLineV8(index: number, over: Record<string, unknown> = {}) {
  const line = storedLine(index, over);
  return {
    ...line,
    id: `${SCHEDULE_V8}-line-${String(index)}`,
    values: {
      ...line.values,
      id: `${SCHEDULE_V8}-line-${String(index)}`,
      schedule_id: SCHEDULE_V8,
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
    {
      table: 'message_schedule',
      id: SCHEDULE_V8,
      values: {
        id: SCHEDULE_V8,
        org_id: 'org-r',
        site_id: SITE,
        version: 8,
        state: 'draft',
        generated_at: '2026-04-02T00:00:00.000Z',
        inputs_hash: 'fedcba9876543210',
      },
    },
    storedLineV8(0),
    storedLineV8(1, { direction: 'right' }),
    storedLineV8(3),
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
    // R4 (partie R) — les quatre éléments de la barre de version. C'est la
    // version la plus haute qui s'affiche : deux sont enregistrées.
    await expect(page.getByText('Version 8')).toBeVisible();
    await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
    // R4 (partie R) : huit premiers caractères, valeur complète en infobulle.
    await expect(page.getByText('fedcba98', { exact: true })).toBeVisible();
  });

  test('forme l’identifiant stable depuis le code du support', async ({ page }) => {
    await openTable(page);
    // R5 (partie R) : « D-042/F1/B3 », formé de `support.code`, face et bloc.
    await expect(page.getByText('D-042/F0/B0')).toBeVisible();
    await expect(page.getByText('D-042/F0/B3')).toBeVisible();
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

  /**
   * R11 (partie R) — comparaison de versions, et critère 7 de R18 : « distingue
   * ajoutées, supprimées et modifiées, sans fausse suppression d'une ligne
   * regénérée ».
   */
  test('compare deux versions et marque chaque écart', async ({ page }) => {
    await openTable(page);
    await page.getByRole('button', { name: /^Comparer$|^Compare$/ }).click();

    // Les deux plus hautes versions, l'ancienne en référence.
    await expect(page.getByLabel(/Version de référence/)).toHaveValue('7');
    await expect(page.getByLabel(/Version comparée/)).toHaveValue('8');

    // Un ajout, une suppression, une modification, une inchangée masquée.
    await expect(page.getByText(/1 ajoutée\(s\).*1 supprimée\(s\).*1 modifiée\(s\).*1 inchangée\(s\)/)).toBeVisible();

    // Chaque marque porte son libellé, jamais la seule couleur.
    await expect(page.getByText('Ajoutée', { exact: true })).toBeVisible();
    await expect(page.getByText('Supprimée', { exact: true })).toBeVisible();
    await expect(page.getByText('Modifiée', { exact: true })).toBeVisible();

    // La valeur ancienne et la nouvelle, côte à côte.
    await expect(page.getByText('À gauche', { exact: true })).toBeVisible();
    await expect(page.getByText('À droite', { exact: true })).toBeVisible();
  });

  test('les lignes inchangées sont masquées par défaut, et se montrent', async ({ page }) => {
    await openTable(page);
    await page.getByRole('button', { name: /^Comparer$|^Compare$/ }).click();
    await expect(page.getByText('Inchangée', { exact: true })).toHaveCount(0);

    await page.getByLabel(/Montrer les lignes inchangées/).check();
    await expect(page.getByText('Inchangée', { exact: true })).toBeVisible();
  });

  test('comparer une version à elle-même le dit, au lieu de ne rien montrer', async ({ page }) => {
    await openTable(page);
    await page.getByRole('button', { name: /^Comparer$|^Compare$/ }).click();
    await page.getByLabel(/Version de référence/).selectOption('8');
    await expect(page.getByText(/Les deux versions choisies sont la même/)).toBeVisible();
  });

  test('le même écran se lit en anglais', async ({ page }) => {
    await openTable(page, 'en');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByText('D-042/F0/B0')).toBeVisible();
  });
});

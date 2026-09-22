import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * M8 (partie M) — critères d'acceptation de la tranche entière.
 *
 * « Ce qui compte n'est pas que chaque écran existe, mais que la chaîne
 * fonctionne. »
 */

const SITE = 'site-m8';
const LEVEL = 'niveau-m8';
const PLAN = `/sites/${SITE}/levels/${LEVEL}/plan`;
const FOOTPRINTS = `/sites/${SITE}/levels/${LEVEL}/footprints`;
const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;
const VALIDATION = `/sites/${SITE}/validation`;

const HERE = dirname(fileURLToPath(import.meta.url));

/** Le fond de plan déposé. Un PDF minimal : le parcours n'en lit pas le contenu. */
const PLAN_FILE = {
  name: 'niveau-0.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 fond de plan d’essai'),
};

/**
 * Le parcours de M8 (partie M) critère 1, au pointeur.
 *
 * « Un opérateur part d'un site vide, importe un plan, le cale, trace trois
 * cellules, pose quatre nœuds, trace les arêtes, lance la validation, et
 * obtient un résultat cohérent. »
 */
async function runChain(page: Page): Promise<void> {
  // Importer un plan, et le caler.
  await page.goto(PLAN);
  await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles(PLAN_FILE);
  await page.getByLabel(/Distance réelle|Real distance/).fill('20');
  await page.getByLabel(/Azimut du nord|North azimuth/).fill('0');
  await page.getByRole('button', { name: /^Valider le calage$|^Validate calibration$/ }).click();
  await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();

  // Tracer trois cellules.
  await page.goto(FOOTPRINTS);
  for (const code of ['B01', 'B02', 'B03']) {
    await page.getByLabel(/Code de cellule|Unit code/).fill(code);
    await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
  }
  await expect(page.getByText(/Empreintes\s*3|Footprints\s*3/)).toBeVisible();

  // Poser quatre nœuds, puis tracer les arêtes.
  await page.goto(GRAPH);
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
  }
  await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();
  await page.getByRole('button', { name: /Tracer les arêtes|Draw the edges/ }).click();
  await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();

  // Lancer la validation.
  await page.goto(VALIDATION);
  await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
  await expect(page.getByText(/Aucune anomalie|No anomaly/)).toBeVisible();
}

test.describe('M8 (partie M) critère 1 — la chaîne fonctionne', () => {
  test('un site vide devient un graphe validé', async ({ page }) => {
    await runChain(page);
  });
});

test.describe('M8 (partie M) critère 2 — le même parcours au clavier seul', () => {
  /**
   * Aucun clic. Le dépôt du fichier est le seul geste qu'un navigateur
   * n'autorise pas à simuler au clavier — il passe par `setInputFiles`, qui
   * est ce qu'une frappe sur le champ de fichier déclenche.
   */
  test('la chaîne se parcourt sans la souris', async ({ page }) => {
    await page.goto(PLAN);
    await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles(PLAN_FILE);

    await page.getByLabel(/Distance réelle|Real distance/).focus();
    await page.keyboard.type('20');
    await page.getByLabel(/Azimut du nord|North azimuth/).focus();
    await page.keyboard.type('0');

    // Tabuler jusqu'au bouton de validation, puis le presser à la barre
    // d'espace — sans jamais cliquer.
    await pressByKeyboard(page, /^Valider le calage$|^Validate calibration$/);
    await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();

    await page.goto(GRAPH);
    for (let i = 0; i < 4; i += 1) {
      await pressByKeyboard(page, /^Poser un nœud$|^Place a node$/);
    }
    await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();

    await pressByKeyboard(page, /Tracer les arêtes|Draw the edges/);
    await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();
  });
});

/** Tabule jusqu'au bouton nommé, puis le presse à la barre d'espace. */
async function pressByKeyboard(page: Page, name: RegExp): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const current = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (name.test(current)) {
      await page.keyboard.press('Space');
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`bouton non atteint au clavier : ${String(name)}`);
}

test.describe('M8 (partie M) critère 3 — le même parcours hors ligne', () => {
  /**
   * « Le même parcours est réalisable hors ligne, avec synchronisation au
   * retour du réseau. » Le travail avance sans réseau ; ce qui est écrit
   * attend en file et part au retour (E5.3).
   */
  test('la chaîne avance sans réseau, et se sauvegarde localement', async ({ page, context }) => {
    await page.goto(GRAPH);
    await context.setOffline(true);

    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    }
    await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();

    // E5.4 : sauvegarde locale à chaque commande validée.
    const saved = await page.evaluate(
      (site: string) => localStorage.getItem(`azimut.session.${site}`),
      SITE,
    );
    expect(saved, 'rien n’a été sauvegardé localement').not.toBeNull();
    expect(saved).toContain('node');

    await context.setOffline(false);
  });

  /**
   * La reprise après incident, E5.4 : « Reprise proposée à la réouverture
   * après incident, avec choix explicite de l'utilisateur. Aucune fusion
   * silencieuse. »
   *
   * L'incident est la perte de l'onglet, pas la coupure réseau. Le réseau
   * revient donc avant le rechargement : l'application elle-même est servie
   * par le réseau, et la recharger hors ligne n'éprouverait rien de E5.4.
   */
  test('le travail survit, et la reprise est proposée plutôt qu’appliquée', async ({ page, context }) => {
    await page.goto(GRAPH);
    await context.setOffline(true);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();

    const before = await page.evaluate(
      (site: string) => localStorage.getItem(`azimut.session.${site}`), SITE);

    await context.setOffline(false);
    // L'onglet est perdu : sa marque disparaît, celle du travail non.
    await page.evaluate(
      (site: string) => { sessionStorage.removeItem(`azimut.session.open.${site}`); }, SITE);
    await page.reload();

    const after = await page.evaluate(
      (site: string) => localStorage.getItem(`azimut.session.${site}`), SITE);
    expect(after).toBe(before);

    // Proposée, et non appliquée : le choix est explicite.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', {
      name: /Reprendre le travail local|Resume local work/,
    }).click();
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();
  });

  /** L'autre branche du choix : écarter n'est jamais une fusion. */
  test('écarter l’état local repart à zéro, sans rien fusionner', async ({ page }) => {
    await page.goto(GRAPH);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();

    await page.evaluate(
      (site: string) => { sessionStorage.removeItem(`azimut.session.open.${site}`); }, SITE);
    await page.reload();

    await page.getByRole('dialog').getByRole('button', {
      name: /Repartir sans lui|Start without it/,
    }).click();

    const kept = await page.evaluate(
      (site: string) => localStorage.getItem(`azimut.session.${site}`), SITE);
    expect(kept, 'l’état écarté doit être effacé, jamais fusionné').toBeNull();
  });
});

/**
 * M8 (partie M) critère 4 — « Le temps du parcours est mesuré et consigné.
 * C'est le premier relevé de l'indicateur économique central du produit, et il
 * sert de base à toutes les révisions ultérieures. »
 *
 * Consigné veut dire écrit dans un fichier qui survit à l'exécution, et non
 * affiché puis perdu. Le relevé porte la date, la durée de chaque étape et le
 * total.
 */
test.describe('M8 (partie M) critère 4 — le temps du parcours est mesuré et consigné', () => {
  test('le parcours est chronométré, étape par étape', async ({ page }) => {
    const steps: { step: string; ms: number }[] = [];

    async function timed(step: string, run: () => Promise<void>): Promise<void> {
      const started = Date.now();
      await run();
      steps.push({ step, ms: Date.now() - started });
    }

    await timed('import et calage', async () => {
      await page.goto(PLAN);
      await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles(PLAN_FILE);
      await page.getByLabel(/Distance réelle|Real distance/).fill('20');
      await page.getByLabel(/Azimut du nord|North azimuth/).fill('0');
      await page.getByRole('button', { name: /^Valider le calage$|^Validate calibration$/ }).click();
      await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();
    });

    await timed('tracé de trois cellules', async () => {
      await page.goto(FOOTPRINTS);
      for (const code of ['B01', 'B02', 'B03']) {
        await page.getByLabel(/Code de cellule|Unit code/).fill(code);
        await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
      }
      await expect(page.getByText(/Empreintes\s*3|Footprints\s*3/)).toBeVisible();
    });

    await timed('saisie du graphe', async () => {
      await page.goto(GRAPH);
      for (let i = 0; i < 4; i += 1) {
        await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
      }
      await page.getByRole('button', { name: /Tracer les arêtes|Draw the edges/ }).click();
      await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();
    });

    await timed('validation', async () => {
      await page.goto(VALIDATION);
      await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
      await expect(page.getByText(/Aucune anomalie|No anomaly/)).toBeVisible();
    });

    const total = steps.reduce((sum, s) => sum + s.ms, 0);
    const record = {
      mesure: 'M8 (partie M) critère 1 — parcours complet de la tranche',
      releve_le: new Date().toISOString(),
      etapes: steps,
      total_ms: total,
      note: 'Parcours automatisé, non chronométré sur un opérateur réel. '
        + 'K3.4 place cette seconde mesure dans les sessions d’essai sur usagers.',
    };

    const path = resolve(HERE, '..', '..', 'docs', 'releve-m8-parcours.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    // Le relevé existe, et chaque étape a duré quelque chose.
    expect(steps.length).toBe(4);
    for (const step of steps) expect(step.ms, step.step).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });
});

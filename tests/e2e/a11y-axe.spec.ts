import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * M8 (partie M) critère 5 — contrôle automatisé d'accessibilité sur les cinq
 * écrans de la tranche.
 *
 * Ce que cet essai établit : **l'absence de violation détectable
 * automatiquement**, sur les règles de niveau A et AA de WCAG 2.0, 2.1 et 2.2.
 * Ce n'est pas une attestation de conformité AA : une part des critères ne
 * s'automatise pas, et l'attestation relève de l'audit externe du lot 4.7.
 *
 * Conditions posées à l'autorisation d'axe-core, toutes tenues ici :
 * dépendance de développement à version exacte, jamais livrée (contrôle
 * séparé dans `tests/a11y-not-shipped.test.ts`), axe-core seul injecté dans la
 * page, règles bornées aux niveaux A et AA, exécution sur les cinq écrans dans
 * leurs états atteignables et dans les deux langues, zéro violation exigée, et
 * tout résultat « incomplet » nommé au relevé plutôt qu'ignoré.
 */

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const HERE = dirname(fileURLToPath(import.meta.url));

/** D12.1 — les deux langues actives. */
const LANGS = ['fr', 'en'] as const;

const SITE = 'site-axe';
const LEVEL = 'niveau-axe';

/** Les cinq écrans de la partie M. */
const SCREENS = [
  { key: 'M1 liste des sites', path: '/sites' },
  { key: 'M2 import et calage', path: `/sites/${SITE}/levels/${LEVEL}/plan` },
  { key: 'M3 tracé des empreintes', path: `/sites/${SITE}/levels/${LEVEL}/footprints` },
  { key: 'M4 saisie du graphe', path: `/sites/${SITE}/levels/${LEVEL}/graph` },
  { key: 'M5 validation', path: `/sites/${SITE}/validation` },
] as const;

const SITE_R = 'site-axe-r';

/**
 * Pose un tableau des messages dans le magasin local, au format que le chemin
 * d'écriture produit. C'est le seul moyen d'analyser l'écran rempli tant que
 * l'écran de génération n'existe pas.
 */
async function seedSchedule(page: Page): Promise<void> {
  const schedule = 'sched-axe';
  const line = (index: number): unknown => ({
    table: 'message_line',
    id: `${schedule}-line-${String(index)}`,
    values: {
      id: `${schedule}-line-${String(index)}`,
      org_id: 'org-axe', schedule_id: schedule, support_id: 'sup-axe',
      face_index: 0, block_index: index,
      content: JSON.stringify({
        block_kind: 'destination_list',
        entries: [{
          destination_id: `dest-${String(index)}`,
          text: { fr: `Destination ${String(index)}`, en: `Destination ${String(index)}` },
          direction: 'left', distance_m: 40,
        }],
      }),
      pictogram_id: null, direction: 'left', information_level: 2,
      decision_point_id: 'n-hall', stale: index === 1,
      excluded: false, exclusion_reason: null,
    },
  });

  const session = {
    rows: [
      {
        table: 'support', id: 'sup-axe',
        values: { id: 'sup-axe', org_id: 'org-axe', site_id: SITE_R, code: 'D-042' },
      },
      {
        table: 'message_schedule', id: schedule,
        values: {
          id: schedule, org_id: 'org-axe', site_id: SITE_R, version: 7,
          state: 'draft', generated_at: '2026-04-01T00:00:00.000Z',
          inputs_hash: '0123456789abcdef',
        },
      },
      line(0), line(1),
      {
        table: 'message_schedule', id: `${schedule}-8`,
        values: {
          id: `${schedule}-8`, org_id: 'org-axe', site_id: SITE_R, version: 8,
          state: 'draft', generated_at: '2026-04-02T00:00:00.000Z',
          inputs_hash: 'fedcba9876543210',
        },
      },
      {
        ...(line(0) as { table: string; id: string; values: Record<string, unknown> }),
        id: `${schedule}-8-line-0`,
        values: {
          ...(line(0) as { values: Record<string, unknown> }).values,
          id: `${schedule}-8-line-0`, schedule_id: `${schedule}-8`, direction: 'right',
        },
      },
    ],
    queued: [],
  };

  await page.addInitScript(
    ([key, payload]: readonly string[]) => {
      window.localStorage.setItem(key ?? '', payload ?? '');
    },
    [`azimut.session.${SITE_R}`, JSON.stringify(session)] as const,
  );
}

/** Niveaux A et AA des trois versions de WCAG, et rien d'autre. */
const WCAG_A_AA = [
  'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa',
] as const;

type AxeNode = { readonly target: readonly string[]; readonly failureSummary?: string };
type AxeResult = {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly nodes: readonly AxeNode[];
};
type AxeRun = { readonly violations: readonly AxeResult[]; readonly incomplete: readonly AxeResult[] };

/** Ce qu'axe n'a pas pu trancher seul. Nommé, jamais écarté. */
type Incomplete = {
  readonly ecran: string;
  readonly etat: string;
  readonly langue: string;
  readonly regle: string;
  readonly aide: string;
  readonly elements: readonly string[];
};

const incompletes: Incomplete[] = [];

async function runAxe(page: Page): Promise<AxeRun> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async (tags: readonly string[]) => {
    const axe = (window as unknown as {
      axe: { run: (ctx: unknown, opts: unknown) => Promise<unknown> };
    }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: [...tags] },
      resultTypes: ['violations', 'incomplete'],
    });
    return result as AxeRun;
  }, WCAG_A_AA);
}

/** Analyse un écran dans un état donné, et rend le compte rendu lisible. */
async function check(
  page: Page, ecran: string, etat: string, langue: string,
): Promise<void> {
  const run = await runAxe(page);

  for (const result of run.incomplete) {
    incompletes.push({
      ecran, etat, langue,
      regle: result.id,
      aide: result.help,
      elements: result.nodes.flatMap(n => n.target),
    });
  }

  const readable = run.violations.map(v =>
    `${v.id} (${v.impact ?? 'sans gravité déclarée'}) — ${v.help}\n`
    + v.nodes.map(n => `    ${n.target.join(' ')}`).join('\n'));

  expect(
    run.violations,
    `${ecran} · ${etat} · ${langue}\n${readable.join('\n')}`,
  ).toHaveLength(0);
}

function url(path: string, lang: string): string {
  return `${path}?lang=${lang}`;
}

/**
 * Sérialisé : le relevé s'accumule en mémoire, et Playwright répartit sinon
 * les essais entre plusieurs processus, où chacun n'en verrait qu'une part.
 */
test.describe.configure({ mode: 'serial' });

test.describe('M8 (partie M) critère 5 — aucune violation détectable automatiquement', () => {
  for (const screen of SCREENS) {
    for (const lang of LANGS) {
      test(`${screen.key}, état nominal, ${lang}`, async ({ page }) => {
        await page.goto(url(screen.path, lang));
        await check(page, screen.key, 'nominal', lang);
      });
    }
  }

  /**
   * F7 — l'état vide. Il se distingue du nominal sur les écrans d'atelier :
   * une session neuve n'a ni empreinte ni nœud.
   */
  for (const lang of LANGS) {
    test(`M3 tracé des empreintes, état vide, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE}-vide/levels/${LEVEL}/footprints`, lang));
      await check(page, 'M3 tracé des empreintes', 'vide', lang);
    });

    test(`M4 saisie du graphe, état vide, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE}-vide/levels/${LEVEL}/graph`, lang));
      await check(page, 'M4 saisie du graphe', 'vide', lang);
    });

    test(`M5 validation, jamais lancée, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE}-vide/validation`, lang));
      await check(page, 'M5 validation', 'jamais lancée', lang);
    });
  }

  /** F7 — l'état hors ligne, avec son bandeau permanent. */
  for (const lang of LANGS) {
    test(`M4 saisie du graphe, hors ligne, ${lang}`, async ({ page, context }) => {
      await page.goto(url(`/sites/${SITE}/levels/${LEVEL}/graph`, lang));
      await context.setOffline(true);
      await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
      await check(page, 'M4 saisie du graphe', 'hors ligne', lang);
      await context.setOffline(false);
    });
  }

  /** F7 — l'état partiel de M2 (partie M) : fond chargé, calage incomplet. */
  for (const lang of LANGS) {
    test(`M2 import et calage, état partiel, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE}/levels/${LEVEL}/plan`, lang));
      await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles({
        name: 'niveau-0.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fond de plan d’essai'),
      });
      await check(page, 'M2 import et calage', 'partiel', lang);
    });
  }

  /**
   * M7.9 (partie M) — la boîte de confirmation, qui porte son propre piège de focus et
   * dont le contenu n'est analysable que quand elle est ouverte.
   *
   * C'est le remplacement de fond de M2, seule boîte atteignable dans les cinq
   * écrans. Celle de création d'un site, spécifiée au champ près en M1, est
   * construite mais n'est montée nulle part : `/sites` rend `SitesView`, qui
   * n'expose aucun bouton de création. Porté en « constaté, non traité »
   * plutôt que couvert par un essai qui ne s'exécuterait pas.
   */
  for (const lang of LANGS) {
    test(`M2 import et calage, confirmation de remplacement, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE}/levels/${LEVEL}/plan`, lang));
      await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles({
        name: 'niveau-0.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fond de plan d’essai'),
      });
      await page.getByLabel(/Remplacer le fond de plan|Replace the base plan/).setInputFiles({
        name: 'autre.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 autre fond'),
      });
      // La boîte doit être là : sans elle, l'analyse porterait sur l'écran
      // ordinaire et l'essai passerait sans rien éprouver.
      await expect(page.getByRole('dialog')).toBeVisible();
      await check(page, 'M2 import et calage', 'confirmation de remplacement', lang);
    });
  }

  /**
   * Partie R — l'écran du tableau des messages, critère 14 de R18 : « Aucune
   * violation détectable automatiquement aux niveaux A et AA, résultats
   * incomplets listés pour revue manuelle. »
   *
   * Deux états l'un et l'autre atteignables : le tableau rempli, et l'état
   * vide de R16, qui n'est pas le même écran amputé mais une invitation.
   */
  for (const lang of LANGS) {
    test(`R tableau des messages, état nominal, ${lang}`, async ({ page }) => {
      await seedSchedule(page);
      await page.goto(url(`/sites/${SITE_R}/wayfinding/messages`, lang));
      await page.getByRole('button', {
        name: /Reprendre le travail local|Resume local work/,
      }).click();
      await expect(page.getByRole('table')).toBeVisible();
      await check(page, 'R tableau des messages', 'nominal', lang);
    });

    test(`R tableau des messages, comparaison de versions, ${lang}`, async ({ page }) => {
      await seedSchedule(page);
      await page.goto(url(`/sites/${SITE_R}/wayfinding/messages`, lang));
      await page.getByRole('button', {
        name: /Reprendre le travail local|Resume local work/,
      }).click();
      await page.getByRole('button', { name: /^Comparer$|^Compare$/ }).click();
      // La comparaison doit être là : sans elle, l'analyse porterait sur le
      // tableau ordinaire et l'essai passerait sans rien éprouver.
      await expect(page.getByText(/ajoutée|added/)).toBeVisible();
      await check(page, 'R tableau des messages', 'comparaison de versions', lang);
    });

    test(`R tableau des messages, aucune version, ${lang}`, async ({ page }) => {
      await page.goto(url(`/sites/${SITE_R}-vide/wayfinding/messages`, lang));
      await check(page, 'R tableau des messages', 'aucune version', lang);
    });
  }

  test.afterAll(() => {
    const path = resolve(HERE, '..', '..', 'docs', 'releve-axe.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({
      mesure: 'M8 (partie M) critère 5 — absence de violation détectable automatiquement',
      outil: 'axe-core, dépendance de développement, jamais livrée',
      regles: WCAG_A_AA,
      portee: 'Les cinq écrans de la partie M et l’écran du tableau des messages de la partie R, dans leurs états atteignables, en français et en anglais.',
      limite: 'L’absence de violation détectable n’atteste pas la conformité AA, qui relève de l’audit externe du lot 4.7.',
      incomplets: incompletes,
    }, null, 2)}\n`, 'utf8');
  });
});

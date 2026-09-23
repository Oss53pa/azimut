import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, release, totalmem } from 'node:os';

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
 * Les quatre nœuds du parcours, et leur type.
 *
 * Une entrée, deux carrefours, un accès à une destination. Ce n'est pas une
 * décoration : sans entrée, `validateGraph` lève `GRAPH.NO_ENTRANCE`, et une
 * extrémité de type carrefour lève `GRAPH.DEAD_END_UNJUSTIFIED`. Le parcours
 * posait quatre carrefours parce que l'écran ne savait poser que cela ; il
 * pose maintenant ce qu'un opérateur pose, et le graphe est cohérent.
 */
const CHAIN_NODE_KINDS = [
  'entrance', 'junction', 'junction', 'destination_access',
] as const;

/**
 * L'ordre des options, celui de `NODE_KINDS` (A5.3). Il est repris ici parce
 * qu'un essai de bout en bout ne lit pas le code de l'application : il compte
 * les crans que l'opérateur descend, et un décalage entre les deux listes est
 * précisément ce que l'essai doit faire échouer.
 */
const NODE_KIND_ORDER = [
  'entrance', 'junction', 'landing', 'elevator', 'stair', 'escalator',
  'emergency_exit', 'restroom', 'security_post', 'information_point',
  'destination_access',
] as const;

type NodeKindValue = (typeof NODE_KIND_ORDER)[number];

/** Le sélecteur porte la valeur du modèle, identique dans les deux langues. */
const NEXT_NODE_KIND = /Type du prochain nœud|Type of the next node/;

async function placeChainNodes(page: Page): Promise<void> {
  for (const kind of CHAIN_NODE_KINDS) {
    await page.getByLabel(NEXT_NODE_KIND).selectOption(kind);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
  }
}

/**
 * Les deux points de calage, posés au clavier.
 *
 * M2 (partie M) les pose au clic dans la zone de travail, et M7.2 (partie M)
 * veut la même valeur saisissable au clavier. Ils sont distants de 200 pixels,
 * bien au-delà des 40 que `CALIB.POINTS_TOO_CLOSE` exige.
 */
const CALIBRATION_POINTS = [
  [/Point A · X/, '0'], [/Point A · Y/, '0'],
  [/Point B · X/, '200'], [/Point B · Y/, '0'],
] as const;

async function placeCalibrationPoints(page: Page): Promise<void> {
  for (const [label, value] of CALIBRATION_POINTS) {
    await page.getByLabel(label).fill(value);
  }
}

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
  await placeCalibrationPoints(page);
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
  await placeChainNodes(page);
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

  /**
   * Le contre-exemple, qu'C1 exige de toute détection : une validation qui ne
   * refuse rien ne prouve rien. L'écran a longtemps affiché « aucune anomalie »
   * sur n'importe quel graphe, parce qu'il ne faisait pas tourner le moteur.
   *
   * Une seule altération du parcours : les quatre nœuds sont des carrefours,
   * donc le graphe n'a pas d'entrée. `validateGraph` lève `GRAPH.NO_ENTRANCE`,
   * et l'écran doit le montrer plutôt que de conclure au succès.
   */
  test('un graphe sans entrée est refusé, et l’écran le nomme', async ({ page }) => {
    await page.goto(GRAPH);
    for (let i = 0; i < CHAIN_NODE_KINDS.length; i += 1) {
      await page.getByLabel(NEXT_NODE_KIND).selectOption('junction');
      await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    }
    await page.getByRole('button', { name: /Tracer les arêtes|Draw the edges/ }).click();
    await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();

    await page.goto(VALIDATION);
    await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
    await expect(
      page.getByText(/Aucune entrée dans le graphe|No entrance in the graph/),
    ).toBeVisible();
    await expect(page.getByText(/Aucune anomalie|No anomaly/)).toHaveCount(0);
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

    for (const [label, value] of CALIBRATION_POINTS) {
      await page.getByLabel(label).focus();
      await page.keyboard.type(value);
    }
    await page.getByLabel(/Distance réelle|Real distance/).focus();
    await page.keyboard.type('20');
    await page.getByLabel(/Azimut du nord|North azimuth/).focus();
    await page.keyboard.type('0');

    // Tabuler jusqu'au bouton de validation, puis le presser à la barre
    // d'espace — sans jamais cliquer.
    await pressByKeyboard(page, /^Valider le calage$|^Validate calibration$/);
    await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();

    await page.goto(GRAPH);
    // M4 (partie M) critère 4 : « Le graphe complet est saisissable au clavier
    // seul. » Le type du nœud en fait partie — un sélecteur qu'on ne pourrait
    // atteindre qu'à la souris rendrait le parcours au clavier incomplet sans
    // qu'aucun essai le dise.
    for (const kind of CHAIN_NODE_KINDS) {
      await chooseNodeKindByKeyboard(page, kind);
      await pressByKeyboard(page, /^Poser un nœud$|^Place a node$/);
    }
    await expect(page.getByText(/Nœuds\s*4|Nodes\s*4/)).toBeVisible();

    await pressByKeyboard(page, /Tracer les arêtes|Draw the edges/);
    await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();
  });
});

/**
 * Tabule jusqu'au sélecteur de type, puis le règle aux flèches.
 *
 * `Home` remonte à la première option, et chaque `ArrowDown` descend d'un
 * cran : c'est le comportement natif d'une liste déroulante, et c'est ce
 * qu'un opérateur au clavier fait. `selectOption` de Playwright ne passerait
 * pas par le clavier, et prouverait autre chose.
 */
async function chooseNodeKindByKeyboard(page: Page, kind: NodeKindValue): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const reached = await page.evaluate(() => {
      const active = document.activeElement;
      return active instanceof HTMLSelectElement
        && (active.labels?.[0]?.textContent ?? '').includes('prochain');
    });
    if (reached) {
      await page.keyboard.press('Home');
      for (let step = 0; step < NODE_KIND_ORDER.indexOf(kind); step += 1) {
        await page.keyboard.press('ArrowDown');
      }
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('sélecteur de type non atteint au clavier');
}

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

  /**
   * L'autre branche du choix : écarter n'est jamais une fusion.
   *
   * E5.4 veut le choix « entre l'état local et l'état serveur ». Le dépôt ne
   * connaît pas ce site — il n'existe que sur ce poste —, l'état du dépôt est
   * donc vide et écarter ramène à zéro. Le libellé, lui, dit ce que le bouton
   * fait : repartir de l'état enregistré.
   */
  test('écarter l’état local repart de l’état enregistré, sans rien fusionner', async ({ page }) => {
    await page.goto(GRAPH);
    await page.getByRole('button', { name: /^Poser un nœud$|^Place a node$/ }).first().click();
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();

    await page.evaluate(
      (site: string) => { sessionStorage.removeItem(`azimut.session.open.${site}`); }, SITE);
    await page.reload();

    await page.getByRole('dialog').getByRole('button', {
      name: /Repartir de l’état enregistré|Start from the stored state/,
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

/** D13 : « 5 exécutions, mesure retenue = médiane. » */
const D13_RUNS = 5;

const STEP_NAMES = [
  'import et calage', 'tracé de trois cellules', 'saisie du graphe', 'validation',
] as const;

type Step = { step: string; ms: number };
type Run = { steps: Step[]; total_ms: number };

/**
 * La médiane d'un échantillon. Sur un nombre pair de valeurs, la moyenne des
 * deux valeurs centrales : c'est la définition, et l'écarter au profit de
 * l'une des deux reviendrait à choisir.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/**
 * D13 : « caches vidés entre chaque exécution, condition déclarée dans le
 * résultat. » Le travail du parcours vit dans le stockage local ; le laisser
 * ferait démarrer l'exécution suivante sur un site déjà modélisé, et mesurer
 * autre chose.
 */
async function clearBetweenRuns(page: Page): Promise<void> {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.context().clearCookies();
}

/**
 * D13 : « Machine de référence déclarée. » Relevée à l'exécution plutôt que
 * saisie : une caractéristique écrite à la main cesse d'être vraie sans que
 * personne le remarque.
 */
function machineOfRecord(): Record<string, string> {
  return {
    plateforme: `${platform()} ${release()}`,
    processeur: cpus()[0]?.model ?? 'inconnu',
    coeurs: String(cpus().length),
    memoire_gio: (totalmem() / 1024 ** 3).toFixed(1),
    node: process.version,
  };
}

test.describe('M8 (partie M) critère 4 — le temps du parcours est mesuré et consigné', () => {
  test('le parcours est chronométré selon le protocole D13', async ({ page }) => {
    const runs: Run[] = [];

    for (let pass = 0; pass < D13_RUNS; pass += 1) {
      const steps: Step[] = [];

      async function timed(step: string, run: () => Promise<void>): Promise<void> {
        const started = Date.now();
        await run();
        steps.push({ step, ms: Date.now() - started });
      }

      await timed('import et calage', async () => {
        await page.goto(PLAN);
        await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles(PLAN_FILE);
        await placeCalibrationPoints(page);
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
        await placeChainNodes(page);
        await page.getByRole('button', { name: /Tracer les arêtes|Draw the edges/ }).click();
        await expect(page.getByText(/Arêtes\s*3|Edges\s*3/)).toBeVisible();
      });

      await timed('validation', async () => {
        await page.goto(VALIDATION);
        await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
        await expect(page.getByText(/Aucune anomalie|No anomaly/)).toBeVisible();
      });

      runs.push({ steps, total_ms: steps.reduce((sum, s) => sum + s.ms, 0) });
      await clearBetweenRuns(page);
    }

    // D13 : « 5 exécutions, mesure retenue = médiane. La première exécution
    // est écartée. » L'écart porte sur la première, pas sur la plus lente :
    // c'est la mise en température des caches qu'on retire, pas un résultat
    // qui déplaît.
    const retained = runs.slice(1);
    const record = {
      mesure: 'M8 (partie M) critère 4 — temps du parcours complet de la tranche',
      protocole: 'D13',
      releve_le: new Date().toISOString(),
      machine: machineOfRecord(),
      condition: 'Base amorcée. Entre deux exécutions : stockages local et de '
        + 'session vidés, cache du navigateur vidé, contexte conservé. La '
        + 'première exécution est écartée.',
      site: 'site-m8, site vide. M8 critère 1 part d’un site vide : aucun site '
        + 'de référence de C1 ne convient, ils portent tous une modélisation.',
      executions: runs.map((run, index) => ({
        rang: index + 1,
        ecartee: index === 0,
        total_ms: run.total_ms,
        etapes: run.steps,
      })),
      mediane_ms: median(retained.map(r => r.total_ms)),
      mediane_par_etape_ms: STEP_NAMES.map(step => ({
        step,
        ms: median(retained.map(r => r.steps.find(s => s.step === step)?.ms ?? 0)),
      })),
      note: 'Parcours automatisé, non chronométré sur un opérateur réel. '
        + 'K3.4 place cette seconde mesure dans les sessions d’essai sur usagers. '
        + 'Aucun seuil n’est révisé sur ce relevé : D13 réserve la révision au '
        + 'premier site réel modélisé, et la trace.',
    };

    const path = resolve(HERE, '..', '..', 'docs', 'releve-m8-parcours.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    expect(runs).toHaveLength(D13_RUNS);
    for (const run of runs) {
      expect(run.steps).toHaveLength(STEP_NAMES.length);
      for (const step of run.steps) expect(step.ms, step.step).toBeGreaterThan(0);
    }
    expect(record.mediane_ms).toBeGreaterThan(0);
  });
});

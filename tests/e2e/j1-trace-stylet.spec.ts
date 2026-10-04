import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * J1 et G3 (parties J et G) — tracer une empreinte dans la zone de travail.
 *
 * La reconnaissance est essayée sur ses formes dans
 * `editor/ink/__tests__/recognize.test.ts`. Ce qui ne se prouve qu'à l'écran :
 * qu'un trait tracé dans la zone devient le contour en cours, lisible et
 * modifiable sommet par sommet dans le panneau, et qu'`Entrée` le ferme comme
 * une saisie au clavier ; que le doigt est refusé avec son motif ; que la
 * paume est ignorée pendant que le stylet est actif.
 */
const SITE = 'site-stylet';
const LEVEL = 'niveau-stylet';
const FOOTPRINTS = `/sites/${SITE}/levels/${LEVEL}/footprints`;

const ZONE = /Zone de travail : tracez au stylet|Work area: draw with a stylus/;

/** Un rectangle tracé à main levée, en coordonnées de la zone. */
async function drawRectangle(page: Page): Promise<void> {
  const box = await page.getByRole('img', { name: ZONE }).boundingBox();
  if (box === null) throw new Error('zone introuvable');
  const x0 = box.x + box.width * 0.3;
  const y0 = box.y + box.height * 0.3;
  const corners = [
    [x0, y0], [x0 + 200, y0 + 4], [x0 + 203, y0 + 130], [x0 - 2, y0 + 127], [x0 + 1, y0 + 2],
  ] as const;
  await page.mouse.move(corners[0][0], corners[0][1]);
  await page.mouse.down();
  for (const [x, y] of corners.slice(1)) await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

async function vertexValues(page: Page, axis: 'X' | 'Y'): Promise<readonly string[]> {
  const fields = page.getByLabel(new RegExp(`(Sommet|Vertex) \\d+ · ${axis}`));
  return fields.evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value));
}

/** Un événement de pointeur synthétique, du type demandé. */
async function pointer(page: Page, type: string, pointerType: 'pen' | 'touch', buttons: number): Promise<void> {
  const box = await page.getByRole('img', { name: ZONE }).boundingBox();
  if (box === null) throw new Error('zone introuvable');
  await page.getByRole('img', { name: ZONE }).dispatchEvent(type, {
    pointerType, pointerId: pointerType === 'pen' ? 9 : 4, buttons, bubbles: true,
    clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
  });
}

test.describe('J1 (partie J) — le tracé dans la zone de travail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('img', { name: ZONE })).toBeVisible();
  });

  test('un rectangle à main levée devient le contour en cours, sur les axes', async ({ page }) => {
    await drawRectangle(page);

    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue : rectangle|Recognised shape: rectangle/ }))
      .toBeVisible();
    const xs = await vertexValues(page, 'X');
    const ys = await vertexValues(page, 'Y');
    expect(xs).toHaveLength(4);
    expect(new Set(xs).size).toBe(2);
    expect(new Set(ys).size).toBe(2);
  });

  test('le contour tracé se ferme comme une saisie, et le trait d’origine s’efface', async ({ page }) => {
    await drawRectangle(page);
    await page.getByLabel(/Code de cellule|Unit code/).fill('S01');
    await page.getByRole('button', { name: /Fermer le polygone|Close polygon/ }).click();
    await expect(page.getByText(/Empreintes\s*1|Footprints\s*1/)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Forme reconnue|Recognised shape/ })).toHaveCount(0);
  });

  test('un outil qui ne trace pas le dit, au lieu de lire le trait', async ({ page }) => {
    await page.keyboard.press('v');
    await drawRectangle(page);
    await expect(page.getByText(/Choisissez un outil de tracé|Choose a drawing tool/)).toBeVisible();
  });

  test('le doigt est refusé, avec son motif', async ({ page }) => {
    await pointer(page, 'pointerdown', 'touch', 1);
    await expect(page.getByText(/Le tracé au doigt n’est pas proposé|Drawing with a finger is not offered/))
      .toBeVisible();
  });

  test('la paume posée pendant que le stylet survole est ignorée', async ({ page }) => {
    await pointer(page, 'pointermove', 'pen', 0);
    await pointer(page, 'pointerdown', 'touch', 1);
    await expect(page.getByText(/Le tracé au doigt n’est pas proposé|Drawing with a finger is not offered/))
      .toHaveCount(0);
  });

  test('sans plan calé, la zone dit qu’elle n’a pas de fond', async ({ page }) => {
    await expect(page.getByText(/Aucun plan calé pour ce niveau|No calibrated plan for this level/)).toBeVisible();
  });
});

/** Une image PNG valide d'un pixel : le navigateur la décode et en lit la taille. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Change d'écran sans recharger la page, comme le fait le studio. */
async function navigate(page: Page, path: string): Promise<void> {
  await page.evaluate(target => {
    history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test.describe('J1.4 (partie J) — le plan calé sert de fond de décalque', () => {
  test('l’image calée est posée dans la zone, et la zone ne s’en excuse plus', async ({ page }) => {
    await page.goto(`/sites/${SITE}/levels/${LEVEL}/plan`);
    await page.getByLabel(/Fichier du fond de plan|Base plan file/)
      .setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
    for (const [label, value] of [
      [/Point A · X/, '0'], [/Point A · Y/, '0'], [/Point B · X/, '200'], [/Point B · Y/, '0'],
    ] as const) {
      await page.getByLabel(label).fill(value);
    }
    await page.getByLabel(/Distance réelle|Real distance/).fill('20');
    await page.getByLabel(/Azimut du nord|North azimuth/).fill('0');
    await page.getByRole('button', { name: /^Valider le calage$|^Validate calibration$/ }).click();
    await expect(page.getByText(/Plan calé|Plan calibrated/)).toBeVisible();

    await navigate(page, FOOTPRINTS);
    const image = page.getByRole('img', { name: ZONE }).locator('image');
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('href', /^blob:/);
    await expect(image).toHaveAttribute('width', '1');
    await expect(page.getByText(/Aucun plan calé pour ce niveau|No calibrated plan for this level/)).toHaveCount(0);

    // Le fichier n'est gardé que le temps de la session : rechargée, la page
    // le dit au lieu de montrer une zone vide sans explication.
    await page.goto(FOOTPRINTS);
    await expect(page.getByText(/n’est gardé que pendant la session|only kept during the session/)).toBeVisible();
  });
});

test.describe('J1.2 (partie J) — le réseau de circulation tracé dans l’atelier du graphe', () => {
  const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;
  const VIEW = /Graphe du niveau|Level graph/;

  async function centreOf(page: Page, index: number): Promise<{ x: number; y: number }> {
    const node = page.getByRole('group', { name: VIEW }).getByRole('button', { name: /Nœud|Node/ }).nth(index);
    const box = await node.boundingBox();
    if (box === null) throw new Error('nœud introuvable');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  test('un point appuyé pose un nœud ; un trait d’un nœud à l’autre les relie', async ({ page }) => {
    await page.goto(GRAPH);
    const view = page.getByRole('group', { name: VIEW });
    const box = await view.boundingBox();
    if (box === null) throw new Error('vue introuvable');

    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
    await expect(page.getByText(/Nœuds\s*1|Nodes\s*1/)).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();

    // Un point appuyé sur un nœud posé le sélectionne, sans en poser un second.
    const first = await centreOf(page, 0);
    await page.mouse.click(first.x, first.y);
    await expect(page.getByText(/Nœuds\s*2|Nodes\s*2/)).toBeVisible();
    await expect(page.getByRole('group', { name: VIEW }).getByRole('button', { name: /Nœud|Node/, pressed: true }))
      .toHaveCount(1);

    await page.keyboard.press('e');
    await expect(page.getByRole('button', { name: /Arête E|Edge E/, pressed: true })).toBeVisible();
    const a = await centreOf(page, 0);
    const b = await centreOf(page, 1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2 + 12, { steps: 10 });
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText(/Arêtes\s*1|Edges\s*1/)).toBeVisible();
  });

  test('l’outil Arête dit ce qu’il attend d’un trait qui ne part d’aucun nœud', async ({ page }) => {
    await page.goto(GRAPH);
    // L'atelier rendu avant la frappe : sinon la touche part avant que
    // l'écran l'écoute (même course que celle de M7.8, partie M).
    await expect(page.getByRole('button', { name: /Nœud N|Node N/, pressed: true })).toBeVisible();
    await page.keyboard.press('e');
    await expect(page.getByRole('button', { name: /Arête E|Edge E/, pressed: true })).toBeVisible();
    const box = await page.getByRole('group', { name: VIEW }).boundingBox();
    if (box === null) throw new Error('vue introuvable');
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 80, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText(/L’outil Arête attend un trait|The Edge tool expects a stroke/)).toBeVisible();
  });
});

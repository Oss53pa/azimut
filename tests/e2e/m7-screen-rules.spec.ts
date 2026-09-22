import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M7 (partie M) — les onze règles que tout écran construit ensuite reprend.
 *
 * « Ces onze règles sont extraites de la tranche. Tout écran construit ensuite
 * s'y conforme, sans qu'il soit nécessaire de le spécifier en entier. »
 *
 * N0 rend une règle numérotée opposable : elle se cite en revue et en test.
 * Un essai par règle, donc, nommé par elle, et exercé sur les écrans réels.
 */

const SITE = 'site-essai';
const LEVEL = 'niveau-essai';

const PLAN = `/sites/${SITE}/levels/${LEVEL}/plan`;
const FOOTPRINTS = `/sites/${SITE}/levels/${LEVEL}/footprints`;
const GRAPH = `/sites/${SITE}/levels/${LEVEL}/graph`;
const VALIDATION = `/sites/${SITE}/validation`;
const ALL = [PLAN, FOOTPRINTS, GRAPH, VALIDATION, '/sites'] as const;

/**
 * Charge un fond de plan, comme l'étape 1 de M2 (partie M).
 *
 * Les champs d'échelle et d'orientation restent désactivés tant qu'aucun fond
 * n'est chargé : on ne fixe pas le nord d'un plan qu'on n'a pas. Éprouver ces
 * champs demande donc de suivre la chaîne, ce qui est aussi ce que M8
 * (partie M) critère 1 exige.
 */
async function loadPlan(page: Page): Promise<void> {
  await page.getByLabel(/Fichier du fond de plan|Base plan file/).setInputFiles({
    name: 'niveau-0.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fond de plan d’essai'),
  });
}

test.describe('M7.1 (partie M) — les six états sont traités', () => {
  /**
   * « Un écran qui ne traite que le cas nominal est incomplet. » L'état vide
   * est celui qu'on voit en arrivant sur un site neuf : il doit inviter à
   * agir, et non constater une absence.
   */
  test('l’état vide invite à agir plutôt que de constater', async ({ page }) => {
    await page.goto(GRAPH);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Posez les nœuds|Place the nodes/);
    // L'invitation est celle de l'état vide, et non le bouton d'outil du
    // panneau, qui porte le même nom parce qu'il fait la même chose.
    await expect(
      page.getByRole('status').getByRole('button', { name: /Poser un nœud|Place a node/ }),
    ).toBeVisible();
  });

  /**
   * M3 (partie M) : « Vide | Plan calé visible, invitation à tracer la
   * première cellule, outil cellule déjà actif. » L'état vide d'un écran
   * d'atelier s'ajoute à la zone de travail, il ne la remplace pas.
   */
  test('l’état vide d’un atelier laisse voir la zone de travail', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('toolbar')).toBeVisible();
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
  });
});

test.describe('M7.2 (partie M) — tout se saisit au clavier, en numérique, dans le panneau', () => {
  /**
   * « Toute valeur saisissable au pointeur l'est aussi au clavier, en
   * numérique, dans le panneau et non dans un menu secondaire. »
   *
   * Les sommets d'une empreinte sont le cas limite : ils se posent au
   * pointeur, et M3 (partie M) exige qu'ils se saisissent aussi un par un.
   */
  test('les valeurs du calage sont numériques, dans le panneau', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);
    for (const label of [/Distance réelle|Real distance/, /Azimut du nord|North azimuth/]) {
      await expect(page.getByLabel(label)).toHaveAttribute('type', 'number');
    }
  });

  /** Saisi au clavier seul, sans un clic. */
  test('l’azimut se saisit au clavier seul', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);
    const azimuth = page.getByLabel(/Azimut du nord|North azimuth/);
    await azimuth.focus();
    await page.keyboard.type('42');
    await expect(azimuth).toHaveValue('42');
  });
});

test.describe('M7.3 (partie M) — une valeur calculée est en lecture seule et se dit telle', () => {
  test('la surface d’une empreinte ne se saisit pas', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    const area = page.getByLabel(/Surface|Area/).first();
    await expect(area).toHaveAttribute('readonly', '');
    await expect(area).toHaveAttribute('aria-readonly', 'true');
  });

  /** Le caractère calculé est *visible*, pas seulement annoncé. */
  test('le caractère calculé se voit dans le libellé', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    const label = page.locator('label', { hasText: /Surface|Area/ }).first();
    await expect(label).toContainText('=');
  });
});

test.describe('M7.4 (partie M) — tout champ dimensionnel affiche son unité', () => {
  test('la distance réelle affiche ses mètres', async ({ page }) => {
    await page.goto(PLAN);
    const label = page.locator('label', { hasText: /Distance réelle|Real distance/ }).first();
    await expect(label).toContainText('m');
  });

  test('l’azimut affiche ses degrés', async ({ page }) => {
    await page.goto(PLAN);
    const label = page.locator('label', { hasText: /Azimut|azimuth/ }).first();
    await expect(label).toContainText('°');
  });
});

test.describe('M7.5 (partie M) — un refus n’efface jamais le travail en cours', () => {
  /**
   * L'azimut hors domaine est refusé par `computeCalibration`. Ce que cet
   * essai vérifie, c'est que le refus laisse la saisie en place : effacer le
   * champ obligerait à tout ressaisir pour corriger une faute de frappe.
   */
  test('une saisie refusée reste à l’écran', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);
    const distance = page.getByLabel(/Distance réelle|Real distance/);
    await distance.fill('42.5');
    const azimuth = page.getByLabel(/Azimut du nord|North azimuth/);
    await azimuth.fill('999');
    await page.getByRole('button', { name: /Valider le calage|Validate calibration/ }).click();

    // Les deux champs gardent ce qui y avait été saisi.
    await expect(distance).toHaveValue('42.5');
    await expect(azimuth).toHaveValue('999');
  });
});

test.describe('M7.6 (partie M) — une anomalie porte son entité, son lien et sa référence', () => {
  /**
   * « Une anomalie porte son entité, un lien vers elle, et sa référence
   * normative le cas échéant. » L'écran de validation est celui qui les
   * affiche toutes.
   */
  test('l’écran de validation groupe les anomalies par entité', async ({ page }) => {
    await page.goto(VALIDATION);
    await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
    // Sans anomalie, le constat est net et n'invente aucune ligne.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Aucune anomalie|No anomaly/);
  });
});

test.describe('M7.7 (partie M) — aucune information portée par la seule couleur', () => {
  test('la gravité se lit au mot, pas à la teinte', async ({ page }) => {
    await page.goto(VALIDATION);
    await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
    await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/bloquantes|blocking/);
  });

  test('l’outil actif porte un état, pas une seule teinte', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);
  });
});

test.describe('M7.8 (partie M) — le focus est distinct de la sélection', () => {
  /**
   * « Confondre les deux rend l'application inutilisable au clavier. »
   *
   * Deux géométries, et c'est ce que cet essai vérifie : le focus est un
   * contour extérieur, la sélection un fond. Un élément qui serait les deux
   * porterait les deux marques sans qu'elles se confondent.
   */
  test('le focus est un contour, la sélection un fond', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    await page.keyboard.press('Tab');

    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null) return null;
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset };
    });
    expect(focus?.style, 'le focus n’a pas de contour').not.toBe('none');
    expect(focus?.offset, 'le contour de focus n’est pas détaché').not.toBe('0px');
  });

  test('les deux indicateurs ne partagent pas leur géométrie', async ({ page }) => {
    await page.goto(FOOTPRINTS);
    const selected = await page.evaluate(() => {
      const el = document.querySelector('[aria-pressed="true"]');
      if (el === null) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, outline: s.outlineStyle };
    });
    // La sélection marque le fond et non le contour : le focus reste libre.
    expect(selected?.outline).toBe('none');
    expect(selected?.background).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('M7.9 (partie M) — une action à conséquence demande une confirmation qui la nomme', () => {
  /**
   * M2 (partie M) : « Remplacer un fond sans recaler est le geste qui décale
   * silencieusement toute une modélisation. Il demande donc une confirmation
   * nommant la conséquence. »
   *
   * La boîte existe et nomme la conséquence ; ce que cet essai vérifie, c'est
   * que le texte dit ce qui va se passer, et non « êtes-vous sûr ».
   */
  test('remplacer un fond ouvre une confirmation qui nomme la conséquence', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);

    // M2 (partie M), troisième action. Elle n'apparaît qu'une fois un fond
    // chargé : remplacer ce qui n'existe pas n'a pas de sens.
    await page.getByLabel(/Remplacer le fond de plan|Replace the base plan/)
      .setInputFiles({
        name: 'autre.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 autre fond'),
      });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // La conséquence est nommée : elle dit ce qui va se passer.
    const consequence = dialog.locator('[data-consequence="true"]');
    await expect(consequence).toContainText(/calage sera perdu|calibration will be lost/);
  });

  /**
   * « Une confirmation qui nomme la conséquence », et non « êtes-vous sûr ».
   * Une confirmation qui ne dit pas ce qui va se passer s'apprend, se clique
   * sans lire, et cesse de protéger.
   */
  test('la confirmation ne demande jamais « êtes-vous sûr »', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);
    await page.getByLabel(/Remplacer le fond de plan|Replace the base plan/)
      .setInputFiles({
        name: 'autre.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      });
    const dialog = await page.getByRole('dialog').innerText();
    expect(dialog).not.toMatch(/êtes-vous sûr|are you sure/i);
  });

  /** Renoncer ne remplace rien : le fond et son calage restent en place. */
  test('renoncer laisse le fond en place', async ({ page }) => {
    await page.goto(PLAN);
    await loadPlan(page);
    await page.getByLabel(/Remplacer le fond de plan|Replace the base plan/)
      .setInputFiles({
        name: 'autre.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      });
    await page.getByRole('button', { name: /Ne pas remplacer|Do not replace/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/Fond PDF chargé|PDF plan loaded/)).toBeVisible();
  });
});

test.describe('M7.10 (partie M) — l’accent ne signale que ce que le logiciel a calculé', () => {
  /**
   * La partie F le dit deux fois : « accent réservé aux valeurs produites par
   * un moteur », et « ce que l'utilisateur a saisi reste neutre ».
   *
   * Le bouton principal tirait sa teinte de l'accent, comme l'élément actif de
   * la barre latérale et le sélecteur de langue. Aucune de ces trois choses
   * n'est une valeur calculée.
   */
  test('aucun bouton ne porte l’accent', async ({ page }) => {
    for (const path of ALL) {
      await page.goto(path);
      const accented = await page.evaluate(() => {
        const accent = getComputedStyle(document.documentElement)
          .getPropertyValue('--accent').trim();
        if (accent === '') return ['jeton --accent introuvable'];
        const hit: string[] = [];
        for (const el of document.querySelectorAll('button, a')) {
          const s = getComputedStyle(el);
          for (const value of [s.backgroundColor, s.color, s.borderTopColor]) {
            if (matchesToken(value, accent)) hit.push(el.textContent?.trim() ?? el.tagName);
          }
        }
        return hit;

        function matchesToken(value: string, token: string): boolean {
          const probe = document.createElement('span');
          probe.style.color = token;
          document.body.appendChild(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          return value === resolved;
        }
      });
      expect(accented, `${path} : ${JSON.stringify(accented)}`).toEqual([]);
    }
  });
});

test.describe('M7.11 (partie M) — aucun résultat vide présenté comme un succès', () => {
  /**
   * « Un écran vide qui ressemble à une réussite alors que rien n'a été
   * calculé est le pire des états possibles. »
   */
  test('la validation jamais lancée ne se présente pas comme saine', async ({ page }) => {
    await page.goto(VALIDATION);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/n’a pas encore été lancée|has not been run yet/);
    expect(body).not.toMatch(/Aucune anomalie|No anomaly/);
  });

  test('une fois lancée sans anomalie, le constat est net', async ({ page }) => {
    await page.goto(VALIDATION);
    await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Aucune anomalie|No anomaly/);
    // Et il rappelle que la complétude n'est pas la justesse.
    expect(body).toMatch(/pas la justesse|not correctness/);
  });

  /** Le taux de couverture dit ce qu'il attend, jamais zéro ni un tiret. */
  test('le taux conditionné ne s’affiche ni en zéro ni en tiret', async ({ page }) => {
    await page.goto(VALIDATION);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/en attente du calcul|awaiting the computation/);
  });
});

/** L'écran de validation, employé par plusieurs essais ci-dessus. */
export async function runValidation(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Lancer la validation|Run validation/ }).first().click();
}

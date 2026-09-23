import { test, expect } from '@playwright/test';

/**
 * M1 (partie M) — le formulaire de création d'un site, à son chemin.
 *
 * Il était spécifié au champ près et monté nulle part : `/sites` rendait la
 * liste sans bouton de création. Un écran inatteignable ne vaut pas mieux
 * qu'un écran absent, et aucun essai ne pouvait l'analyser.
 */
test.describe('M1 (partie M) — création d’un site', () => {
  test('le formulaire s’ouvre depuis la liste des sites', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Nom du site/)).toBeVisible();
  });

  /**
   * M1 (partie M), version 6 : « Paquet de règles | facultatif à la création |
   * aucune anomalie à la création ; information affichée ».
   */
  test('la ligne du paquet de règles affiche une information, pas une anomalie', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();

    const note = page.getByText(/La composition des supports restera bloquée/);
    await expect(note).toBeVisible();
    // Une information, pas une alerte : le rôle ARIA le dit aux technologies
    // d'assistance autant que la teinte le dit à l'œil.
    await expect(note.locator('xpath=ancestor::*[@role][1]')).toHaveAttribute('role', 'status');
    await expect(page.getByText('RULES.PACK_NOT_BOUND')).toHaveCount(0);
  });

  /** O4 — le fuseau est requis, et la création le refuse sans lui. */
  test('le fuseau horaire est requis', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();
    await page.getByLabel(/Nom du site/).fill('Site de vérification');
    await page.getByRole('button', { name: /^Créer le site$/ }).click();

    await expect(page.getByText(/fuseau horaire/i).first()).toBeVisible();
    // Le refus n'efface pas le travail en cours (M7.5, partie M).
    await expect(page.getByLabel(/Nom du site/)).toHaveValue('Site de vérification');
  });

  test('le formulaire se parcourt et se ferme au clavier', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('le même formulaire se lit en anglais', async ({ page }) => {
    await page.goto('/sites?lang=en');
    await page.getByRole('button', { name: /^New site$/ }).click();
    await expect(page.getByLabel(/Time zone/)).toBeVisible();
  });

  /**
   * Q9, version 7 — « Aucune liste de pays ni correspondance vers les fuseaux
   * dans le code. » Le sélecteur porte le référentiel, et non les seuls pays
   * des sites déjà créés, qui était le contenu précédent.
   */
  test('les pays proposés viennent du référentiel, pas des sites existants', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();

    const pays = page.getByLabel(/^Pays/);
    // Le référentiel en porte deux cent quarante-neuf. Le seuil est bas à
    // dessein : il distingue le référentiel d'une liste tirée des sites de
    // référence, sans figer un nombre que la base des fuseaux fera bouger.
    expect(await pays.locator('option').count()).toBeGreaterThan(100);
    await expect(pays.locator('option', { hasText: /^France$/ })).toHaveCount(1);
    await expect(pays.locator('option', { hasText: /^Côte d’Ivoire$/ })).toHaveCount(1);
  });

  /**
   * M1 (partie M) — « valeurs issues de `country.timezones`, pré-rempli quand
   * le pays n'en compte qu'un ».
   */
  test('le fuseau se pré-remplit quand le pays n’en compte qu’un', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();

    const fuseau = page.getByLabel(/Fuseau horaire/);
    await expect(fuseau).toHaveValue('');

    await page.getByLabel(/^Pays/).selectOption('FR');
    await expect(fuseau).toHaveValue('Europe/Paris');
    // Et seulement les siens : la France n'ouvre pas les fuseaux du monde.
    await expect(fuseau.locator('option[value="America/New_York"]')).toHaveCount(0);
  });

  test('un pays à plusieurs fuseaux n’en choisit aucun, et les offre tous', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();

    await page.getByLabel(/^Pays/).selectOption('US');
    const fuseau = page.getByLabel(/Fuseau horaire/);
    await expect(fuseau).toHaveValue('');
    await expect(fuseau.locator('option[value="America/New_York"]')).toHaveCount(1);
    await expect(fuseau.locator('option[value="Pacific/Honolulu"]')).toHaveCount(1);
  });

  /**
   * Q5, version 7 — « Le champ n'apparaît que si l'organisation en porte au
   * moins une. À défaut, le formulaire indique où la créer, jamais un
   * sélecteur vide. »
   */
  test('l’entité juridique est absente, et dit où elle se crée', async ({ page }) => {
    await page.goto('/sites');
    await page.getByRole('button', { name: /^Nouveau site$/ }).click();

    await expect(page.getByLabel(/^Entité juridique/)).toHaveCount(0);
    const note = page.getByText(/Aucune entité juridique n’est enregistrée/);
    await expect(note).toBeVisible();
    await expect(note.locator('xpath=ancestor::*[@role][1]')).toHaveAttribute('role', 'status');
  });
});

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
});

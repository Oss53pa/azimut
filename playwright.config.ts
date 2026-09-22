import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * A3.1 range Playwright parmi les outils du produit : « Tests de bout en bout
 * | Playwright ». Aucune dérogation à demander (A3.3).
 *
 * Ce que cette suite porte, et que l'analyse statique ne peut pas atteindre :
 *  · F16 — « Parcours complet au clavier sur chaque écran » ;
 *  · F16 — « Rendu en niveaux de gris : aucune information perdue » ;
 *  · M8 (partie M) critères 1 à 3 — le parcours de bout en bout, au clavier
 *    seul, puis hors ligne ;
 *  · M8 (partie M) critère 4 — le chronométrage de ce parcours.
 *
 * F12 fixe la largeur minimale de poste à 1366 pixels : c'est la fenêtre
 * d'essai, et non une taille choisie au hasard.
 */
/**
 * Le navigateur d'essai.
 *
 * En intégration continue, l'action installe le Chromium qu'attend cette
 * version de Playwright, et il n'y a rien à désigner. Sur un poste qui en
 * porte déjà un — c'est le cas de l'environnement de développement — le
 * télécharger à chaque exécution demanderait le réseau pour rien.
 *
 * `CHROMIUM_PATH` désigne ce binaire. Une chaîne vide vaut « aucun » : c'est
 * la façon dont la CI neutralise le chemin par défaut, et `??` ne l'aurait pas
 * rattrapée.
 */
function chromiumLaunchOptions(): { executablePath?: string } {
  const declared = process.env['CHROMIUM_PATH'];
  if (declared === '') return {};
  const path = declared ?? DEFAULT_CHROMIUM;
  return existsSync(path) ? { executablePath: path } : {};
}

const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  // Une seule tentative : un essai qui ne passe qu'à la seconde est un essai
  // instable, et le masquer par une reprise cacherait le défaut.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4317',
    // F12 fixe la largeur minimale de poste à 1366 pixels.
    viewport: { width: 1366, height: 768 },
    ...devices['Desktop Chrome'],
    launchOptions: chromiumLaunchOptions(),
  },
  webServer: {
    /**
     * La construction précède le service.
     *
     * `preview` sert `dist/`, qu'il ne construit pas. Sans cette construction,
     * la suite s'exécutait contre le dernier paquet construit — c'est-à-dire
     * potentiellement contre du code qui n'est plus celui du dépôt, en
     * annonçant vert. Une vérification qui peut porter sur autre chose que ce
     * qu'on vérifie ne vérifie rien (A2.3).
     */
    command: 'pnpm --filter @azimut/studio build'
      + ' && pnpm --filter @azimut/studio preview --port 4317 --strictPort',
    url: 'http://127.0.0.1:4317/sites',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

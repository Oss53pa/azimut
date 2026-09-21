import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/**/*.test.ts'],
    // Les essais `*.db.test.ts` demandent une base PostgreSQL et ne tournent
    // donc pas dans `pnpm test`, qui doit passer sur un poste nu. Ils ont leur
    // commande, `pnpm test:db`, et leur mode d'emploi dans
    // `packages/db/migrations/ORDRE.md`. Ce n'est pas un test ignoré au sens
    // de A2.4 : il tourne, il est obligatoire avant d'annoncer une tâche qui
    // touche à l'écriture, et sa sortie réelle figure au rapport.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.db.test.ts'],
  },
});

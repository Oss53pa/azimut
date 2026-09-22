import { defineConfig } from 'vitest/config';

/**
 * Les essais d'intégration qui demandent une base PostgreSQL.
 *
 * Ils vérifient ce qu'aucune lecture de SQL ne montre : que le cloisonnement
 * tient en écriture, que la transaction est tout ou rien, et que l'identité ne
 * fuit pas d'une transaction à la suivante. Le préalable K4 nº 7 a prouvé que
 * ces trois points se décident à l'exécution et pas au texte.
 *
 * Mise en place : voir `packages/db/migrations/ORDRE.md`.
 * Connexion : variable d'environnement `AZIMUT_TEST_DATABASE_URL`.
 */
export default defineConfig({
  test: {
    include: ['packages/**/*.db.test.ts', 'apps/**/*.db.test.ts'],
    // Ces suites partagent une seule base : chacune amorce son décor et
    // nettoie ses lignes. Les laisser tourner en parallèle ferait effacer le
    // décor de l'une pendant que l'autre écrit, et l'échec paraîtrait venir du
    // code plutôt que de l'ordonnancement.
    fileParallelism: false,
  },
});

import { defineConfig } from 'vite';

/**
 * T-0.11 — le service de compilation, construit en un seul module Node.
 *
 * Les paquets de l'espace de travail exportent leurs sources TypeScript, et
 * leurs imports en `.js` désignent des fichiers `.ts` : Node ne sait pas les
 * charger seul. La construction les rassemble dans `dist/main.js` ; les
 * dépendances tierces (`postgres`, `drizzle-orm`) restent externes et se
 * chargent depuis `node_modules`, comme en développement.
 *
 * Aucune minification : un service se lit dans ses traces d'erreur.
 */
export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: { entryFileNames: 'main.js', format: 'es' },
    },
  },
  ssr: {
    noExternal: [/^@azimut\//],
  },
});

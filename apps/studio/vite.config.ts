import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Le bundle sort à la racine du dépôt, pas dans apps/studio.
 *
 * L'hébergeur cherche un répertoire « dist » à la racine quand il
 * n'applique pas vercel.json — réglage du tableau de bord, ou
 * répertoire racine du projet différent. Émettre là où les deux
 * conventions se rejoignent évite de dépendre d'un réglage que le
 * dépôt ne contrôle pas.
 *
 * `emptyOutDir` est explicite : vite refuse de vider un répertoire
 * situé hors du projet sans consigne claire.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});

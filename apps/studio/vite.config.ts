import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicy } from './src/app/content-security-policy.js';

/**
 * La politique de sécurité du contenu, posée dans `index.html` à la seule
 * construction : le serveur de développement injecte des scripts en ligne
 * qu'elle refuserait.
 */
function securityPolicy(apiUrl: string | undefined): Plugin {
  return {
    name: 'azimut-content-security-policy',
    apply: 'build',
    // Juste après l'encodage, avant toute ressource : une politique posée par
    // <meta> ne gouverne que ce qui la suit.
    transformIndexHtml(html) {
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) throw new Error('index.html : déclaration d’encodage introuvable');
      const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(apiUrl)}" />`;
      return html.replace(charset, `${charset}\n    ${meta}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), securityPolicy(env['VITE_AZIMUT_API_URL'])],
  };
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { securityHeadersPlugin } from './security-headers-plugin.js';

export default defineConfig(({ mode }) => {
  // Les origines que la politique de sécurité ouvre viennent de la même
  // configuration que l'application : l'API et le service d'authentification.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), securityHeadersPlugin(env)],
  };
});

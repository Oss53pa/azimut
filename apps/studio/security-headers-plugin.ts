import type { Plugin } from 'vite';
import {
  connectOrigins, headersFile, metaContentSecurityPolicy, securityHeaders,
} from './src/security/headers.js';
import type { BuildEnv } from './src/security/headers.js';

/**
 * Lot 7 de l'audit (D-8) : à la construction, la balise meta de secours en
 * tête de page et le fichier `_headers` à la racine du livrable, tirés de la
 * source unique. Le serveur de développement n'en reçoit aucun : il sert des
 * scripts en ligne pour le rechargement à chaud, qu'une politique stricte
 * refuserait.
 */
export function securityHeadersPlugin(env: BuildEnv): Plugin {
  const connect = connectOrigins(env);
  return {
    name: 'azimut-security-headers',
    apply: 'build',
    transformIndexHtml: () => [{
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: metaContentSecurityPolicy(connect) },
      injectTo: 'head-prepend',
    }],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile(securityHeaders(connect)) });
    },
  };
}

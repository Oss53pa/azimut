import { hostHeaders, securityHeaders } from './headers.js';

/**
 * Lot 7 de l'audit (D-8) : la documentation des en-têtes, tirée de la même
 * source que le fichier `_headers`, pour les serveurs courants. Elle ne fait
 * dépendre le studio d'aucun d'eux : le même livrable se sert depuis n'importe
 * quel serveur de fichiers qui sait poser des en-têtes (A3.4).
 */
const INSTANCE = 'https://<instance>';

function lines(headers: Readonly<Record<string, string>>, render: (name: string, value: string) => string): string {
  return Object.entries(headers).map(([n, v]) => render(n, v)).join('\n');
}

export function headersDocumentation(): string {
  const full = securityHeaders([INSTANCE]);
  const host = hostHeaders();
  const vercel = JSON.stringify(
    { headers: [{ source: '/(.*)', headers: Object.entries(host).map(([key, value]) => ({ key, value })) }] },
    null, 2,
  );
  return `# En-têtes HTTP du studio

Ce document est produit par \`apps/studio/src/security/headers-doc.ts\` depuis la
source unique des en-têtes (\`apps/studio/src/security/headers.ts\`). Un essai
vérifie qu'il la suit ; \`AZIMUT_WRITE_HEADERS_DOC=1 pnpm test\` le réécrit.

## Ce que la construction produit

- \`dist/_headers\` : tous les en-têtes, avec une politique de sécurité du
  contenu dont \`connect-src\` ne nomme que l'API et le service
  d'authentification déclarés à la construction (\`VITE_AZIMUT_API_URL\`,
  \`VITE_AZIMUT_AUTH_URL\`). Cloudflare et de nombreux serveurs statiques le
  lisent tel quel.
- Une balise meta \`Content-Security-Policy\` en tête de \`index.html\`, en
  secours. Une balise ne peut porter ni \`frame-ancestors\` ni la sécurité de
  transport stricte : ces deux protections n'existent que si le serveur pose
  les en-têtes ci-dessous.

Les scripts ne viennent que du site, sans \`unsafe-inline\` ni \`unsafe-eval\`.
Les polices sont servies par le studio (D-9).

## Les en-têtes

Pour une instance dont l'API et l'authentification sont servies depuis
\`${INSTANCE}\` :

\`\`\`
${lines(full, (n, v) => `${n}: ${v}`)}
\`\`\`

## nginx

\`\`\`nginx
${lines(full, (n, v) => `add_header ${n} "${v}" always;`)}
\`\`\`

## Caddy

\`\`\`caddy
header {
${lines(full, (n, v) => `  ${n} "${v}"`)}
}
\`\`\`

## Apache

\`\`\`apache
${lines(full, (n, v) => `Header always set ${n} "${v}"`)}
\`\`\`

## Vercel

\`vercel.json\` est un fichier statique, qui ne connaît pas l'instance : il porte
la part de la politique qui n'en dépend pas, et la balise meta de la page
porte le reste. Les deux politiques s'appliquent ensemble. Les réglages de
déploiement du fichier ne changent pas.

\`\`\`json
${vercel}
\`\`\`

## CORS

- **L'API de l'instance.** En installation autonome, PostgREST restreint les
  origines admises par \`server-cors-allowed-origins\` (variable
  \`PGRST_SERVER_CORS_ALLOWED_ORIGINS\`, PostgREST 12) : n'y inscrire que
  l'origine du studio. Sur un projet hébergé, le passage d'API de la
  plateforme fixe lui-même cette règle.
- **Le compilateur.** Il n'a aucun point d'entrée HTTP : il lit la file des
  travaux en base. Rien à restreindre tant qu'il n'en a pas.
`;
}

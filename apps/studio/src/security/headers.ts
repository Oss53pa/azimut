/**
 * Lot 7 de l'audit (D-8) : la source unique des en-têtes de sécurité du
 * studio.
 *
 * Elle produit, à la construction, le fichier `_headers` que lisent
 * Cloudflare et de nombreux serveurs statiques, et la balise meta de secours
 * qui porte la politique de sécurité du contenu là où le serveur ne pose aucun
 * en-tête. La documentation des serveurs courants (`docs/en-tetes-http.md`) et
 * les en-têtes de `vercel.json` en sont tirés, et un essai vérifie qu'ils la
 * suivent.
 *
 * Deux limites tiennent à la balise meta : elle ne peut porter ni
 * `frame-ancestors` ni la sécurité de transport stricte. Ces deux protections
 * n'existent que si le serveur pose des en-têtes.
 */

/** L'origine d'une URL de service, ou rien si la variable est absente ou mal formée. */
function originOf(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      ? url.origin : null;
  } catch {
    return null;
  }
}

export type BuildEnv = {
  readonly VITE_AZIMUT_API_URL?: string | undefined;
  readonly VITE_AZIMUT_AUTH_URL?: string | undefined;
};

/** Les origines que le studio joint : l'API et le service d'authentification, et elles seules. */
export function connectOrigins(env: BuildEnv): readonly string[] {
  const origins = [env.VITE_AZIMUT_API_URL, env.VITE_AZIMUT_AUTH_URL]
    .map(originOf)
    .filter((o): o is string => o !== null);
  return [...new Set(origins)].sort();
}

type Directive = readonly [string, ...string[]];

/**
 * La part de la politique qui ne dépend pas de l'instance. Elle seule entre
 * dans un fichier statique d'hébergeur : `default-src` et `connect-src` n'y
 * figurent pas, sans quoi ils interdiraient l'API dont l'adresse n'est connue
 * qu'à la construction.
 */
const HOST_DIRECTIVES: readonly Directive[] = [
  ['script-src', "'self'"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['frame-ancestors', "'none'"],
];

/**
 * La politique complète. Les scripts ne viennent que du site, sans
 * `unsafe-inline` ni `unsafe-eval`. Les styles admettent les attributs en
 * ligne : les SVG des moteurs portent leur présentation en attribut `style`,
 * après passage par la liste blanche (lot 6). Les images admettent `data:`
 * (code du second facteur) et `blob:` (fond de plan lu en local).
 */
function fullDirectives(connect: readonly string[]): readonly Directive[] {
  return [
    ['default-src', "'self'"],
    ['script-src', "'self'"],
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'blob:'],
    ['font-src', "'self'"],
    ['connect-src', "'self'", ...connect],
    ['worker-src', "'self'"],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
    ['upgrade-insecure-requests'],
  ];
}

function render(directives: readonly Directive[]): string {
  return directives.map(d => d.join(' ')).join('; ');
}

/** La politique complète, pour l'en-tête. */
export function contentSecurityPolicy(connect: readonly string[]): string {
  return render(fullDirectives(connect));
}

/** La politique de la balise meta : sans ce qu'une balise ne peut pas porter. */
export function metaContentSecurityPolicy(connect: readonly string[]): string {
  return render(fullDirectives(connect).filter(([name]) => name !== 'frame-ancestors'));
}

const COMMON_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Les en-têtes complets, pour `_headers` et les serveurs documentés. */
export function securityHeaders(connect: readonly string[]): Readonly<Record<string, string>> {
  return { 'Content-Security-Policy': contentSecurityPolicy(connect), ...COMMON_HEADERS };
}

/** Les en-têtes d'un fichier statique d'hébergeur, qui ne connaît pas l'instance. */
export function hostHeaders(): Readonly<Record<string, string>> {
  return { 'Content-Security-Policy': render(HOST_DIRECTIVES), ...COMMON_HEADERS };
}

/** Le fichier `_headers` : une règle pour toutes les adresses. */
export function headersFile(headers: Readonly<Record<string, string>>): string {
  return ['/*', ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`), ''].join('\n');
}

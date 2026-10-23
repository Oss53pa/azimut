/**
 * Politique de sécurité du contenu du studio construit.
 *
 * Posée dans `index.html` par une balise `<meta>` au moment de la
 * construction (`vite.config.ts`), et non par un en-tête d'hébergeur : le même
 * `dist/` se sert depuis Cloudflare, Vercel ou n'importe quel serveur de
 * fichiers (A3.4), et la politique voyage avec lui. Ce qu'une balise `<meta>`
 * ne sait pas porter — `frame-ancestors` notamment — est dans
 * `public/_headers`, que les hébergeurs qui le lisent appliquent en plus.
 *
 * Aucun script en ligne, aucune évaluation de code : `script-src 'self'`.
 * Les attributs `style` de React restent permis (`style-src-attr`), les
 * éléments `<style>` non. Les seules origines extérieures sont l'API de
 * données, si elle est configurée, et la police à chasse fixe servie par
 * Google Fonts tant qu'elle n'est pas hébergée avec les autres.
 */

/** L'origine seule de l'URL de l'API, ou une erreur : une politique ne se construit pas sur une URL douteuse. */
function apiOrigin(apiUrl: string): string {
  const parsed = new URL(apiUrl);
  if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(`VITE_AZIMUT_API_URL doit être en https : ${apiUrl}`);
  }
  return parsed.origin;
}

export function contentSecurityPolicy(apiUrl: string | undefined): string {
  const connect = ["'self'"];
  if (apiUrl !== undefined && apiUrl.trim() !== '') connect.push(apiOrigin(apiUrl.trim()));
  const directives: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'"]],
    ['style-src', ["'self'", 'https://fonts.googleapis.com']],
    ['style-src-attr', ["'unsafe-inline'"]],
    ['font-src', ["'self'", 'https://fonts.gstatic.com']],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['connect-src', connect],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}

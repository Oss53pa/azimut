/**
 * F15 — `app/`, « composition des écrans, routage ».
 *
 * Les cinq chemins sont ceux que la partie M donne, mot pour mot. Aucun
 * routeur tiers : A3.3 n'en préautorise aucun, et cinq chemins n'en demandent
 * pas.
 *
 * Le module est pur — il ne lit ni `location` ni `history` — pour que
 * l'analyse d'un chemin s'éprouve sans navigateur.
 */

/** Les cinq écrans de la tranche, par leur chemin (partie M). */
export const M_ROUTES = [
  { screen: 'sites', pattern: '/sites' },
  { screen: 'plan', pattern: '/sites/:siteId/levels/:levelId/plan' },
  { screen: 'footprints', pattern: '/sites/:siteId/levels/:levelId/footprints' },
  { screen: 'graph', pattern: '/sites/:siteId/levels/:levelId/graph' },
  { screen: 'validation', pattern: '/sites/:siteId/validation' },
] as const;

export type MScreen = (typeof M_ROUTES)[number]['screen'];

/**
 * L'écran du tableau des messages, à son chemin. R2 (partie R) :
 * « Chemin. `/sites/:siteId/wayfinding/messages` ».
 *
 * Il est à part de `M_ROUTES` parce qu'il ne vient pas de la partie M et
 * n'entre pas dans la chaîne que M8 chronomètre.
 */
export const R_ROUTE = {
  screen: 'messages',
  pattern: '/sites/:siteId/wayfinding/messages',
} as const;

export type Route =
  | { readonly screen: 'sites' }
  | { readonly screen: 'plan'; readonly siteId: string; readonly levelId: string }
  | { readonly screen: 'footprints'; readonly siteId: string; readonly levelId: string }
  | { readonly screen: 'graph'; readonly siteId: string; readonly levelId: string }
  | { readonly screen: 'validation'; readonly siteId: string }
  /** Partie R, section R2. */
  | { readonly screen: 'messages'; readonly siteId: string }
  /** Tout le reste : l'atelier existant, qui navigue par vue et non par chemin. */
  | { readonly screen: 'legacy'; readonly path: string };

/**
 * Analyse un chemin.
 *
 * L'ordre des routes compte : `/sites/:siteId/validation` et
 * `/sites/:siteId/levels/...` ne se recouvrent pas, mais `/sites` précède les
 * deux et ne doit pas les capturer. Le nombre de segments les sépare.
 */
export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(s => s.length > 0);

  if (segments.length === 1 && segments[0] === 'sites') {
    return { screen: 'sites' };
  }

  if (segments.length === 3 && segments[0] === 'sites' && segments[2] === 'validation') {
    return { screen: 'validation', siteId: decode(segments[1]) };
  }

  if (segments.length === 4 && segments[0] === 'sites'
    && segments[2] === 'wayfinding' && segments[3] === 'messages') {
    return { screen: 'messages', siteId: decode(segments[1]) };
  }

  if (segments.length === 5 && segments[0] === 'sites' && segments[2] === 'levels') {
    const tail = segments[4];
    const siteId = decode(segments[1]);
    const levelId = decode(segments[3]);
    if (tail === 'plan') return { screen: 'plan', siteId, levelId };
    if (tail === 'footprints') return { screen: 'footprints', siteId, levelId };
    if (tail === 'graph') return { screen: 'graph', siteId, levelId };
  }

  return { screen: 'legacy', path: pathname };
}

/** Le chemin d'une route. L'inverse exact de `parseRoute`. */
export function buildPath(route: Route): string {
  switch (route.screen) {
    case 'sites':
      return '/sites';
    case 'validation':
      return `/sites/${encode(route.siteId)}/validation`;
    case 'messages':
      return `/sites/${encode(route.siteId)}/wayfinding/messages`;
    case 'plan':
    case 'footprints':
    case 'graph':
      return `/sites/${encode(route.siteId)}/levels/${encode(route.levelId)}/${route.screen}`;
    case 'legacy':
      return route.path;
  }
}

/**
 * La chaîne de la tranche, dans l'ordre où M8 (partie M) critère 1 la
 * parcourt : « un
 * opérateur part d'un site vide, importe un plan, le cale, trace trois
 * cellules, pose quatre nœuds, trace les arêtes, lance la validation ».
 */
export function tranchePath(
  step: MScreen,
  siteId: string,
  levelId: string,
): string {
  switch (step) {
    case 'sites': return buildPath({ screen: 'sites' });
    case 'validation': return buildPath({ screen: 'validation', siteId });
    default: return buildPath({ screen: step, siteId, levelId });
  }
}

/** L'ordre de la chaîne, que le parcours de M8 (partie M) suit. */
export const TRANCHE_ORDER: readonly MScreen[] = [
  'sites', 'plan', 'footprints', 'graph', 'validation',
];

function decode(segment: string | undefined): string {
  return segment === undefined ? '' : decodeURIComponent(segment);
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

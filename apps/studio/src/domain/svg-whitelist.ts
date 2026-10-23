/**
 * E14.2 — réécriture d'un SVG par liste blanche.
 *
 * L'assainissement par expressions régulières retirait des motifs connus et
 * laissait passer tout le reste : un gestionnaire d'événement sans guillemets
 * (`<svg onload=…>`), collé derrière une barre (`<svg/onload=…>`), un
 * `javascript&#58;` codé en entité, un `<iframe>` que nulle liste ne nommait.
 *
 * Ici, rien n'est recopié du fichier reçu. Le texte est découpé en balises,
 * chaque balise est relue selon une grammaire stricte, et seul ce que la liste
 * blanche connaît est réécrit, valeurs réencodées. Ce qui n'est pas reconnu
 * est retiré ; ce qui ne se découpe pas est refusé en bloc. Une même entrée
 * rend toujours la même sortie (INV-4).
 */

/** Éléments réécrits tels quels, avec leurs enfants. */
const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse',
  'line', 'polyline', 'polygon', 'text', 'tspan', 'linearGradient',
  'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'marker',
]);

/** Éléments retirés mais dont les enfants sont gardés : un lien n'a pas à vivre dans un visuel. */
const UNWRAPPED = new Set(['a', 'switch']);

/** Attributs de présentation et de géométrie, seuls réécrits. */
const ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'id', 'class', 'viewBox', 'preserveAspectRatio',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'fx', 'fy', 'fr', 'd', 'points', 'transform', 'offset', 'dx', 'dy', 'rotate',
  'href', 'xlink:href', 'style',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'patternUnits', 'patternContentUnits', 'patternTransform',
  'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  ...presentationProperties(),
]);

function presentationProperties(): string[] {
  return [
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
    'stroke-dashoffset', 'opacity', 'clip-path', 'clip-rule', 'mask', 'stop-color',
    'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'letter-spacing', 'visibility', 'display',
    'vector-effect', 'marker-start', 'marker-mid', 'marker-end',
  ];
}

/** Propriétés admises dans un attribut `style`. */
const STYLE_PROPERTIES = new Set(presentationProperties());

export type Rewritten =
  | { readonly ok: true; readonly svg: string; readonly rasterFound: boolean }
  | { readonly ok: false; readonly reason: 'malformed' | 'not_svg' };

const NAME = /^[A-Za-z_][-A-Za-z0-9_.:]*/;

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (whole, body: string) => {
    if (body === 'amp') return '&';
    if (body === 'lt') return '<';
    if (body === 'gt') return '>';
    if (body === 'quot') return '"';
    if (body === 'apos') return "'";
    const code = body.startsWith('#x') ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

/** Une valeur sans schéma exécutable ni référence hors du document. */
function safeValue(decoded: string): boolean {
  // Blancs et caractères de contrôle retirés : `java\tscript:` reste `javascript:`.
  const compact = decoded.replace(/[\s\p{Cc}]/gu, '').toLowerCase();
  if (/javascript:|vbscript:|data:|expression\(|@import|\\/.test(compact)) return false;
  for (const match of compact.matchAll(/url\(/g)) {
    const after = compact.slice((match.index ?? 0) + 4).replace(/^['"]/, '');
    if (!after.startsWith('#')) return false;
  }
  return true;
}

function rewriteStyle(decoded: string): string | null {
  const kept: string[] = [];
  for (const declaration of decoded.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (STYLE_PROPERTIES.has(property) && value !== '' && safeValue(value)) {
      kept.push(`${property}:${value}`);
    }
  }
  return kept.length === 0 ? null : kept.join(';');
}

function rewriteAttribute(name: string, raw: string): string | null {
  if (!ATTRIBUTES.has(name)) return null;
  const decoded = decodeEntities(raw);
  if (name === 'href' || name === 'xlink:href') {
    return decoded.trim().startsWith('#') ? decoded.trim() : null;
  }
  if (name === 'style') return rewriteStyle(decoded);
  return safeValue(decoded) ? decoded : null;
}

type Tag = {
  readonly name: string;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
  readonly selfClosing: boolean;
  readonly end: number;
};

/** Relit une balise ouvrante à partir de `start` (sur le `<`), ou `null` si elle ne suit pas la grammaire. */
function readTag(source: string, start: number): Tag | null {
  let at = start + 1;
  const name = NAME.exec(source.slice(at))?.[0];
  if (name === undefined) return null;
  at += name.length;
  const attributes: Array<readonly [string, string]> = [];
  for (;;) {
    const spaces = /^\s*/.exec(source.slice(at))?.[0] ?? '';
    at += spaces.length;
    if (source.startsWith('/>', at)) return { name, attributes, selfClosing: true, end: at + 2 };
    if (source[at] === '>') return { name, attributes, selfClosing: false, end: at + 1 };
    // Un attribut se sépare de ce qui le précède par un blanc : `<svg/onload=…>` ne se lit pas.
    if (spaces === '') return null;
    const attribute = NAME.exec(source.slice(at))?.[0];
    if (attribute === undefined) return null;
    at += attribute.length;
    const equals = /^\s*=\s*/.exec(source.slice(at))?.[0];
    if (equals === undefined) return null;
    at += equals.length;
    const quote = source[at];
    if (quote !== '"' && quote !== "'") return null;
    const close = source.indexOf(quote, at + 1);
    if (close < 0) return null;
    attributes.push([attribute, source.slice(at + 1, close)]);
    at = close + 1;
  }
}

/**
 * Réécrit `source`. Un fichier qui ne se découpe pas est refusé, jamais
 * réparé : deviner l'intention d'un balisage cassé est la porte qu'un
 * attaquant cherche.
 */
export function rewriteSvg(source: string): Rewritten {
  const out: string[] = [];
  // `skips` : l'élément a-t-il ouvert une zone retirée, qu'il refermera ?
  const open: Array<{ readonly name: string; readonly kept: boolean; readonly skips: boolean }> = [];
  let skipping = 0;
  let rasterFound = false;
  let rootSeen = false;
  let at = 0;

  while (at < source.length) {
    const lt = source.indexOf('<', at);
    const text = source.slice(at, lt < 0 ? source.length : lt);
    if (text !== '' && skipping === 0 && open.length > 0) {
      out.push(escapeText(decodeEntities(text)));
    }
    if (lt < 0) break;
    at = lt;

    if (source.startsWith('<!--', at)) {
      const end = source.indexOf('-->', at + 4);
      if (end < 0) return { ok: false, reason: 'malformed' };
      at = end + 3;
    } else if (source.startsWith('<![CDATA[', at)) {
      const end = source.indexOf(']]>', at + 9);
      if (end < 0) return { ok: false, reason: 'malformed' };
      if (skipping === 0 && open.length > 0) out.push(escapeText(source.slice(at + 9, end)));
      at = end + 3;
    } else if (source.startsWith('<?', at)) {
      const end = source.indexOf('?>', at + 2);
      if (end < 0) return { ok: false, reason: 'malformed' };
      at = end + 2;
    } else if (source.startsWith('<!', at)) {
      // DOCTYPE, ENTITY : retirés, sous-ensemble interne compris.
      const bracket = source.indexOf('[', at);
      const firstEnd = source.indexOf('>', at);
      if (firstEnd < 0) return { ok: false, reason: 'malformed' };
      const end = bracket >= 0 && bracket < firstEnd ? source.indexOf(']>', bracket) + 1 : firstEnd;
      if (end <= 0) return { ok: false, reason: 'malformed' };
      at = end + 1;
    } else if (source.startsWith('</', at)) {
      const match = /^<\/([A-Za-z_][-A-Za-z0-9_.:]*)\s*>/.exec(source.slice(at));
      const top = open.pop();
      if (match === null || top === undefined || top.name !== match[1]) return { ok: false, reason: 'malformed' };
      if (top.skips) skipping -= 1;
      if (top.kept) out.push(`</${top.name}>`);
      at += match[0].length;
    } else {
      const tag = readTag(source, at);
      if (tag === null) return { ok: false, reason: 'malformed' };
      at = tag.end;
      if (!rootSeen) {
        if (tag.name !== 'svg') return { ok: false, reason: 'not_svg' };
        rootSeen = true;
      } else if (open.length === 0) {
        return { ok: false, reason: 'malformed' };
      }
      if (tag.name === 'image') rasterFound = true;
      const kept = skipping === 0 && ELEMENTS.has(tag.name);
      if (kept) {
        const attributes = tag.attributes
          .map(([name, raw]) => [name, rewriteAttribute(name, raw)] as const)
          .filter((pair): pair is readonly [string, string] => pair[1] !== null)
          .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
          .join('');
        out.push(`<${tag.name}${attributes}${tag.selfClosing ? '/>' : '>'}`);
      }
      if (!tag.selfClosing) {
        const unwrapped = skipping === 0 && UNWRAPPED.has(tag.name);
        const skips = !kept && !unwrapped;
        open.push({ name: tag.name, kept, skips });
        if (skips) skipping += 1;
      }
    }
  }

  if (open.length > 0 || !rootSeen) return { ok: false, reason: rootSeen ? 'malformed' : 'not_svg' };
  return { ok: true, svg: out.join(''), rasterFound };
}

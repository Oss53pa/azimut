/**
 * Lot 5 de l'audit (décision D-7) : le découpage d'un document SVG en jetons.
 *
 * Écrit dans le dépôt, sans bibliothèque. Il ne cherche pas à lire tout XML :
 * il reconnaît la forme qu'un SVG propre emploie, et signale tout le reste,
 * que l'analyseur refuse. Une déclaration de type de document, une entité
 * déclarée, une section CDATA, une instruction de traitement autre que la
 * déclaration XML de tête sont des jetons à part : l'analyseur les voit et
 * les refuse, au lieu qu'ils passent pour du texte.
 *
 * Pur et déterministe : ni horloge, ni état global.
 */

export type SvgAttribute = { readonly name: string; readonly raw: string };

export type SvgToken =
  | { readonly kind: 'open'; readonly name: string; readonly attrs: readonly SvgAttribute[]; readonly selfClosing: boolean }
  | { readonly kind: 'close'; readonly name: string }
  | { readonly kind: 'text'; readonly raw: string }
  | { readonly kind: 'comment' }
  | { readonly kind: 'xml_declaration' }
  | { readonly kind: 'forbidden'; readonly what: 'doctype' | 'cdata' | 'processing_instruction' | 'markup_declaration' };

export type TokenizeResult =
  | { readonly ok: true; readonly tokens: readonly SvgToken[] }
  | { readonly ok: false; readonly reason: 'malformed' };

const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/;
const SPACE = /^[ \t\r\n]+/;

function parseAttributes(body: string): readonly SvgAttribute[] | null {
  const attrs: SvgAttribute[] = [];
  let rest = body;
  for (;;) {
    rest = rest.replace(SPACE, '');
    if (rest === '') return attrs;
    const name = NAME.exec(rest);
    if (name === null) return null;
    rest = rest.slice(name[0].length).replace(SPACE, '');
    if (!rest.startsWith('=')) return null;
    rest = rest.slice(1).replace(SPACE, '');
    const quote = rest[0];
    if (quote !== '"' && quote !== "'") return null;
    const end = rest.indexOf(quote, 1);
    if (end < 0) return null;
    attrs.push({ name: name[0], raw: rest.slice(1, end) });
    rest = rest.slice(end + 1);
    if (rest !== '' && !SPACE.test(rest)) return null;
  }
}

/** Le texte jusqu'au prochain `<`, ou jusqu'à la fin. */
function readText(input: string, from: number): { readonly raw: string; readonly next: number } {
  const lt = input.indexOf('<', from);
  const next = lt < 0 ? input.length : lt;
  return { raw: input.slice(from, next), next };
}

export function tokenizeSvg(input: string): TokenizeResult {
  const tokens: SvgToken[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] !== '<') {
      const text = readText(input, i);
      tokens.push({ kind: 'text', raw: text.raw });
      i = text.next;
      continue;
    }
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      if (end < 0) return { ok: false, reason: 'malformed' };
      tokens.push({ kind: 'comment' });
      i = end + 3;
      continue;
    }
    if (input.startsWith('<![CDATA[', i)) {
      tokens.push({ kind: 'forbidden', what: 'cdata' });
      return { ok: true, tokens };
    }
    if (input.startsWith('<!', i)) {
      const what = /^<!doctype/i.test(input.slice(i, i + 9)) ? 'doctype' : 'markup_declaration';
      tokens.push({ kind: 'forbidden', what });
      return { ok: true, tokens };
    }
    if (input.startsWith('<?', i)) {
      const end = input.indexOf('?>', i + 2);
      if (end < 0) return { ok: false, reason: 'malformed' };
      const head = input.slice(i + 2, end);
      const declaration = tokens.length === 0 && /^xml[ \t\r\n]/.test(head);
      tokens.push(declaration ? { kind: 'xml_declaration' } : { kind: 'forbidden', what: 'processing_instruction' });
      if (!declaration) return { ok: true, tokens };
      i = end + 2;
      continue;
    }
    const end = input.indexOf('>', i + 1);
    if (end < 0) return { ok: false, reason: 'malformed' };
    const inside = input.slice(i + 1, end);
    if (inside.startsWith('/')) {
      const name = NAME.exec(inside.slice(1));
      if (name === null || inside.slice(1 + name[0].length).trim() !== '') return { ok: false, reason: 'malformed' };
      tokens.push({ kind: 'close', name: name[0] });
    } else {
      const selfClosing = inside.endsWith('/');
      const body = selfClosing ? inside.slice(0, -1) : inside;
      const name = NAME.exec(body);
      if (name === null) return { ok: false, reason: 'malformed' };
      const attrs = parseAttributes(body.slice(name[0].length));
      if (attrs === null) return { ok: false, reason: 'malformed' };
      tokens.push({ kind: 'open', name: name[0], attrs, selfClosing });
    }
    i = end + 1;
  }
  return { ok: true, tokens };
}

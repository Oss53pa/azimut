/**
 * Lot 5 de l'audit (D-7) et E14.2 : refuser plutôt qu'assainir.
 *
 * Le document est découpé en jetons, chaque élément et chaque attribut passe
 * par la liste blanche, et la sortie est **reconstruite** à partir de ce qui
 * a été gardé, valeurs ré-échappées. Rien de l'entrée ne passe tel quel : une
 * astuce d'écriture que l'analyseur n'aurait pas prévue ne survit pas à la
 * reconstruction.
 *
 * Les bornes (taille, nombre d'éléments, profondeur) sont des paramètres :
 * aucune n'est écrite ici. Absentes, elles ne bornent rien ; l'appelant les lit
 * dans la configuration (D-5).
 */
import { escapeXmlAttr, escapeXmlText } from '../xml-escape.js';
import { tokenizeSvg } from './svg-tokenize.js';
import type { SvgAttribute } from './svg-tokenize.js';
import {
  ANIMATED_PROPERTIES, REFERENCE_ATTRIBUTES, STYLE_PROPERTIES, attributeVerdict, elementVerdict,
} from './svg-allowlist.js';
import type { SvgProfile } from './svg-allowlist.js';

export type SvgLimits = {
  readonly maxBytes?: number | undefined;
  readonly maxElements?: number | undefined;
  readonly maxDepth?: number | undefined;
};

export type SvgRefusal =
  | 'malformed' | 'too_large' | 'too_complex' | 'too_deep' | 'doctype' | 'cdata'
  | 'processing_instruction' | 'markup_declaration' | 'entity' | 'element' | 'attribute'
  | 'value' | 'unbalanced' | 'not_svg';

export type SvgValidation =
  | { readonly ok: true; readonly svg: string; readonly elements: number }
  | { readonly ok: false; readonly reason: SvgRefusal; readonly detail: string };

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Décode les cinq entités prédéfinies et les références numériques ; `null` sur toute autre entité. */
function decode(raw: string): string | null {
  let failed = false;
  const out = raw.replace(/&([^;\s&]*);?/g, (match, body: string) => {
    if (!match.endsWith(';')) { failed = true; return ''; }
    if (body in NAMED) return NAMED[body] ?? '';
    const hex = /^#x([0-9a-fA-F]{1,6})$/.exec(body);
    const dec = /^#([0-9]{1,7})$/.exec(body);
    const code = hex !== null ? parseInt(hex[1] ?? '', 16) : dec !== null ? parseInt(dec[1] ?? '', 10) : NaN;
    if (!Number.isFinite(code) || code > 0x10ffff) { failed = true; return ''; }
    return String.fromCodePoint(code);
  });
  return failed ? null : out;
}

/** La valeur, débarrassée des blancs et des caractères de contrôle, pour y chercher un schéma d'URL. */
function squeezed(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x20 && (code < 0x7f || code > 0x9f)) out += ch;
  }
  return out.toLowerCase();
}

const DANGEROUS_SCHEMES = /(?:javascript|vbscript|data|livescript):/;
const LOCAL_REFERENCE = /^#[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Une valeur ordinaire : aucun schéma d'URL, aucune `url(…)` autre qu'un renvoi interne. */
function valueIsSafe(value: string): boolean {
  const flat = squeezed(value);
  if (DANGEROUS_SCHEMES.test(flat) || flat.includes('expression(') || flat.includes('@import')) return false;
  if (/[\\]/.test(value)) return false;
  for (const m of flat.matchAll(/url\(([^)]*)\)/g)) {
    if (!LOCAL_REFERENCE.test((m[1] ?? '').replace(/^["']|["']$/g, ''))) return false;
  }
  return !/url\(/.test(flat.replace(/url\([^)]*\)/g, ''));
}

/** Un attribut `style`, réécrit propriété par propriété, ou `null` s'il en porte une interdite. */
function cleanStyle(value: string): string | null {
  const parts: string[] = [];
  for (const declaration of value.split(';')) {
    if (declaration.trim() === '') continue;
    const colon = declaration.indexOf(':');
    if (colon < 0) return null;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const v = declaration.slice(colon + 1).trim();
    if (!STYLE_PROPERTIES.has(property) || !valueIsSafe(v)) return null;
    parts.push(`${property}:${v}`);
  }
  return parts.join(';');
}

type Cleaned = { readonly keep: string | null } | 'attribute' | 'refuse';

function cleanAttribute(profile: SvgProfile, element: string, attr: SvgAttribute): Cleaned {
  const verdict = attributeVerdict(profile, attr.name);
  if (verdict === 'strip') return { keep: null };
  if (verdict === 'refuse') return 'attribute';
  const value = decode(attr.raw);
  if (value === null) return 'refuse';
  if (REFERENCE_ATTRIBUTES.has(attr.name)) {
    return LOCAL_REFERENCE.test(value.trim()) ? { keep: value.trim() } : 'refuse';
  }
  if (attr.name === 'attributeName' && !ANIMATED_PROPERTIES.has(value)) return 'refuse';
  if ((element === 'animate' || element === 'set') && attr.name === 'attributeName') return { keep: value };
  if (attr.name === 'style') {
    const style = cleanStyle(value);
    return style === null ? 'refuse' : { keep: style };
  }
  return valueIsSafe(value) ? { keep: value } : 'refuse';
}

function refuse(reason: SvgRefusal, detail: string): SvgValidation {
  return { ok: false, reason, detail };
}

export function validateSvg(input: string, profile: SvgProfile, limits: SvgLimits = {}): SvgValidation {
  if (limits.maxBytes !== undefined && new TextEncoder().encode(input).length > limits.maxBytes) {
    return refuse('too_large', String(limits.maxBytes));
  }
  const tokenized = tokenizeSvg(input);
  if (!tokenized.ok) return refuse('malformed', '');

  const out: string[] = [];
  const open: string[] = [];
  let stripping = 0;
  let elements = 0;
  let sawRoot = false;
  for (const token of tokenized.tokens) {
    switch (token.kind) {
      case 'forbidden':
        return refuse(token.what, '');
      case 'comment':
      case 'xml_declaration':
        continue;
      case 'text': {
        const text = decode(token.raw);
        if (text === null) return refuse('entity', '');
        if (stripping > 0) continue;
        if (open.length === 0) {
          if (text.trim() !== '') return refuse('not_svg', 'texte hors élément');
          continue;
        }
        out.push(escapeXmlText(text));
        continue;
      }
      case 'close': {
        if (open.at(-1) !== token.name) return refuse('unbalanced', token.name);
        open.pop();
        if (stripping > 0) { stripping -= 1; continue; }
        out.push(`</${token.name}>`);
        continue;
      }
      case 'open': {
        if (open.length === 0) {
          if (sawRoot || token.name !== 'svg') return refuse('not_svg', token.name);
          sawRoot = true;
        }
        const verdict = elementVerdict(profile, token.name);
        if (verdict === 'refuse' && stripping === 0) return refuse('element', token.name);
        if (!token.selfClosing) open.push(token.name);
        if (limits.maxDepth !== undefined && open.length > limits.maxDepth) return refuse('too_deep', String(limits.maxDepth));
        if (stripping > 0 || verdict === 'strip') {
          if (!token.selfClosing) stripping += 1;
          continue;
        }
        elements += 1;
        if (limits.maxElements !== undefined && elements > limits.maxElements) {
          return refuse('too_complex', String(limits.maxElements));
        }
        const attrs: string[] = [];
        for (const attr of token.attrs) {
          const cleaned = cleanAttribute(profile, token.name, attr);
          if (cleaned === 'attribute' || cleaned === 'refuse') {
            return refuse(cleaned === 'attribute' ? 'attribute' : 'value', `${token.name}@${attr.name}`);
          }
          if (cleaned.keep !== null) attrs.push(` ${attr.name}="${escapeXmlAttr(cleaned.keep)}"`);
        }
        out.push(`<${token.name}${attrs.join('')}${token.selfClosing ? '/>' : '>'}`);
        continue;
      }
    }
  }
  if (open.length > 0) return refuse('unbalanced', open.at(-1) ?? '');
  if (!sawRoot) return refuse('not_svg', '');
  return { ok: true, svg: out.join(''), elements };
}

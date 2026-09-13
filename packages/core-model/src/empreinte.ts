import { roundSvg } from './round.js';
import { sha256Hex } from './hash.js';

/**
 * T-2.14a §4 — Canonical serialization for the content empreinte. Fully
 * specified, nothing to choose. This is a distinct serializer from
 * `canonicalSerialize` (which several engines already hash with and must not
 * change): it omits absent/null fields instead of emitting `null`, normalizes
 * strings to NFC, and formats numbers in fixed notation. Used by both the
 * content empreinte and, when they choose to, any other empreinte — the only
 * code the two are allowed to share (§3.3).
 *
 * §4 rules, in order:
 *  1. JSON, UTF-8, no whitespace, no newline.
 *  2. Object keys sorted by code point.
 *  3. Absent field omitted — never `null`, never `""` as a stand-in. Equivalent
 *     states produce the same string (a key whose value is null/undefined is
 *     dropped, so absence and null are indistinguishable).
 *  4. Business-ordered arrays keep their order; unordered sets are sorted by id
 *     upstream (the builder, not here).
 *  5. Numbers in fixed notation, never exponential; integers as integers, other
 *     decimals rounded to three places by the single rounding function.
 *  6. Negative zero is emitted as zero.
 *  7. Strings normalized to NFC before serialization (so equivalent Unicode
 *     encodings of an accented label produce one empreinte).
 *  8. Booleans as `true`/`false`.
 */

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('empreinte: non-finite number is not serializable');
  }
  if (Number.isInteger(value)) {
    // -0 → 0; integers in the domain never reach exponential notation.
    const i = value === 0 ? 0 : value;
    const s = String(i);
    if (s.includes('e') || s.includes('E')) {
      throw new Error('empreinte: integer too large for fixed notation');
    }
    return s;
  }
  // §4.5 — three decimals via the single rounding function; §4.6 — no -0.
  const s = String(roundSvg(value));
  if (s.includes('e') || s.includes('E')) {
    throw new Error('empreinte: number not representable in fixed notation');
  }
  return s;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/** Compare two strings by Unicode code point (§4.2), not UTF-16 code unit. */
function codePointCompare(a: string, b: string): number {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const pa = ca[i]?.codePointAt(0) ?? 0;
    const pb = cb[i]?.codePointAt(0) ?? 0;
    if (pa !== pb) return pa - pb;
  }
  return ca.length - cb.length;
}

function canon(value: unknown): string {
  if (value === null || value === undefined) {
    // §4.3 — null/undefined never appear as a value: objects omit such keys,
    // and arrays must not carry them. Reaching here is a builder error.
    throw new Error('empreinte: null/undefined must be omitted, not serialized');
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return formatNumber(value);
    case 'string':
      return JSON.stringify(value.normalize('NFC'));
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map(canon).join(',') + ']';
      }
      if (!isPlainObject(value)) {
        // A Date, Map, Set or class instance would collapse to '{}' and hide a
        // real content difference — refuse it instead (§4 determinism).
        throw new Error('empreinte: only plain objects are serializable');
      }
      const obj = value as Record<string, unknown>;
      // §4.2/§4.7 — keys normalized to NFC then sorted by code point; a key
      // whose value is null/undefined is omitted (§4.3).
      const entries = Object.keys(obj)
        .filter((k) => obj[k] !== null && obj[k] !== undefined)
        .map((k) => ({ key: k.normalize('NFC'), original: k }))
        .sort((x, y) => codePointCompare(x.key, y.key));
      const pairs = entries.map(
        (e) => JSON.stringify(e.key) + ':' + canon(obj[e.original]),
      );
      return '{' + pairs.join(',') + '}';
    }
    default:
      throw new Error(`empreinte: unserializable value of type ${typeof value}`);
  }
}

/** §4 canonical serialization of a value to a single deterministic string. */
export function canonicalContentJson(value: unknown): string {
  return canon(value);
}

/**
 * §4.9 — SHA-256 of the canonical serialization, lowercase hex, `sha256:`
 * prefixed. The empreinte of two equivalent states is byte-for-byte identical.
 */
export function empreinte(value: unknown): string {
  return `sha256:${sha256Hex(canonicalContentJson(value))}`;
}

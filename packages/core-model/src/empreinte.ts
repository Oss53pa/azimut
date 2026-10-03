import { roundSvg } from './round.js';
import { sha256Hex } from './hash.js';
import type { Finding, Outcome } from './outcome.js';

/**
 * T-2.14a §4 et D7.2 — la forme canonique, et la seule. Depuis la version 25,
 * elle vaut pour toutes les empreintes du produit : contenu d'une face,
 * entrées d'un tableau des messages, graphe d'une validation, entrées d'un
 * parcours, paquet de règles, manifeste. Aucune ne passe ailleurs.
 * `canonicalSerialize` (`./hash.ts`) n'écrit que des fichiers de données.
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

/**
 * Compare two strings by Unicode code point (§4.2), not UTF-16 code unit.
 *
 * A9 interdit la comparaison dépendante de la locale : c'est aussi ce
 * comparateur qui ordonne les ensembles avant qu'ils entrent dans une
 * empreinte (identifiants, codes), jamais une comparaison selon une langue.
 */
export function codePointCompare(a: string, b: string): number {
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
      // §4.2 / D7.2 ("clés triées") — object keys are sorted by code point and
      // serialized verbatim. They are structural identifiers (field names,
      // language codes), never free text, so they are NOT NFC-normalized: the
      // §4.7 NFC rule is justified by accented *labels*, which reach `canon` as
      // string VALUES and are normalized there. Leaving keys verbatim also keeps
      // the mapping injective — two byte-distinct keys can never merge into one
      // duplicate key. A key whose value is null/undefined is omitted (§4.3).
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== null && obj[k] !== undefined)
        .sort(codePointCompare);
      const pairs = keys.map((k) => JSON.stringify(k) + ':' + canon(obj[k]));
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

/**
 * D7.2 et D2.2 — l'empreinte, ou son refus. Toute empreinte du produit passe
 * par cette fonction : une valeur non hachable (nombre non fini, objet non
 * simple, nul dans un tableau) est refusée par `DATA.HASH_INPUT_INVALID`, au
 * lieu d'être écrite nulle ou de lever une exception hors du moteur (A7).
 */
export function empreinteOutcome(
  value: unknown,
  entity: Finding['entity'] = null,
): Outcome<string> {
  try {
    return { ok: true, value: empreinte(value), warnings: [] };
  } catch (err) {
    return {
      ok: false,
      findings: [{
        code: 'DATA.HASH_INPUT_INVALID',
        severity: 'blocking',
        entity,
        params: { detail: err instanceof Error ? err.message : String(err) },
        ruleRef: null,
      }],
    };
  }
}

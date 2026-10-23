import { z } from 'zod';

/**
 * Lot 4 de l'audit (A6.3) : un texte saisi est normalisé, puis accepté tel
 * quel ou refusé. Il n'est jamais réécrit en silence.
 *
 * La normalisation se limite aux espaces de bord et à la forme NFC : deux
 * saisies qui ne diffèrent que par là sont la même pour un lecteur. Tout le
 * reste est un refus, avec son motif :
 *
 *  - `control` : un caractère de contrôle (C0, DEL, C1), hors tabulation et
 *    fin de ligne, qui n'a pas de sens dans une donnée métier ;
 *  - `bidi` : un forçage ou un isolement de direction (U+202A à U+202E,
 *    U+2066 à U+2069), qui fait lire à l'écran autre chose que la valeur
 *    stockée. Les marques LRM, RLM et ALM restent admises : elles ne
 *    réordonnent rien ;
 *  - `line_break` : une fin de ligne ou une tabulation dans un champ d'une
 *    ligne ;
 *  - `not_nfc` : une valeur relue ou transmise qui n'est pas sous forme NFC ;
 *  - `too_short`, `too_long` : hors des bornes, comptées en caractères (points
 *    de code), comme `char_length` les compte en base.
 */
export const TEXT_FAULTS = ['control', 'bidi', 'line_break', 'not_nfc', 'too_short', 'too_long'] as const;
export type TextFault = (typeof TEXT_FAULTS)[number];

export type TextBounds = {
  readonly min: number;
  readonly max: number;
  /** Faux par défaut : un nom, un code, un libellé tiennent sur une ligne. */
  readonly multiline?: boolean;
};

/** Espaces de bord retirés, forme NFC. Rien d'autre. */
export function normalizeText(value: string): string {
  return value.trim().normalize('NFC');
}

/** Le nombre de caractères, au sens de `char_length` : des points de code. */
export function charLength(value: string): number {
  return Array.from(value).length;
}

function isControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

function isBidiOverride(code: number): boolean {
  return (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
}

/**
 * Le premier motif de refus d'un caractère de la valeur, ou null.
 *
 * Ne normalise pas : c'est le contrôle d'une valeur déjà normalisée, ou d'une
 * valeur relue qui doit l'être.
 */
export function characterFault(value: string, multiline: boolean): TextFault | null {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (isControl(code)) return 'control';
    if (isBidiOverride(code)) return 'bidi';
    if (!multiline && (code === 0x09 || code === 0x0a || code === 0x0d)) return 'line_break';
  }
  return value === value.normalize('NFC') ? null : 'not_nfc';
}

/** Le motif de refus d'une valeur déjà normalisée, bornes comprises, ou null. */
export function textFault(value: string, bounds: TextBounds): TextFault | null {
  const fault = characterFault(value, bounds.multiline ?? false);
  if (fault !== null) return fault;
  const length = charLength(value);
  if (length < bounds.min) return 'too_short';
  if (length > bounds.max) return 'too_long';
  return null;
}

/**
 * Le schéma d'un champ de texte saisi : normalise, puis refuse.
 *
 * La valeur rendue est la valeur normalisée. Le message de l'anomalie est le
 * motif (`TextFault`), que l'interface traduit.
 */
export function textInput(bounds: TextBounds): z.ZodType<string, string> {
  return z.string().transform((raw, ctx) => {
    const value = normalizeText(raw);
    const fault = textFault(value, bounds);
    if (fault !== null) {
      ctx.addIssue({ code: 'custom', message: fault, input: raw });
      return z.NEVER;
    }
    return value;
  });
}

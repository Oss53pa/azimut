/**
 * A5.8 — les lignes de l'écran « Charte » : un élément de charte par ligne,
 * quelle que soit sa table. Les valeurs sont citées en texte, jamais
 * appliquées à l'interface (F1.3).
 */
import {
  contrastRatio, relativeLuminance,
  type SiteCharter, type CharterColorEntry, type CharterTypeface, type CharterRule, type CharterLexiconEntry,
} from '@azimut/core-model';

export type CharterElement =
  | { readonly kind: 'color'; readonly id: string; readonly label: string; readonly value: string; readonly source: CharterColorEntry; readonly valid: boolean }
  | { readonly kind: 'typeface'; readonly id: string; readonly label: string; readonly value: string; readonly source: CharterTypeface; readonly valid: true }
  | { readonly kind: 'rule'; readonly id: string; readonly label: string; readonly value: string; readonly source: CharterRule; readonly valid: true }
  | { readonly kind: 'term'; readonly id: string; readonly label: string; readonly value: string; readonly source: CharterLexiconEntry; readonly valid: true };

export type CharterElementKind = CharterElement['kind'];

export const CHARTER_ELEMENT_KINDS: readonly CharterElementKind[] = ['color', 'typeface', 'rule', 'term'];

/** Paramètres JSON d'une règle, en texte stable : clés triées. */
export function formatParams(params: Readonly<Record<string, unknown>>): string {
  return Object.keys(params)
    .sort()
    .map(key => {
      const v = params[key];
      return `${key} : ${typeof v === 'string' ? v : JSON.stringify(v)}`;
    })
    .join(' · ');
}

export function charterElements(charter: SiteCharter): readonly CharterElement[] {
  return [
    ...charter.colors.map((c): CharterElement => ({
      kind: 'color', id: c.id, label: c.key, value: c.hex, source: c, valid: relativeLuminance(c.hex) !== null,
    })),
    ...charter.typefaces.map((f): CharterElement => ({
      kind: 'typeface', id: f.id, label: f.key, value: `${f.family} ${String(f.weight)}`, source: f, valid: true,
    })),
    ...charter.rules.map((r): CharterElement => ({
      kind: 'rule', id: r.id, label: r.kind, value: formatParams(r.params), source: r, valid: true,
    })),
    ...charter.lexicon.map((l): CharterElement => ({
      kind: 'term', id: l.id, label: l.term, value: l.lang, source: l, valid: true,
    })),
  ];
}

export type ColorContrast = {
  readonly key: string;
  /** Rapport WCAG à pleine précision, ou `null` si l'une des couleurs est illisible. */
  readonly ratio: number | null;
};

/**
 * Le contraste d'une couleur de la charte avec chacune des autres. Aucun
 * seuil n'est appliqué ici : il viendrait du paquet de règles (INV-5).
 */
export function colorContrasts(color: CharterColorEntry, charter: SiteCharter): readonly ColorContrast[] {
  return charter.colors
    .filter(other => other.id !== color.id)
    .map(other => ({ key: other.key, ratio: contrastRatio(color.hex, other.hex) }));
}

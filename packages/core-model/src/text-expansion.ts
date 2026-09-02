import type { Finding } from './outcome.js';

export type LongestVariantResult = {
  readonly lang: string;
  readonly text: string;
  readonly length: number;
};

export function longestVariant(
  names: Readonly<Record<string, string>>,
  activeLangs: readonly string[],
): LongestVariantResult | null {
  let best: LongestVariantResult | null = null;

  const sorted = [...activeLangs].sort();
  for (const lang of sorted) {
    const text = names[lang];
    if (text === undefined) continue;
    if (best === null || text.length > best.length) {
      best = { lang, text, length: text.length };
    }
  }

  return best;
}

export function textExpansionFindings(
  names: Readonly<Record<string, string>>,
  primaryLang: string,
  activeLangs: readonly string[],
  entityId: string,
): readonly Finding[] {
  const primaryText = names[primaryLang];
  if (primaryText === undefined) return [];

  const longest = longestVariant(names, activeLangs);
  if (!longest) return [];

  if (longest.lang !== primaryLang && longest.length > primaryText.length) {
    return [{
      code: 'LAYOUT.LANG_VARIANT_LONGER',
      severity: 'info',
      entity: { kind: 'destination', id: entityId },
      params: {
        primary_lang: primaryLang,
        longer_lang: longest.lang,
        primary_length: primaryText.length,
        longer_length: longest.length,
      },
      ruleRef: null,
    }];
  }

  return [];
}

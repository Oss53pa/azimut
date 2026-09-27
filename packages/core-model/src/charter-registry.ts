/**
 * A5.8 — la charte du site, telle que la base la porte : couleurs, caractères,
 * règles et lexique, rattachés à une charte versionnée (migration 0006).
 *
 * Comme le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à
 * part, par l'écran qui l'affiche. Les valeurs d'une charte sont des données
 * client citées en texte ; elles ne s'appliquent jamais à l'interface (F1.3),
 * et aucune ne peut toucher le registre de sécurité (INV-3).
 *
 * Les énumérés recopient les CHECK de 0006 ; un test structurel vérifie que
 * les deux listes coïncident.
 */
import type { LexiconSeverity } from './lexicon.js';

export const CHARTER_RULE_KINDS = [
  'adjacency_forbidden', 'min_logo_width', 'background_allowed', 'proportion', 'signature_usage',
] as const;
export type CharterRuleKind = (typeof CHARTER_RULE_KINDS)[number];

export const LEXICON_LANGS = ['fr', 'en'] as const;
export type LexiconLang = (typeof LEXICON_LANGS)[number];

export const LEXICON_SEVERITIES = ['forbidden', 'discouraged'] as const satisfies readonly LexiconSeverity[];

export type CharterColorEntry = {
  readonly id: string;
  readonly key: string;
  /** Tel que saisi. La base ne contraint pas sa forme ; l'écran la vérifie. */
  readonly hex: string;
  readonly usage: string;
};

export type CharterTypeface = {
  readonly id: string;
  readonly key: string;
  readonly family: string;
  readonly weight: number;
  /** Taille minimale propre à la charte, donnée client : pas un seuil normatif. */
  readonly min_size_mm: number;
};

export type CharterRule = {
  readonly id: string;
  readonly kind: CharterRuleKind;
  /** Paramètres JSON, rendus tels quels : aucun moteur ne les interprète encore. */
  readonly params: Readonly<Record<string, unknown>>;
};

export type CharterLexiconEntry = {
  readonly id: string;
  readonly lang: LexiconLang;
  readonly term: string;
  readonly severity: LexiconSeverity;
};

export type SiteCharter = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** ISO-8601, tel que la base le rend. */
  readonly created_at: string;
  readonly colors: readonly CharterColorEntry[];
  readonly typefaces: readonly CharterTypeface[];
  readonly rules: readonly CharterRule[];
  readonly lexicon: readonly CharterLexiconEntry[];
};

export type CharterRegistry = {
  /** Du plus récent au plus ancien, par date de création puis identifiant. */
  readonly charters: readonly SiteCharter[];
};

export const EMPTY_CHARTER_REGISTRY: CharterRegistry = { charters: [] };

export function isCharterRuleKind(value: string): value is CharterRuleKind {
  return (CHARTER_RULE_KINDS as readonly string[]).includes(value);
}

export function isLexiconLang(value: string): value is LexiconLang {
  return (LEXICON_LANGS as readonly string[]).includes(value);
}

export function isLexiconSeverity(value: string): value is LexiconSeverity {
  return (LEXICON_SEVERITIES as readonly string[]).includes(value);
}

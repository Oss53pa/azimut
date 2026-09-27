/**
 * A5.8 — lecture de la charte du site par l'API REST : charte, couleurs,
 * caractères, règles et lexique (migration 0006).
 *
 * Les énumérés sont restreints par les listes de `core-model`, qu'un test
 * structurel tient égales aux CHECK de la base. Une valeur hors liste ne peut
 * donc venir que d'un schéma qui a dérivé : la lecture échoue alors, plutôt
 * que d'écarter la ligne en silence.
 */
import {
  isCharterRuleKind, isLexiconLang, isLexiconSeverity,
  type CharterRegistry, type SiteCharter, type CharterColorEntry, type CharterTypeface,
  type CharterRule, type CharterLexiconEntry,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type CharterRow = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly created_at: string;
};
type ColorRow = { readonly id: string; readonly charter_id: string; readonly key: string; readonly hex: string; readonly usage: string };
type TypefaceRow = {
  readonly id: string;
  readonly charter_id: string;
  readonly key: string;
  readonly family: string;
  readonly weight: number;
  readonly min_size_mm: number | string;
};
type RuleRow = { readonly id: string; readonly charter_id: string; readonly kind: string; readonly params: unknown };
type LexiconRow = { readonly id: string; readonly charter_id: string; readonly lang: string; readonly term: string; readonly severity: string };

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function paramsOf(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw drift('charter_rule', 'params n’est pas un objet JSON');
  }
  return value as Readonly<Record<string, unknown>>;
}

function byCharter<T extends { readonly charter_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = out.get(row.charter_id);
    if (bucket === undefined) out.set(row.charter_id, [row]);
    else bucket.push(row);
  }
  return out;
}

export async function loadCharterRegistry(
  config: PostgrestConfig,
  siteId: string,
): Promise<CharterRegistry> {
  // Le site d'abord, comme pour le vocabulaire : un site masqué par le
  // cloisonnement doit se lire « inaccessible », pas « n'a pas de charte ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const charterRows = await query<CharterRow>(
    config, 'charter', `select=id,name,version,created_at&site_id=eq.${siteId}`,
  );
  const ids = charterRows.map(c => c.id);
  const [colorRows, typefaceRows, ruleRows, lexiconRows] = await Promise.all([
    queryIn<ColorRow>(config, 'charter_color', 'charter_id', ids),
    queryIn<TypefaceRow>(config, 'charter_typeface', 'charter_id', ids),
    queryIn<RuleRow>(config, 'charter_rule', 'charter_id', ids),
    queryIn<LexiconRow>(config, 'lexicon_term', 'charter_id', ids),
  ]);

  const colors = byCharter(colorRows);
  const typefaces = byCharter(typefaceRows);
  const rules = byCharter(ruleRows);
  const lexicon = byCharter(lexiconRows);

  const charters = charterRows.map((c): SiteCharter => ({
    id: c.id,
    name: c.name,
    version: c.version,
    created_at: c.created_at,
    colors: (colors.get(c.id) ?? [])
      .map((r): CharterColorEntry => ({ id: r.id, key: r.key, hex: r.hex, usage: r.usage }))
      .sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id)),
    typefaces: (typefaces.get(c.id) ?? [])
      .map((r): CharterTypeface => {
        const size = Number(r.min_size_mm);
        if (!Number.isFinite(size)) throw drift('charter_typeface', `min_size_mm « ${String(r.min_size_mm)} »`);
        return { id: r.id, key: r.key, family: r.family, weight: r.weight, min_size_mm: size };
      })
      .sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id)),
    rules: (rules.get(c.id) ?? [])
      .map((r): CharterRule => {
        if (!isCharterRuleKind(r.kind)) throw drift('charter_rule', `kind « ${r.kind} »`);
        return { id: r.id, kind: r.kind, params: paramsOf(r.params) };
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
    lexicon: (lexicon.get(c.id) ?? [])
      .map((r): CharterLexiconEntry => {
        if (!isLexiconLang(r.lang)) throw drift('lexicon_term', `lang « ${r.lang} »`);
        if (!isLexiconSeverity(r.severity)) throw drift('lexicon_term', `severity « ${r.severity} »`);
        return { id: r.id, lang: r.lang, term: r.term, severity: r.severity };
      })
      .sort((a, b) => a.lang.localeCompare(b.lang) || a.term.localeCompare(b.term) || a.id.localeCompare(b.id)),
  }));

  // Ordre stable : la plus récente d'abord, l'identifiant départage.
  charters.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  return { charters };
}

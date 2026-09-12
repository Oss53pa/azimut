import { contentHash, type Finding, type Outcome } from '@azimut/core-model';

/**
 * J6.3 — Library import provides duplicate detection: a symbol whose content is
 * already present in the library is flagged rather than silently added a second
 * time. Identity is the canonical content hash of the symbol, so two symbols
 * match when their content is identical regardless of id. This guard compares
 * each incoming symbol against the existing library and warns
 * LIBRARY.DUPLICATE_ON_IMPORT for every one already present.
 */
export type LibrarySymbol = {
  readonly id: string;
  readonly content: unknown;
};

/**
 * Guard a library import for duplicates. Returns one warning
 * LIBRARY.DUPLICATE_ON_IMPORT per incoming symbol whose content already exists
 * in the library, sorted by incoming id; the finding names the pre-existing id.
 * Always ok — a duplicate is a warning, not a block (J6.3/J8).
 */
export function guardLibraryImport(
  incoming: readonly LibrarySymbol[],
  existing: readonly LibrarySymbol[],
): Outcome<null> {
  // hash -> first existing id carrying that content (deterministic: sorted).
  const byHash = new Map<string, string>();
  const sortedExisting = [...existing].sort((a, b) => a.id.localeCompare(b.id));
  for (const symbol of sortedExisting) {
    const h = contentHash(symbol.content);
    if (!byHash.has(h)) byHash.set(h, symbol.id);
  }

  const warnings: Finding[] = [];
  const sortedIncoming = [...incoming].sort((a, b) => a.id.localeCompare(b.id));
  for (const symbol of sortedIncoming) {
    const existingId = byHash.get(contentHash(symbol.content));
    if (existingId !== undefined) {
      warnings.push({
        code: 'LIBRARY.DUPLICATE_ON_IMPORT',
        severity: 'warning',
        entity: { kind: 'library_symbol', id: symbol.id },
        params: { existing_id: existingId },
        ruleRef: 'J6.3',
      });
    }
  }

  return { ok: true, value: null, warnings };
}

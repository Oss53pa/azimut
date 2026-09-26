import { codePointCompare, empreinteOutcome, type Finding, type Outcome } from '@azimut/core-model';

/**
 * J6.3 — Library import provides duplicate detection: a symbol whose content is
 * already present in the library is flagged rather than silently added a second
 * time. Identity is the D7.2 empreinte of the symbol, so two symbols
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
 * A duplicate is a warning, not a block (J6.3/J8). A symbol whose content
 * cannot be hashed is refused by DATA.HASH_INPUT_INVALID (D2.2): its identity
 * would otherwise be unknown, and a duplicate would pass unseen.
 */
export function guardLibraryImport(
  incoming: readonly LibrarySymbol[],
  existing: readonly LibrarySymbol[],
): Outcome<null> {
  // hash -> first existing id carrying that content (deterministic: sorted).
  const byHash = new Map<string, string>();
  const refusals: Finding[] = [];
  const hashOf = (symbol: LibrarySymbol): string | null => {
    const h = empreinteOutcome(symbol.content, { kind: 'library_symbol', id: symbol.id });
    if (h.ok) return h.value;
    refusals.push(...h.findings);
    return null;
  };
  const sortedExisting = [...existing].sort((a, b) => codePointCompare(a.id, b.id));
  for (const symbol of sortedExisting) {
    const h = hashOf(symbol);
    if (h !== null && !byHash.has(h)) byHash.set(h, symbol.id);
  }

  const warnings: Finding[] = [];
  const sortedIncoming = [...incoming].sort((a, b) => codePointCompare(a.id, b.id));
  for (const symbol of sortedIncoming) {
    const h = hashOf(symbol);
    const existingId = h === null ? undefined : byHash.get(h);
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

  if (refusals.length > 0) return { ok: false, findings: refusals };
  return { ok: true, value: null, warnings };
}

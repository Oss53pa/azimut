import type { Finding, Outcome } from '@azimut/core-model';

/**
 * G7.2 — Reprise of a client's existing vector files. The only honest path is
 * import as a background reference: the file is converted to a calibrated image
 * the designer redraws over; it is archived and consultable but feeds no
 * calculation. There is never automatic conversion of a drawing into a
 * structured model (G7.1/G7.3) — a drawing carries no graph, categories, or
 * occupancy. Importing a vector file records an info
 * IMPORT.VECTOR_AS_REFERENCE_ONLY, making the reference-only nature explicit.
 */
export type VectorImport = {
  readonly id: string;
  readonly file_name: string;
};

/**
 * Record vector-file imports as background references only. Returns one info
 * IMPORT.VECTOR_AS_REFERENCE_ONLY per imported file, sorted by import id — the
 * file is usable as a calibrated backdrop, never as model data. Always ok.
 */
export function auditVectorImports(
  imports: readonly VectorImport[],
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...imports].sort((a, b) => a.id.localeCompare(b.id));

  for (const imported of sorted) {
    warnings.push({
      code: 'IMPORT.VECTOR_AS_REFERENCE_ONLY',
      severity: 'info',
      entity: { kind: 'vector_import', id: imported.id },
      params: { file_name: imported.file_name },
      ruleRef: 'G7.2',
    });
  }

  return { ok: true, value: null, warnings };
}

import { describe, it, expect } from 'vitest';
import { auditVectorImports, type VectorImport } from '../vector-import.js';

const imp = (id: string, file_name: string): VectorImport => ({ id, file_name });

describe('G7.2 — auditVectorImports (IMPORT.VECTOR_AS_REFERENCE_ONLY)', () => {
  it('records each vector import as a background reference', () => {
    const r = auditVectorImports([imp('v-1', 'plan.ai')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('IMPORT.VECTOR_AS_REFERENCE_ONLY');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('G7.2');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'vector_import', id: 'v-1' });
    expect(r.warnings[0]?.params['file_name']).toBe('plan.ai');
  });

  it('reports one info per import, sorted by id', () => {
    const r = auditVectorImports([
      imp('v-c', 'c.svg'),
      imp('v-a', 'a.pdf'),
      imp('v-b', 'b.eps'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['v-a', 'v-b', 'v-c']);
  });

  it('is a no-op for no imports', () => {
    const r = auditVectorImports([]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});

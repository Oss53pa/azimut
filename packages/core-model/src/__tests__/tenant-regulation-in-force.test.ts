import { describe, it, expect } from 'vitest';
import { regulationInForce, type TenantSignRegulation } from '../index.js';

function version(id: string, effective_from: string): TenantSignRegulation {
  return {
    id, effective_from, max_height_mm: null, max_overhang_mm: null,
    allowed_materials: [], allowed_lighting: [], forbidden_features: [],
  };
}

const versions = [version('v2', '2026-06-01'), version('v1', '2026-01-01')];

describe('H5 — la version du règlement en vigueur au dépôt', () => {
  it('retient la plus récente dont la date d’effet ne dépasse pas le dépôt', () => {
    expect(regulationInForce(versions, '2026-05-31')?.id).toBe('v1');
    expect(regulationInForce(versions, '2026-06-01')?.id).toBe('v2');
    expect(regulationInForce(versions, '2027-01-01')?.id).toBe('v2');
  });

  it('ne rend aucune version pour un dépôt antérieur à toutes', () => {
    expect(regulationInForce(versions, '2025-12-31')).toBeNull();
    expect(regulationInForce([], '2026-06-01')).toBeNull();
  });
});

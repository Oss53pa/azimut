import { describe, it, expect } from 'vitest';
import {
  guardSafetyRegistry,
  guardSafetyDeletion,
  guardSafetyCreation,
} from '../validate-library.js';
import { refMinimal } from '@azimut/testkit';

// Suite de validate-library.test.ts : gardes du registre de sécurité sur la
// bibliothèque (INV-3).
describe('T-1.8 INV-3 guardSafetyRegistry', () => {
  it('blocks mutation of a safety pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-fire-exit-safety',
        field: 'svg_path',
        old_value: 'M0 0L10 10',
        new_value: 'M0 0L20 20',
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const f = result.findings.find(
      (f) => f.code === 'SECURITY.REGISTRY_WRITE_DENIED',
    );
    expect(f).toBeDefined();
    expect(f?.ruleRef).toBe('INV-3');
  });

  it('allows mutation of a wayfinding pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-office-wayfinding',
        field: 'svg_path',
        old_value: 'M0 0L10 10',
        new_value: 'M0 0L20 20',
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('ignores mutation of unknown pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-unknown',
        field: 'svg_path',
        old_value: '',
        new_value: 'M0 0',
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts empty mutations array', () => {
    const result = guardSafetyRegistry(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('blocks only safety in mixed safety+wayfinding batch', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-office-wayfinding',
        field: 'svg_path',
        old_value: 'M0 0',
        new_value: 'M1 1',
      },
      {
        pictogram_id: 'picto-fire-exit-safety',
        field: 'svg_path',
        old_value: 'M0 0',
        new_value: 'M2 2',
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.entity?.id).toBe(
      'picto-fire-exit-safety',
    );
  });

  it('multiple mutations on same safety pictogram produce multiple findings', () => {
    const result = guardSafetyRegistry(refMinimal, [
      { pictogram_id: 'picto-fire-exit-safety', field: 'svg_path', old_value: 'M0 0', new_value: 'M1 1' },
      { pictogram_id: 'picto-fire-exit-safety', field: 'source', old_value: 'internal', new_value: 'external' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(2);
    const fields = result.findings.map((f) => f.params['field']);
    expect(fields).toContain('svg_path');
    expect(fields).toContain('source');
  });
});

describe('T-1.8 INV-3 guardSafetyDeletion', () => {
  it('blocks deletion of a safety pictogram', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-fire-exit-safety',
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.ruleRef).toBe('INV-3');
  });

  it('allows deletion of a wayfinding pictogram', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-office-wayfinding',
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts empty pictogram ids array', () => {
    const result = guardSafetyDeletion(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('blocks only safety in mixed safety+wayfinding deletion batch', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-office-wayfinding',
      'picto-fire-exit-safety',
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.entity?.id).toBe('picto-fire-exit-safety');
    expect(result.findings[0]?.params['operation']).toBe('delete');
  });

  it('ignores unknown pictogram ids', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-nonexistent',
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('J5.1 INV-3 guardSafetyCreation', () => {
  it('denies creating a pictogram into the safety registry', () => {
    const result = guardSafetyCreation([
      { id: 'picto-new-exit', registry: 'safety' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('SECURITY.REGISTRY_WRITE_DENIED');
    expect(result.findings[0]?.params['operation']).toBe('create');
    expect(result.findings[0]?.ruleRef).toBe('INV-3');
  });

  it('allows creating a wayfinding pictogram', () => {
    const result = guardSafetyCreation([
      { id: 'picto-new-arrow', registry: 'wayfinding' },
    ]);
    expect(result.ok).toBe(true);
  });

  it('reports one finding per safety creation, deterministically sorted', () => {
    const result = guardSafetyCreation([
      { id: 'picto-b', registry: 'safety' },
      { id: 'picto-a', registry: 'safety' },
      { id: 'picto-c', registry: 'wayfinding' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.map((f) => f.entity?.id)).toEqual(['picto-a', 'picto-b']);
  });

  it('is a no-op for an empty list', () => {
    expect(guardSafetyCreation([]).ok).toBe(true);
  });
});

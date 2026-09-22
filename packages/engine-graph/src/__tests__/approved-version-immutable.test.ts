import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refMinimal } from '@azimut/testkit';
import type { Finding, SiteData, SupportVersion } from '@azimut/core-model';

const CODE = 'DATA.APPROVED_VERSION_NOT_IMMUTABLE';

function version(
  id: string,
  overrides: Partial<SupportVersion> = {},
): SupportVersion {
  return {
    id,
    org_id: 'org-test-001',
    support_id: 'sup-1',
    version: 1,
    state: 'approved',
    content_hash: 'a'.repeat(64),
    created_at: '2026-05-01T09:00:00.000Z',
    ...overrides,
  };
}

function violations(versions: readonly SupportVersion[]): readonly Finding[] {
  const site: SiteData = { ...refMinimal, support_versions: versions };
  const result = runChecks(site);
  const findings = result.ok ? result.value.findings : result.findings;
  return findings.filter(f => f.code === CODE);
}

/**
 * N4.3 — règle M04.G7. « Une version approuvée est immuable. Une correction crée
 * une nouvelle version. »
 */
describe('G7 — immuabilité d’une version approuvée', () => {
  it('ne signale rien sur une colonne vertébrale saine', () => {
    expect(violations([
      version('sv-1', { version: 1, state: 'superseded' }),
      version('sv-2', { version: 2, state: 'approved' }),
      version('sv-3', { version: 3, state: 'draft', content_hash: 'b'.repeat(64) }),
    ])).toHaveLength(0);
  });

  it('ne signale rien quand aucune version n’existe', () => {
    expect(violations([])).toHaveLength(0);
  });

  it('signale deux versions approuvées sur le même support', () => {
    // La seconde approbation aurait dû remplacer la première.
    const found = violations([
      version('sv-1', { version: 1 }),
      version('sv-2', { version: 2 }),
    ]);
    expect(found).toHaveLength(2);
    expect(found.every(f => f.params['status'] === 'two_approved')).toBe(true);
    expect(found.every(f => f.severity === 'blocking')).toBe(true);
    expect(found[0]?.ruleRef).toBe('N4.3');
    expect(found[0]?.entity).toEqual({ kind: 'support_version', id: 'sv-1' });
  });

  it('ne confond pas deux supports', () => {
    expect(violations([
      version('sv-1', { support_id: 'sup-1' }),
      version('sv-2', { support_id: 'sup-2' }),
    ])).toHaveLength(0);
  });

  it('signale un numéro de version réécrit', () => {
    // Une correction qui réutilise le numéro est exactement ce que la seconde
    // phrase de M04.G7 interdit.
    const found = violations([
      version('sv-1', { version: 2, state: 'superseded' }),
      version('sv-2', { version: 2, state: 'draft' }),
    ]);
    expect(found).toHaveLength(2);
    expect(found.every(f => f.params['status'] === 'duplicate_number')).toBe(true);
  });

  it('signale une version approuvée sans empreinte', () => {
    // Le déclencheur de la base fige ce qui existe ; il ne fige pas une
    // absence, et une version sans empreinte ne se prouve pas intacte.
    const found = violations([version('sv-1', { content_hash: '  ' })]);
    expect(found).toHaveLength(1);
    expect(found[0]?.params['status']).toBe('hash_absent');
  });

  it('n’exige aucune empreinte d’un brouillon', () => {
    expect(violations([version('sv-1', { state: 'draft', content_hash: '' })])).toHaveLength(0);
  });

  it('rend le même verdict deux fois de suite (invariant 4)', () => {
    const versions = [version('sv-2', { version: 1 }), version('sv-1', { version: 1 })];
    expect(violations(versions)).toEqual(violations(versions));
  });

  it('déclare le contrôle dans checks_run', () => {
    const result = runChecks(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks_run).toContain('approved_version_immutable');
  });
});

import { describe, it, expect } from 'vitest';
import { assemblePackage } from '../assemble-package.js';
import { diffManifest } from '../diff-manifest.js';
import type { ArtifactInput, PackageManifest } from '../assemble-package.js';
import { refMinimal } from '@azimut/testkit';

const textEncoder = new TextEncoder();

function makeInput(overrides?: Partial<ArtifactInput>): ArtifactInput {
  return {
    id: 'art-001',
    kind: 'artwork_pdf',
    path: 'artworks/sup-001-front.pdf',
    content: textEncoder.encode('PDF content here'),
    metadata: { support_id: 'sup-001', face_side: 'front' },
    ...overrides,
  };
}

function buildManifest(inputs: readonly ArtifactInput[]): PackageManifest {
  const result = assemblePackage(
    refMinimal,
    'pkg-001',
    '2024-06-15T12:00:00Z',
    inputs,
  );
  if (!result.ok) throw new Error('assemblePackage failed');
  return result.value;
}

describe('diffManifest', () => {
  it('reports identical manifests as ok', () => {
    const inputs = [makeInput()];
    const m = buildManifest(inputs);
    const result = diffManifest(m, m);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matched_count).toBe(1);
    expect(result.value.divergent_count).toBe(0);
    expect(result.value.added_ids).toEqual([]);
    expect(result.value.removed_ids).toEqual([]);
  });

  it('detects checksum divergence', () => {
    const baseline = buildManifest([makeInput()]);
    const candidate = buildManifest([
      makeInput({ content: textEncoder.encode('DIFFERENT content') }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]?.code).toBe('PACKAGE.NON_DETERMINISTIC');
    expect(result.findings[0]?.severity).toBe('blocking');
    expect(result.findings[0]?.entity?.id).toBe('art-001');
  });

  it('reports artifacts added in candidate', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf' }),
    ]);
    const candidate = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf' }),
      makeInput({ id: 'art-2', path: 'b.pdf' }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const added = result.findings.find(
      (f) => f.entity?.id === 'art-2' && f.params['reason'] === 'added_in_candidate',
    );
    expect(added).toBeDefined();
  });

  it('reports artifacts removed in candidate', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf' }),
      makeInput({ id: 'art-2', path: 'b.pdf' }),
    ]);
    const candidate = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf' }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const removed = result.findings.find(
      (f) => f.entity?.id === 'art-2' && f.params['reason'] === 'removed_in_candidate',
    );
    expect(removed).toBeDefined();
  });

  it('handles multiple divergent artifacts', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf', content: textEncoder.encode('alpha') }),
      makeInput({ id: 'art-2', path: 'b.pdf', content: textEncoder.encode('bravo') }),
    ]);
    const candidate = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf', content: textEncoder.encode('ALPHA') }),
      makeInput({ id: 'art-2', path: 'b.pdf', content: textEncoder.encode('BRAVO') }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(2);
  });

  it('handles empty manifests', () => {
    const m = buildManifest([]);
    const result = diffManifest(m, m);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matched_count).toBe(0);
    expect(result.value.divergent_count).toBe(0);
  });

  it('findings include baseline and candidate checksums', () => {
    const baseline = buildManifest([makeInput()]);
    const candidate = buildManifest([
      makeInput({ content: textEncoder.encode('tampered') }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const f = result.findings[0];
    expect(f?.params['baseline_checksum']).toBeTruthy();
    expect(f?.params['candidate_checksum']).toBeTruthy();
    expect(f?.params['baseline_checksum']).not.toBe(f?.params['candidate_checksum']);
  });

  it('findings are sorted by artifact id', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-z', path: 'z.pdf', content: textEncoder.encode('z') }),
      makeInput({ id: 'art-a', path: 'a.pdf', content: textEncoder.encode('a') }),
    ]);
    const candidate = buildManifest([
      makeInput({ id: 'art-z', path: 'z.pdf', content: textEncoder.encode('Z') }),
      makeInput({ id: 'art-a', path: 'a.pdf', content: textEncoder.encode('A') }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const ids = result.findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('is deterministic (INV-4)', () => {
    const baseline = buildManifest([makeInput()]);
    const candidate = buildManifest([
      makeInput({ content: textEncoder.encode('other') }),
    ]);
    const r1 = diffManifest(baseline, candidate);
    const r2 = diffManifest(baseline, candidate);
    expect(r1).toStrictEqual(r2);
  });

  it('mixed scenario: one match, one divergent, one added', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf', content: textEncoder.encode('same') }),
      makeInput({ id: 'art-2', path: 'b.pdf', content: textEncoder.encode('will-change') }),
    ]);
    const candidate = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf', content: textEncoder.encode('same') }),
      makeInput({ id: 'art-2', path: 'b.pdf', content: textEncoder.encode('changed') }),
      makeInput({ id: 'art-3', path: 'c.pdf', content: textEncoder.encode('new') }),
    ]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // art-2 divergent + art-3 added = 2 findings
    expect(result.findings.length).toBe(2);
  });

  it('full baseline vs empty candidate marks all as removed', () => {
    const baseline = buildManifest([
      makeInput({ id: 'art-1', path: 'a.pdf' }),
      makeInput({ id: 'art-2', path: 'b.pdf' }),
    ]);
    const candidate = buildManifest([]);
    const result = diffManifest(baseline, candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const removedFindings = result.findings.filter(
      (f) => f.params['reason'] === 'removed_in_candidate',
    );
    expect(removedFindings).toHaveLength(2);
  });

  it('two distinct empty manifests compare as identical', () => {
    const m1 = buildManifest([]);
    const m2: typeof m1 = {
      ...m1,
      package_id: 'pkg-other',
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = diffManifest(m1, m2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matched_count).toBe(0);
    expect(result.value.divergent_count).toBe(0);
  });
});

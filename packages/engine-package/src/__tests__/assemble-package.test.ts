import { describe, it, expect } from 'vitest';
import {
  assemblePackage,
  manifestToJson,
} from '../assemble-package.js';
import type { ArtifactInput } from '../assemble-package.js';
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

describe('assemblePackage', () => {
  it('assembles a valid package from inputs', () => {
    const inputs = [makeInput()];
    const result = assemblePackage(
      refMinimal,
      'pkg-001',
      '2024-06-15T12:00:00Z',
      inputs,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.package_id).toBe('pkg-001');
    expect(result.value.site_id).toBe(refMinimal.site.id);
    expect(result.value.org_id).toBe(refMinimal.organization.id);
    expect(result.value.artifact_count).toBe(1);
    expect(result.value.total_size_bytes).toBe(16);
  });

  it('computes checksums deterministically', () => {
    const inputs = [makeInput()];
    const r1 = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    const r2 = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(r1).toStrictEqual(r2);
  });

  it('sorts artifacts by kind then id', () => {
    const inputs = [
      makeInput({ id: 'art-b', kind: 'floor_plan', path: 'plans/b.svg' }),
      makeInput({ id: 'art-a', kind: 'artwork_pdf', path: 'artworks/a.pdf' }),
      makeInput({ id: 'art-c', kind: 'artwork_pdf', path: 'artworks/c.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.artifacts.map((a) => a.id);
    expect(ids).toEqual(['art-a', 'art-c', 'art-b']);
  });

  it('rejects duplicate artifact ids', () => {
    const inputs = [
      makeInput({ id: 'art-dup', path: 'a.pdf' }),
      makeInput({ id: 'art-dup', path: 'b.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('PACKAGE.DUPLICATE_ID');
  });

  it('rejects duplicate paths', () => {
    const inputs = [
      makeInput({ id: 'art-1', path: 'same.pdf' }),
      makeInput({ id: 'art-2', path: 'same.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('PACKAGE.DUPLICATE_PATH');
  });

  it('warns on empty artifacts', () => {
    const inputs = [
      makeInput({ content: new Uint8Array(0) }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('PACKAGE.EMPTY_ARTIFACT');
  });

  it('handles empty inputs', () => {
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.artifact_count).toBe(0);
    expect(result.value.total_size_bytes).toBe(0);
  });

  it('sums total size correctly', () => {
    const inputs = [
      makeInput({
        id: 'art-1',
        path: 'a.pdf',
        content: textEncoder.encode('short'),
      }),
      makeInput({
        id: 'art-2',
        path: 'b.pdf',
        content: textEncoder.encode('a longer content string here'),
      }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_size_bytes).toBe(5 + 28);
  });

  it('three duplicate IDs produce two findings', () => {
    const inputs = [
      makeInput({ id: 'art-dup', path: 'a.pdf' }),
      makeInput({ id: 'art-dup', path: 'b.pdf' }),
      makeInput({ id: 'art-dup', path: 'c.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const dupId = result.findings.filter(
      (f) => f.code === 'PACKAGE.DUPLICATE_ID',
    );
    expect(dupId.length).toBe(2);
  });

  it('combined duplicate ID and duplicate path both reported', () => {
    const inputs = [
      makeInput({ id: 'art-dup', path: 'same.pdf' }),
      makeInput({ id: 'art-dup', path: 'same.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('PACKAGE.DUPLICATE_ID');
    expect(codes).toContain('PACKAGE.DUPLICATE_PATH');
  });

  it('blocking findings suppress warnings (empty artifact + dup ID)', () => {
    const inputs = [
      makeInput({ id: 'art-dup', path: 'a.pdf', content: new Uint8Array(0) }),
      makeInput({ id: 'art-dup', path: 'b.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Blocking return has no warnings field
    expect(result.findings[0]?.code).toBe('PACKAGE.DUPLICATE_ID');
  });

  it('metadata is isolated from input mutation', () => {
    const meta = { support_id: 'sup-001', face_side: 'front' };
    const inputs = [makeInput({ metadata: meta })];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Mutate original metadata — manifest should be unaffected
    meta['support_id'] = 'MUTATED';
    expect(result.value.artifacts[0]?.metadata['support_id']).toBe('sup-001');
  });
});

describe('manifestToJson', () => {
  it('produces valid JSON', () => {
    const inputs = [makeInput()];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = manifestToJson(result.value);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['package_id']).toBe('pkg-001');
  });

  it('outputs keys in the fixed order', () => {
    const inputs = [makeInput()];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = manifestToJson(result.value);
    const pkgIdx = json.indexOf('"package_id"');
    const artIdx = json.indexOf('"artifacts"');
    const countIdx = json.indexOf('"artifact_count"');
    expect(pkgIdx).toBeLessThan(countIdx);
    expect(countIdx).toBeLessThan(artIdx);
  });

  it('checksum has sha256- prefix and hex digest', () => {
    const inputs = [makeInput()];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const checksum = result.value.artifacts[0]?.checksum ?? '';
    expect(checksum).toMatch(/^sha256-[0-9a-f]{64}$/);
  });

  it('accumulates multiple EMPTY_ARTIFACT warnings', () => {
    const inputs = [
      makeInput({ id: 'art-e1', path: 'a.pdf', content: new Uint8Array(0) }),
      makeInput({ id: 'art-e2', path: 'b.pdf', content: new Uint8Array(0) }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emptyWarns = result.warnings.filter(
      (f) => f.code === 'PACKAGE.EMPTY_ARTIFACT',
    );
    expect(emptyWarns.length).toBe(2);
  });

  it('manifestToJson with zero artifacts produces valid JSON', () => {
    const result = assemblePackage(refMinimal, 'pkg-empty', '2024-06-15T12:00:00Z', []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = manifestToJson(result.value);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['artifact_count']).toBe(0);
    expect(parsed['artifacts']).toEqual([]);
  });

  it('is deterministic (INV-4)', () => {
    const inputs = [makeInput()];
    const r = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const j1 = manifestToJson(r.value);
    const j2 = manifestToJson(r.value);
    expect(j1).toBe(j2);
  });

  it('EMPTY_ARTIFACT warning index reflects sorted position', () => {
    const inputs = [
      makeInput({ id: 'art-z', kind: 'floor_plan', path: 'plans/z.svg', content: new Uint8Array(0) }),
      makeInput({ id: 'art-a', kind: 'artwork_pdf', path: 'artworks/a.pdf' }),
    ];
    const result = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // After sorting by kind then id: artwork_pdf (art-a) at 0, floor_plan (art-z) at 1
    const emptyWarning = result.warnings.find((w) => w.code === 'PACKAGE.EMPTY_ARTIFACT');
    expect(emptyWarning).toBeDefined();
    expect(emptyWarning?.params['index']).toBe(1);
  });
});

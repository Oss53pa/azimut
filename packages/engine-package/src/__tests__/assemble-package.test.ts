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

  it('is deterministic (INV-4)', () => {
    const inputs = [makeInput()];
    const r = assemblePackage(refMinimal, 'pkg-001', '2024-06-15T12:00:00Z', inputs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const j1 = manifestToJson(r.value);
    const j2 = manifestToJson(r.value);
    expect(j1).toBe(j2);
  });
});

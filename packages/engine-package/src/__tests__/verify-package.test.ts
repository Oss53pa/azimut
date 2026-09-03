import { describe, it, expect } from 'vitest';
import { assemblePackage } from '../assemble-package.js';
import { verifyPackage } from '../verify-package.js';
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

function buildManifestAndContents(inputs: readonly ArtifactInput[]) {
  const result = assemblePackage(
    refMinimal,
    'pkg-001',
    '2024-06-15T12:00:00Z',
    inputs,
  );
  if (!result.ok) throw new Error('assemblePackage failed');
  const contents = new Map<string, Uint8Array>();
  for (const input of inputs) {
    contents.set(input.id, input.content);
  }
  return { manifest: result.value, contents };
}

describe('verifyPackage', () => {
  it('verifies a valid package successfully', () => {
    const input = makeInput();
    const { manifest, contents } = buildManifestAndContents([input]);
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(1);
    expect(result.value.total_count).toBe(1);
  });

  it('verifies multiple artifacts', () => {
    const inputs = [
      makeInput({ id: 'art-1', path: 'a.pdf' }),
      makeInput({
        id: 'art-2',
        path: 'b.pdf',
        content: textEncoder.encode('different content'),
      }),
    ];
    const { manifest, contents } = buildManifestAndContents(inputs);
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(2);
  });

  it('detects checksum mismatch for tampered content', () => {
    const input = makeInput();
    const { manifest } = buildManifestAndContents([input]);
    const tamperedContents = new Map<string, Uint8Array>();
    tamperedContents.set('art-001', textEncoder.encode('TAMPERED content'));
    const result = verifyPackage(manifest, tamperedContents);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]?.code).toBe('PACKAGE.CHECKSUM_MISMATCH');
    expect(result.findings[0]?.severity).toBe('blocking');
    expect(result.findings[0]?.entity?.id).toBe('art-001');
  });

  it('detects missing artifact content', () => {
    const input = makeInput();
    const { manifest } = buildManifestAndContents([input]);
    const emptyContents = new Map<string, Uint8Array>();
    const result = verifyPackage(manifest, emptyContents);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('PACKAGE.CHECKSUM_MISMATCH');
    expect(result.findings[0]?.params['actual']).toBe('missing');
  });

  it('reports all mismatches, not just the first', () => {
    const inputs = [
      makeInput({ id: 'art-1', path: 'a.pdf' }),
      makeInput({ id: 'art-2', path: 'b.pdf' }),
    ];
    const { manifest } = buildManifestAndContents(inputs);
    const badContents = new Map<string, Uint8Array>();
    badContents.set('art-1', textEncoder.encode('wrong1'));
    badContents.set('art-2', textEncoder.encode('wrong2'));
    const result = verifyPackage(manifest, badContents);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(2);
  });

  it('handles empty manifest', () => {
    const { manifest, contents } = buildManifestAndContents([]);
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(0);
    expect(result.value.total_count).toBe(0);
  });

  it('findings are sorted by artifact id', () => {
    const inputs = [
      makeInput({ id: 'art-z', path: 'z.pdf' }),
      makeInput({ id: 'art-a', path: 'a.pdf' }),
    ];
    const { manifest } = buildManifestAndContents(inputs);
    const badContents = new Map<string, Uint8Array>();
    badContents.set('art-z', textEncoder.encode('tampered'));
    badContents.set('art-a', textEncoder.encode('tampered'));
    const result = verifyPackage(manifest, badContents);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const ids = result.findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('ignores extra content not in manifest', () => {
    const input = makeInput();
    const { manifest, contents } = buildManifestAndContents([input]);
    contents.set('art-extra', textEncoder.encode('extra stuff'));
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(1);
    expect(result.value.total_count).toBe(1);
  });

  it('verifies empty-content artifact', () => {
    const input = makeInput({
      id: 'art-empty',
      path: 'empty.pdf',
      content: new Uint8Array(0),
    });
    const { manifest, contents } = buildManifestAndContents([input]);
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(1);
  });

  it('detects size mismatch even when checksum matches', () => {
    const input = makeInput();
    const { manifest, contents } = buildManifestAndContents([input]);
    // Mutate manifest to have wrong size but keep correct checksum
    const badManifest = {
      ...manifest,
      artifacts: manifest.artifacts.map((a) => ({
        ...a,
        size_bytes: a.size_bytes + 999,
      })),
    };
    const result = verifyPackage(badManifest, contents);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('PACKAGE.CHECKSUM_MISMATCH');
    expect(result.findings[0]?.params['expected_size']).toBe(
      input.content.length + 999,
    );
    expect(result.findings[0]?.params['actual_size']).toBe(
      input.content.length,
    );
  });

  it('is deterministic (INV-4)', () => {
    const input = makeInput();
    const { manifest, contents } = buildManifestAndContents([input]);
    const r1 = verifyPackage(manifest, contents);
    const r2 = verifyPackage(manifest, contents);
    expect(r1).toStrictEqual(r2);
  });

  it('round-trips with assemblePackage', () => {
    const inputs = [
      makeInput({ id: 'art-1', path: 'a.pdf', content: textEncoder.encode('alpha') }),
      makeInput({ id: 'art-2', path: 'b.pdf', content: textEncoder.encode('bravo') }),
      makeInput({ id: 'art-3', kind: 'floor_plan', path: 'c.svg', content: textEncoder.encode('charlie') }),
    ];
    const { manifest, contents } = buildManifestAndContents(inputs);
    const result = verifyPackage(manifest, contents);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verified_count).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { computeFaceContentHash } from '../face-content-hash.js';
import type { FaceContentHashInput } from '../face-content-hash.js';

function base(over: Partial<FaceContentHashInput> = {}): FaceContentHashInput {
  return {
    blocks: [
      { type: 'header', site_name: 'Hôtel de ville' },
      {
        type: 'destination_list',
        entries: [{ destination_id: 'd1', names: { fr: 'Bureau', en: 'Office' }, direction: null, distance_m: 12.5 }],
      },
    ],
    template_key: 'ftpl-dir', template_version: '1',
    charter_id: 'ch-1', charter_version: '2',
    rules_pack_key: 'intl', rules_pack_version: '2026.1',
    active_langs: ['fr', 'en'],
    width_mm: 600, height_mm: 400,
    pictogram_ids: ['p2', 'p1'],
    ...over,
  };
}
function hash(over: Partial<FaceContentHashInput> = {}): string {
  const r = computeFaceContentHash(base(over));
  if (!r.ok) throw new Error(`unexpected findings: ${r.findings.map((f) => f.code).join()}`);
  return r.value;
}

// Inputs that OMIT an optional field (exactOptionalPropertyTypes forbids
// setting it to undefined explicitly), built from the base fields.
function baseWithout(omit: 'charter' | 'rules_pack'): FaceContentHashInput {
  const b = base();
  return {
    blocks: b.blocks,
    template_key: b.template_key, template_version: b.template_version,
    ...(omit === 'charter' ? {} : { charter_id: b.charter_id, charter_version: b.charter_version }),
    ...(omit === 'rules_pack' ? {} : { rules_pack_key: b.rules_pack_key, rules_pack_version: b.rules_pack_version }),
    active_langs: b.active_langs, width_mm: b.width_mm, height_mm: b.height_mm,
    pictogram_ids: b.pictogram_ids,
  };
}

describe('computeFaceContentHash — determinism & order (§6.1, §6.2)', () => {
  it('is deterministic byte-for-byte', () => {
    expect(hash()).toBe(hash());
    expect(hash()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is independent of pictogram insertion order', () => {
    expect(hash({ pictogram_ids: ['p1', 'p2'] })).toBe(hash({ pictogram_ids: ['p2', 'p1'] }));
  });

  it('is independent of active-language order', () => {
    expect(hash({ active_langs: ['fr', 'en'] })).toBe(hash({ active_langs: ['en', 'fr'] }));
  });
});

describe('computeFaceContentHash — sensitivity (§6.4)', () => {
  const b = hash();
  it('block content', () => {
    expect(hash({ blocks: [{ type: 'header', site_name: 'Autre' }] })).not.toBe(b);
  });
  it('template version', () => expect(hash({ template_version: '2' })).not.toBe(b));
  it('charter version', () => expect(hash({ charter_version: '3' })).not.toBe(b));
  it('rules pack version', () => expect(hash({ rules_pack_version: '2026.2' })).not.toBe(b));
  it('active language added', () => expect(hash({ active_langs: ['fr', 'en', 'de'] })).not.toBe(b));
  it('computed dimension', () => expect(hash({ width_mm: 601 })).not.toBe(b));
  it('a referenced pictogram', () => expect(hash({ pictogram_ids: ['p1', 'p3'] })).not.toBe(b));
});

describe('computeFaceContentHash — absence vs null & NFC (§6.5, §6.6)', () => {
  it('hashes a face with no charter consistently, and a charter changes it', () => {
    const a = computeFaceContentHash(baseWithout('charter'));
    const b = computeFaceContentHash(baseWithout('charter'));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value).toBe(b.value);
    // A face WITH a charter produces a different empreinte.
    if (a.ok) expect(a.value).not.toBe(hash());
  });

  it('a block field absent and the same field null hash identically', () => {
    const absent = hash({ blocks: [{ type: 'header', site_name: 'X' }] });
    const withNull = hash({ blocks: [{ type: 'header', site_name: 'X', subtitle: null }] });
    expect(absent).toBe(withNull);
  });

  it('two Unicode-equivalent accented labels hash identically', () => {
    const composed = hash({ blocks: [{ type: 'header', site_name: 'Créche' }] });
    const decomposed = hash({ blocks: [{ type: 'header', site_name: 'Créche' }] });
    expect(composed).toBe(decomposed);
  });
});

describe('computeFaceContentHash — edge cases (§8)', () => {
  it('hashes a face with no blocks', () => {
    expect(computeFaceContentHash(base({ blocks: [] })).ok).toBe(true);
  });

  it('hashes a face whose blocks are all empty', () => {
    expect(computeFaceContentHash(base({ blocks: [{}, {}] })).ok).toBe(true);
  });

  it('hashes a single-language face while the site declares two', () => {
    expect(computeFaceContentHash(base({ active_langs: ['fr'] })).ok).toBe(true);
  });

  it('handles a long accented label with apostrophes and non-breaking spaces', () => {
    const label = 'Service d’oto-rhino-laryngologie et chirurgie cervico-faciale — aile C';
    expect(computeFaceContentHash(base({ blocks: [{ type: 'header', site_name: label }] })).ok).toBe(true);
  });

  it('refuses (blocking) when a dimension is null, zero or negative', () => {
    for (const dims of [{ width_mm: null }, { width_mm: 0 }, { height_mm: -5 }] as const) {
      const r = computeFaceContentHash(base(dims));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings[0]?.code).toBe('DATA.FACE_DIMENSIONS_INVALID');
    }
  });

  it('refuses (blocking RULES.PACK_NOT_BOUND) when the rules pack is absent', () => {
    const r = computeFaceContentHash(baseWithout('rules_pack'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]?.code).toBe('RULES.PACK_NOT_BOUND');
  });

  it('two faces of one support, identical content, different templates → different empreintes', () => {
    expect(hash({ template_key: 'ftpl-a' })).not.toBe(hash({ template_key: 'ftpl-b' }));
  });

  it('everything identical hashes the same (support id is not an input, so excluded §3.2)', () => {
    // The input carries no support id, face id, timestamp, author, version or
    // state — they cannot affect the empreinte. Two identical inputs match.
    expect(hash()).toBe(hash());
  });
});

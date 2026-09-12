import { describe, it, expect } from 'vitest';
import { guardFontEmbedding } from '../font-embedding.js';
import type { FontAsset } from '../font-embedding.js';

function font(over: Partial<FontAsset> = {}): FontAsset {
  return {
    id: 'f-plex',
    family: 'IBM Plex Sans',
    style: 'regular',
    weight: 400,
    embeddable: true,
    licence_kind: 'open',
    licence_ref: 'OFL-1.1',
    ...over,
  };
}

describe('G5.2 — guardFontEmbedding', () => {
  it('allows any font for screen preview, including unknown licence', () => {
    const r = guardFontEmbedding(
      [font({ licence_kind: 'unknown', embeddable: false, licence_ref: null })],
      'screen_preview',
    );
    expect(r.ok).toBe(true);
  });

  it('allows an embeddable, licensed font in a distributed deliverable', () => {
    expect(guardFontEmbedding([font()], 'distributed').ok).toBe(true);
  });

  it('denies an unknown-licence font in a distributed deliverable', () => {
    const r = guardFontEmbedding([font({ licence_kind: 'unknown' })], 'distributed');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('TYPO.FONT_NOT_EMBEDDABLE');
    expect(r.findings[0]?.params['reason']).toBe('licence_unknown');
    expect(r.findings[0]?.ruleRef).toBe('G5.2');
  });

  it('denies a non-embeddable font', () => {
    const r = guardFontEmbedding([font({ embeddable: false })], 'distributed');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['reason']).toBe('not_embeddable');
  });

  it('a kiosk package requires a licence reference', () => {
    const ok = guardFontEmbedding([font()], 'kiosk_package');
    expect(ok.ok).toBe(true);
    const bad = guardFontEmbedding([font({ licence_ref: '  ' })], 'kiosk_package');
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.findings[0]?.params['reason']).toBe('licence_ref_missing');
  });

  it('a distributed deliverable does not require a licence reference', () => {
    // licence known + embeddable is enough for a non-kiosk deliverable.
    expect(guardFontEmbedding([font({ licence_ref: null })], 'distributed').ok).toBe(true);
  });

  it('reports one finding per offending font, sorted by id, others pass', () => {
    const r = guardFontEmbedding(
      [
        font({ id: 'f-b', licence_kind: 'unknown' }),
        font({ id: 'f-a', embeddable: false }),
        font({ id: 'f-c' }),
      ],
      'distributed',
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['f-a', 'f-b']);
  });

  it('is a no-op for an empty font list', () => {
    expect(guardFontEmbedding([], 'kiosk_package').ok).toBe(true);
  });
});

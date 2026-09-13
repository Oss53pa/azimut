import { describe, it, expect } from 'vitest';
import { guardFontMetrics, auditFontLicences } from '../font-registry.js';
import type { FontMetricsRecord } from '../font-registry.js';
import type { FontAsset } from '../font-embedding.js';

const rec = (
  font_id: string,
  present: boolean,
  declared_hash: string | null,
  actual_hash: string | null,
): FontMetricsRecord => ({ font_id, present, declared_hash, actual_hash });

describe('G5.1 — guardFontMetrics (FONT.METRICS_MISSING)', () => {
  it('passes when the metrics table is present and its hash matches', () => {
    expect(guardFontMetrics([rec('f-1', true, 'abc', 'abc')]).ok).toBe(true);
  });

  it('blocks an absent metrics table', () => {
    const r = guardFontMetrics([rec('f-1', false, null, null)]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('FONT.METRICS_MISSING');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('G5.1');
    expect(r.findings[0]?.params['reason']).toBe('absent');
    expect(r.findings[0]?.entity).toEqual({ kind: 'font', id: 'f-1' });
  });

  it('blocks an altered metrics table (hash mismatch)', () => {
    const r = guardFontMetrics([rec('f-1', true, 'abc', 'xyz')]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['reason']).toBe('altered');
  });

  it('treats a null hash as absent', () => {
    const r = guardFontMetrics([rec('f-1', true, 'abc', null)]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['reason']).toBe('absent');
  });

  it('reports one finding per bad record, sorted by font id', () => {
    const r = guardFontMetrics([
      rec('f-c', false, null, null),
      rec('f-a', true, 'h', 'h'),
      rec('f-b', true, 'h', 'other'),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['f-b', 'f-c']);
  });
});

const font = (id: string, licence_kind: FontAsset['licence_kind']): FontAsset => ({
  id,
  family: 'Inter',
  style: 'regular',
  weight: 400,
  embeddable: true,
  licence_kind,
  licence_ref: null,
});

describe('G5.2 — auditFontLicences (FONT.LICENCE_UNKNOWN)', () => {
  it('reports nothing when every licence is declared', () => {
    const r = auditFontLicences([font('f-1', 'open'), font('f-2', 'purchased')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns per font with an undeclared licence', () => {
    const r = auditFontLicences([font('f-1', 'unknown')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('FONT.LICENCE_UNKNOWN');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('G5.2');
  });

  it('reports unknown-licence fonts sorted by id', () => {
    const r = auditFontLicences([
      font('f-c', 'unknown'),
      font('f-a', 'open'),
      font('f-b', 'unknown'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['f-b', 'f-c']);
  });
});

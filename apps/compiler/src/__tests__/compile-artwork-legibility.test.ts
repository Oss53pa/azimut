import { describe, it, expect } from 'vitest';
import { createArtworkHandler } from '../compile-artwork.js';
import type { CompileContext } from '../compile-artwork.js';
import { refMultilevel } from '@azimut/testkit';
import { buildRulesPackIndex } from '@azimut/rules/loader';
import { context, makeJob } from './compile-artwork-fixtures.js';

// Suite de compile-artwork.test.ts : lisibilité et encombrement.
describe('T-2.12 createArtworkHandler', () => {
  describe('legibility scoped by support context (A5.6 / D3.5)', () => {
    const PACK_ID = 'rp-test-0001';
    const index = (() => {
      const built = buildRulesPackIndex(
        [{ id: PACK_ID, directory: 'packages/testkit/fixtures/rules-packs/test-fixture' }],
        { environment: 'test' },
      );
      if (!built.ok) throw new Error('index non constructible');
      return built.value;
    })();

    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    // A taller face lifts the rendered text to ~40 mm — above the interior
    // requirement (35) but below the exterior one (47), so the reading context
    // alone decides the verdict.
    function tallFaceSite(ctx: 'interior' | 'exterior'): typeof refMultilevel {
      return {
        ...refMultilevel,
        site: { ...refMultilevel.site, rules_pack_id: PACK_ID },
        support_types: refMultilevel.support_types.map((st) => ({
          ...st,
          faces: st.faces.map((f) => ({ ...f, default_height_mm: 560 })),
        })),
        supports: refMultilevel.supports.map((s) =>
          s.id === 'sup-001' ? { ...s, context: ctx } : s,
        ),
      };
    }

    it('runs no legibility check when no pack is bound', async () => {
      const result = await createArtworkHandler(context)(job);
      expect(result['legibility_finding_count']).toBe(0);
    });

    it('flags text below the interior minimum on the standard face', async () => {
      // The 400 mm face renders ~28.8 mm text, under the interior floor (33).
      const boundSite = {
        ...refMultilevel,
        site: { ...refMultilevel.site, rules_pack_id: PACK_ID },
      };
      const ctx: CompileContext = {
        ...context, site: boundSite, rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['legibility_finding_count'] as number)).toBeGreaterThan(0);
    });

    it('passes the tall face under the interior context', async () => {
      const ctx: CompileContext = {
        ...context, site: tallFaceSite('interior'), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['legibility_finding_count']).toBe(0);
    });

    it('fails the same tall face under the harder exterior context', async () => {
      const ctx: CompileContext = {
        ...context, site: tallFaceSite('exterior'), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['legibility_finding_count'] as number)).toBeGreaterThan(0);
    });

    function siteWithDims(
      source: 'computed' | 'overridden', heightMm: number,
    ): typeof refMultilevel {
      return {
        ...refMultilevel,
        site: { ...refMultilevel.site, rules_pack_id: PACK_ID },
        supports: refMultilevel.supports.map((s) =>
          s.id === 'sup-001'
            ? { ...s, width_mm: 600, height_mm: heightMm, dimensions_source: source }
            : s,
        ),
      };
    }

    it('flags a hand-set format that comes out non-conform (A5.6)', async () => {
      // Overridden to a short 400 mm face → text under the floor → non-conform.
      const ctx: CompileContext = {
        ...context, site: siteWithDims('overridden', 400), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['legibility_finding_count'] as number)).toBeGreaterThan(0);
      expect((result['dimensions_finding_count'] as number)).toBeGreaterThan(0);
    });

    it('does not flag dimensions when the same non-conform format is computed', async () => {
      const ctx: CompileContext = {
        ...context, site: siteWithDims('computed', 400), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['legibility_finding_count'] as number)).toBeGreaterThan(0);
      expect(result['dimensions_finding_count']).toBe(0);
    });

    it('does not flag an overridden format that stays conform', async () => {
      const ctx: CompileContext = {
        ...context, site: siteWithDims('overridden', 560), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['legibility_finding_count']).toBe(0);
      expect(result['dimensions_finding_count']).toBe(0);
    });
  });

  describe('content overflow (LAYOUT.CONTENT_OVERFLOW)', () => {
    // Stub metrics: width ≈ characters × em. The 600 mm header at ~36 mm holds
    // the site name 'Site multi-niveaux' (18 chars ≈ 648 mm) → overflow.
    const measure = (text: string, fontSizeMm: number): number => text.length * fontSizeMm;
    const job = makeJob({
      support_id: 'sup-001', node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front', profile_key: 'standard',
    });

    it('runs no content-fit check when no measure is supplied', async () => {
      const result = await createArtworkHandler(context)(job);
      expect(result['content_overflow_finding_count']).toBe(0);
    });

    it('flags overflow when a measure reports text wider than its block', async () => {
      const ctx: CompileContext = { ...context, measure_text: measure };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['content_overflow_finding_count'] as number)).toBeGreaterThan(0);
    });

    it('makes an overridden format that overflows non-conform (A5.6)', async () => {
      const site = {
        ...refMultilevel,
        supports: refMultilevel.supports.map((s) =>
          s.id === 'sup-001'
            ? { ...s, width_mm: 600, height_mm: 400, dimensions_source: 'overridden' as const }
            : s,
        ),
      };
      const ctx: CompileContext = { ...context, site, measure_text: measure };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['content_overflow_finding_count'] as number)).toBeGreaterThan(0);
      expect((result['dimensions_finding_count'] as number)).toBeGreaterThan(0);
    });
  });
});

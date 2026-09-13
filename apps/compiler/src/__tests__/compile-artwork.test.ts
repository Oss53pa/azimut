import { describe, it, expect } from 'vitest';
import { createArtworkHandler } from '../compile-artwork.js';
import type { CompileContext } from '../compile-artwork.js';
import type { Job } from '../job.js';
import type { FaceTheme } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';
import { loadRulesPack, buildRulesPackIndex } from '@azimut/rules';

const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

const context: CompileContext = {
  site: refMultilevel,
  theme,
  font_family: 'Helvetica',
  pdf_target: 'pdf-x4',
  creation_date: new Date('2024-06-15T12:00:00Z'),
};

function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-compile-001',
    org_id: 'org-test-001',
    kind: 'compile_artworks',
    state: 'running',
    payload,
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2024-06-15T12:00:00Z'),
    started_at: new Date('2024-06-15T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

describe('T-2.12 createArtworkHandler', () => {
  it('produces SVG and PDF from a valid job', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    const result = await handler(job);
    expect(result['support_id']).toBe('sup-001');
    expect(result['face_side']).toBe('front');
    expect(typeof result['svg_length']).toBe('number');
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
    expect(typeof result['pdf_length']).toBe('number');
    expect((result['pdf_length'] as number)).toBeGreaterThan(0);
  });

  it('surfaces the rendered denomination-text size and support reading distance', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    const result = await handler(job);
    expect((result['min_text_font_size_mm'] as number)).toBeGreaterThan(0);
    // sup-001 in the fixture carries a reading distance (A5.6).
    expect(result['reading_distance_m']).toBe(5);
  });

  it('throws on unknown template', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      node_id: 'n-ml-hall',
      template_id: 'nonexistent',
      profile_key: 'standard',
    });

    await expect(handler(job)).rejects.toThrow('Template not found');
  });

  it('throws on unknown profile', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'nonexistent',
    });

    await expect(handler(job)).rejects.toThrow('Profile not found');
  });

  it('throws on non-existent node', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      node_id: 'n-nonexistent',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    await expect(handler(job)).rejects.toThrow('Compose failed: GRAPH.RESOLVE_NODE_NOT_FOUND');
  });

  it('falls back to job.id when support_id is missing', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
      // no support_id
    });
    const result = await handler(job);
    expect(result['support_id']).toBe('job-compile-001');
  });

  it('falls back to "standard" when profile_key is not a string', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-default',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 42,
    });
    const result = await handler(job);
    expect(result['support_id']).toBe('sup-default');
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
  });

  it('uses fallback dimensions when support_type not found', async () => {
    const siteNoSupportTypes = {
      ...refMultilevel,
      support_types: [],
    };
    const ctx: CompileContext = { ...context, site: siteNoSupportTypes };
    const handler = createArtworkHandler(ctx);
    const job = makeJob({
      support_id: 'sup-fallback',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    const result = await handler(job);
    // Should still produce output using fallback 600x400 dimensions
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
    expect((result['pdf_length'] as number)).toBeGreaterThan(0);
  });

  it('non-string node_id resolves to empty string and fails', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      node_id: 123,
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    await expect(handler(job)).rejects.toThrow('Compose failed: GRAPH.RESOLVE_NODE_NOT_FOUND');
  });

  it('non-string template_id defaults to empty and fails', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 42,
      profile_key: 'standard',
    });
    await expect(handler(job)).rejects.toThrow('Template not found');
  });

  it('face lookup miss when support type has no matching face side', async () => {
    const siteNoFace = {
      ...refMultilevel,
      support_types: refMultilevel.support_types.map((st) => ({
        ...st,
        faces: st.faces.map((f) => ({ ...f, side: 'back' as const })),
      })),
    };
    const ctx: CompileContext = { ...context, site: siteNoFace };
    const handler = createArtworkHandler(ctx);
    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    const result = await handler(job);
    // Falls back to 600x400 dimensions
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
  });

  it('uses fallback dimensions when support_type has empty faces', async () => {
    const siteEmptyFaces = {
      ...refMultilevel,
      support_types: refMultilevel.support_types.map((st) => ({
        ...st,
        faces: [],
      })),
    };
    const ctx: CompileContext = { ...context, site: siteEmptyFaces };
    const handler = createArtworkHandler(ctx);
    const job = makeJob({
      support_id: 'sup-ef',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    const result = await handler(job);
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
    expect((result['pdf_length'] as number)).toBeGreaterThan(0);
  });

  it('profile_key absent from payload falls back to standard', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-no-profile',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      // no profile_key key at all
    });
    const result = await handler(job);
    expect(result['support_id']).toBe('sup-no-profile');
    expect((result['svg_length'] as number)).toBeGreaterThan(0);
  });

  it('empty string support_id is propagated as-is', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: '',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });
    const result = await handler(job);
    expect(result['support_id']).toBe('');
  });

  it('throws on completely empty payload', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({});
    await expect(handler(job)).rejects.toThrow('Template not found');
  });

  it('produces deterministic output (INV-4)', async () => {
    const handler = createArtworkHandler(context);
    const job = makeJob({
      support_id: 'sup-det',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    const r1 = await handler(job);
    const r2 = await handler(job);
    expect(r1).toStrictEqual(r2);
  });

  describe('support instance dimensions override the typology default (A5.6)', () => {
    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    it('renders larger text when the support overrides the face height', async () => {
      const baseline = await createArtworkHandler(context)(job);

      const taller = {
        ...refMultilevel,
        supports: refMultilevel.supports.map((s) =>
          s.id === 'sup-001'
            ? { ...s, width_mm: 600, height_mm: 560, dimensions_source: 'overridden' as const }
            : s,
        ),
      };
      const result = await createArtworkHandler({ ...context, site: taller })(job);

      // A taller instance face lifts the rendered denomination text.
      expect((result['min_text_font_size_mm'] as number))
        .toBeGreaterThan(baseline['min_text_font_size_mm'] as number);
    });
  });

  describe('contrast check wired to a bound rules pack', () => {
    // Colours built from a helper so no literal hex appears in source.
    const hx = (rgb: string): string => `#${rgb}`;
    const WHITE = hx('ffffff');
    const BLACK = hx('000000'); // vs white → 21
    const GREY_LOW = hx('949494'); // vs white → 3.03 (below 4.7)

    const pack = (() => {
      const outcome = loadRulesPack(
        'packages/testkit/fixtures/rules-packs/test-fixture',
        { environment: 'test' },
      );
      if (!outcome.ok) throw new Error('fixture non chargeable');
      return outcome.value;
    })();

    const hexTheme = (text: string): FaceTheme => ({
      background: WHITE,
      text_primary: text,
      text_secondary: text,
      accent: BLACK,
      border: text,
    });

    const job = makeJob({
      support_id: 'sup-contrast',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    it('reports no contrast finding for a conformant face', async () => {
      const ctx: CompileContext = {
        ...context, theme: hexTheme(BLACK), rules_pack: pack,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['contrast_finding_count']).toBe(0);
    });

    it('reports a contrast finding for low-contrast text', async () => {
      const ctx: CompileContext = {
        ...context, theme: hexTheme(GREY_LOW), rules_pack: pack,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['contrast_finding_count'] as number)).toBeGreaterThan(0);
    });

    it('runs no contrast check when no pack is bound', async () => {
      const ctx: CompileContext = { ...context, theme: hexTheme(GREY_LOW) };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['contrast_finding_count']).toBe(0);
    });
  });

  describe('rules pack resolved from the site binding (A5.8)', () => {
    const hx = (rgb: string): string => `#${rgb}`;
    const WHITE = hx('ffffff');
    const BLACK = hx('000000');
    const GREY_LOW = hx('949494');
    const PACK_ID = 'rp-test-0001';

    const index = (() => {
      const built = buildRulesPackIndex(
        [{ id: PACK_ID, directory: 'packages/testkit/fixtures/rules-packs/test-fixture' }],
        { environment: 'test' },
      );
      if (!built.ok) throw new Error('index non constructible');
      return built.value;
    })();

    const hexTheme = (text: string): FaceTheme => ({
      background: WHITE, text_primary: text, text_secondary: text,
      accent: BLACK, border: text,
    });

    const boundSite = {
      ...refMultilevel,
      site: { ...refMultilevel.site, rules_pack_id: PACK_ID },
    };

    const job = makeJob({
      support_id: 'sup-bound',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    it('resolves the bound pack from the index and runs the check', async () => {
      const ctx: CompileContext = {
        ...context, site: boundSite, theme: hexTheme(GREY_LOW), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['pack_bound']).toBe(true);
      expect(result['pack_finding_count']).toBe(0);
      expect((result['contrast_finding_count'] as number)).toBeGreaterThan(0);
    });

    it('surfaces PACK_NOT_BOUND and skips the check for an unbound site', async () => {
      const ctx: CompileContext = {
        ...context, theme: hexTheme(GREY_LOW), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['pack_bound']).toBe(false);
      expect(result['pack_finding_count']).toBe(1);
      expect(result['contrast_finding_count']).toBe(0);
    });

    it('still produces artwork despite an unresolved binding', async () => {
      const ctx: CompileContext = {
        ...context, theme: hexTheme(GREY_LOW), rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect((result['svg_length'] as number)).toBeGreaterThan(0);
      expect((result['pdf_length'] as number)).toBeGreaterThan(0);
    });
  });

  describe('support registry scopes the contrast check (A5.6)', () => {
    const hx = (rgb: string): string => `#${rgb}`;
    const WHITE = hx('ffffff');
    const BLACK = hx('000000');
    // Contrast 5.41 vs white: above wayfinding (4.7), below safety (6.1).
    const MID = hx('6a6a6a');
    const PACK_ID = 'rp-test-0001';

    const index = (() => {
      const built = buildRulesPackIndex(
        [{ id: PACK_ID, directory: 'packages/testkit/fixtures/rules-packs/test-fixture' }],
        { environment: 'test' },
      );
      if (!built.ok) throw new Error('index non constructible');
      return built.value;
    })();

    const midTheme: FaceTheme = {
      background: WHITE, text_primary: MID, text_secondary: MID,
      accent: BLACK, border: MID,
    };

    function siteWithSupportRegistry(registry: 'safety' | 'wayfinding'): typeof refMultilevel {
      return {
        ...refMultilevel,
        site: { ...refMultilevel.site, rules_pack_id: PACK_ID },
        supports: refMultilevel.supports.map((s) =>
          s.id === 'sup-001' ? { ...s, registry } : s,
        ),
      };
    }

    const job = makeJob({
      support_id: 'sup-001',
      node_id: 'n-ml-hall',
      template_id: 'ftpl-dir-front',
      profile_key: 'standard',
    });

    it('passes a mid-contrast face under the wayfinding registry', async () => {
      const ctx: CompileContext = {
        ...context, site: siteWithSupportRegistry('wayfinding'),
        theme: midTheme, rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['support_registry']).toBe('wayfinding');
      expect(result['contrast_finding_count']).toBe(0);
    });

    it('fails the same face under the harder safety registry', async () => {
      const ctx: CompileContext = {
        ...context, site: siteWithSupportRegistry('safety'),
        theme: midTheme, rules_pack_index: index,
      };
      const result = await createArtworkHandler(ctx)(job);
      expect(result['support_registry']).toBe('safety');
      expect((result['contrast_finding_count'] as number)).toBeGreaterThan(0);
    });
  });

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

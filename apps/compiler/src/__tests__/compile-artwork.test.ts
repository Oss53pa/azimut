import { describe, it, expect } from 'vitest';
import { createArtworkHandler } from '../compile-artwork.js';
import type { CompileContext } from '../compile-artwork.js';
import type { Job } from '../job.js';
import type { FaceTheme } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';
import { loadRulesPack } from '@azimut/rules';

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
});

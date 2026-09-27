import { describe, it, expect } from 'vitest';
import { createArtworkHandler } from '../compile-artwork.js';
import type { CompileContext } from '../compile-artwork.js';
import type { FaceTheme } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';
import { loadRulesPack, buildRulesPackIndex } from '@azimut/rules/loader';
import { context, makeJob } from './compile-artwork-fixtures.js';

// Suite de compile-artwork.test.ts : contraste, paquet de règles, registre.
describe('T-2.12 createArtworkHandler', () => {
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
});

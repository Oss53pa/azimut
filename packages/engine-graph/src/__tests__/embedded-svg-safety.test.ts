import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import { resolveLogoContent, resolveMapContent } from '../block-resolvers.js';
import { renderLogo, renderMap } from '../render-face-embedded-blocks.js';

/**
 * Lot 5 de l'audit, faille XSS stockée : `svg_markup` et `plan_svg` étaient
 * insérés tels quels dans une face, puis affichés. Un logo piégé est refusé à
 * l'écriture, et, s'il est déjà en base, n'est pas rendu.
 */
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const TRAPPED = [
  `<svg ${NS} onload="alert(1)"><rect/></svg>`,
  `<svg ${NS}><script>alert(1)</script></svg>`,
  `<svg ${NS}><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>`,
  `<svg ${NS}><use href="javascript:alert(1)"/></svg>`,
];
const THEME = { background: 'white', text_primary: 'black', text_secondary: 'gray', accent: 'blue', border: 'gray' };

describe('lot 5 : un SVG intégré piégé n’est jamais rendu', () => {
  it.each(TRAPPED)('logo : %s', svg => {
    const content = resolveLogoContent({ svg_markup: svg, label: 'Logo' }, 'Organisation');
    expect(content).toMatchObject({ type: 'logo', svg_markup: null });
    const out = renderLogo(content as Extract<typeof content, { type: 'logo' }>, 0, 0, 10, 10, THEME, 'Inter');
    expect(out).not.toMatch(/onload|<script|foreignObject|javascript:/i);
    expect(out).toContain('Logo');
  });

  it.each(TRAPPED)('plan : %s', svg => {
    const content = resolveMapContent({ plan_svg: svg, caption: 'Plan' });
    expect(content).toMatchObject({ type: 'map', plan_svg: null });
    const out = renderMap(content as Extract<typeof content, { type: 'map' }>, 0, 0, 10, 10, THEME, 'Inter');
    expect(out).not.toMatch(/onload|<script|foreignObject|javascript:/i);
  });

  it('un logo propre est rendu sous sa forme reconstruite', () => {
    const content = resolveLogoContent({ svg_markup: `<svg ${NS}><!-- outil --><rect width="1" height="1"/></svg>` }, 'Org');
    expect(content).toMatchObject({ svg_markup: `<svg ${NS}><rect width="1" height="1"/></svg>` });
  });
});

describe('lot 5 : le même SVG est refusé à l’écriture', () => {
  it.each(TRAPPED)('%s', svg => {
    const out = buildCommand({
      operation: 'create', module: '04-signaletique', table: 'support_content_block',
      id: 'b1', org_id: 'o1', timestamp: '2026-10-23T00:00:00.000Z',
      after: { id: 'b1', config: JSON.stringify({ svg_markup: svg }) },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings.map(f => f.code)).toContain('ASSET.SANITIZATION_FAILED');
  });
});

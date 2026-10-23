import { describe, it, expect } from 'vitest';
import { sanitizeSvg, sanitizeConfigFrom } from '../asset-sanitizer.js';
import type { SanitizeConfig } from '../asset-sanitizer.js';
import { REFERENCE_SECURITY_SETTINGS } from '../../data/reference-security-settings.js';

/** Les bornes de référence (D-5), celles que la migration 0081 inscrit. */
const LIMITS = sanitizeConfigFrom(REFERENCE_SECURITY_SETTINGS, false);
const LOGO = sanitizeConfigFrom(REFERENCE_SECURITY_SETTINGS, true);

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const safeSvg = `<svg ${NS}><circle cx="10" cy="10" r="5"/></svg>`;

function refusal(svg: string, config: SanitizeConfig = LIMITS): string {
  const result = sanitizeSvg(svg, config);
  return result.ok ? 'accepté' : String(result.finding.params['reason']);
}

describe('E14.2 et D-7 : la réception d’un SVG', () => {
  it('rend un SVG propre sous sa forme reconstruite', () => {
    const result = sanitizeSvg(safeSvg, LIMITS);
    expect(result).toEqual({ ok: true, cleanSvg: safeSvg, warnings: [] });
  });

  it('retire les métadonnées, sans refuser', () => {
    const result = sanitizeSvg(`<svg ${NS}><metadata>Outil 1.0</metadata><circle r="5"/></svg>`, LIMITS);
    expect(result.ok && result.cleanSvg).toBe(`<svg ${NS}><circle r="5"/></svg>`);
  });

  it.each([
    ['un script', `<svg ${NS}><script>alert(1)</script><circle r="5"/></svg>`, 'element'],
    ['un gestionnaire d’événement', `<svg ${NS}><circle r="5" onclick="alert(1)"/></svg>`, 'attribute'],
    ['un lien javascript', `<svg ${NS}><use href="javascript:alert(1)"/></svg>`, 'value'],
    ['un lien externe', `<svg ${NS}><use xlink:href="http://evil.example/x.svg#a"/></svg>`, 'value'],
    ['une entité déclarée', `<!DOCTYPE svg [<!ENTITY x "y">]><svg ${NS}><text>&x;</text></svg>`, 'doctype'],
    ['un foreignObject', `<svg ${NS}><foreignObject><div/></foreignObject></svg>`, 'element'],
  ])('refuse %s, le fichier entier', (_label, svg, reason) => {
    expect(refusal(svg)).toBe(reason);
  });

  it('refuse au-delà des bornes de la configuration', () => {
    expect(refusal(safeSvg, { ...LIMITS, maxFileSize: 10 })).toBe('file_too_large');
    expect(refusal(safeSvg, { ...LIMITS, maxElements: 1 })).toBe('too_complex');
    expect(refusal(`<svg ${NS}><g><g><circle/></g></g></svg>`, { ...LIMITS, maxDepth: 2 })).toBe('too_deep');
  });

  it('une image en mode point est refusée, sous le code du logo pour un logo', () => {
    const withImage = `<svg ${NS}><image href="data:image/png;base64,AAAA" width="100" height="100"/></svg>`;
    const logo = sanitizeSvg(withImage, LOGO);
    expect(!logo.ok && logo.finding.code).toBe('ASSET.RASTER_IN_LOGO');
    const creative = sanitizeSvg(withImage, LIMITS);
    expect(!creative.ok && creative.finding.code).toBe('ASSET.SANITIZATION_FAILED');
  });
});

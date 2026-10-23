import { describe, it, expect } from 'vitest';
import {
  sanitizeSvg,
  DEFAULT_SANITIZE_CONFIG,
  LOGO_SANITIZE_CONFIG,
} from '../asset-sanitizer.js';
import type { SanitizeConfig } from '../asset-sanitizer.js';

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>';

describe('E14.2 — asset sanitization', () => {
  describe('clean SVG passthrough', () => {
    it('returns clean SVG unchanged', () => {
      const result = sanitizeSvg(safeSvg);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).toContain('circle');
      }
    });
  });

  describe('script removal', () => {
    it('removes script elements', () => {
      const dirty = '<svg><script>alert(1)</script><circle r="5"/></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('script');
        expect(result.cleanSvg).toContain('circle');
      }
    });

    it('removes event handlers', () => {
      const dirty = '<svg><circle r="5" onclick="alert(1)"/></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('onclick');
      }
    });

    it('removes javascript: URLs', () => {
      const dirty = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('javascript');
      }
    });
  });

  describe('external reference removal', () => {
    it('removes external xlink:href', () => {
      const dirty = '<svg><use xlink:href="https://evil.com/sprite.svg"/></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('evil.com');
      }
    });

    it('removes XML entities', () => {
      const dirty = '<!ENTITY xxe SYSTEM "file:///etc/passwd"><svg><text>&xxe;</text></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('ENTITY');
      }
    });
  });

  describe('metadata removal', () => {
    it('removes metadata elements', () => {
      const dirty = '<svg><metadata><rdf:RDF>author info</rdf:RDF></metadata><circle r="5"/></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('metadata');
        expect(result.cleanSvg).toContain('circle');
      }
    });
  });

  describe('foreignObject removal', () => {
    it('removes foreignObject (can contain HTML)', () => {
      const dirty = '<svg><foreignObject><div>HTML content</div></foreignObject></svg>';
      const result = sanitizeSvg(dirty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('foreignObject');
      }
    });
  });

  describe('size limits', () => {
    it('rejects files exceeding max size', () => {
      const config: SanitizeConfig = { ...DEFAULT_SANITIZE_CONFIG, maxFileSize: 10 };
      const result = sanitizeSvg(safeSvg, config);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('ASSET.SANITIZATION_FAILED');
        expect(result.finding.params['reason']).toBe('file_too_large');
      }
    });

    it('rejects files exceeding max elements', () => {
      const config: SanitizeConfig = { ...DEFAULT_SANITIZE_CONFIG, maxElements: 1 };
      // safeSvg has svg + circle = 2 elements
      const result = sanitizeSvg(safeSvg, config);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.params['reason']).toBe('too_complex');
      }
    });
  });

  describe('raster in logo (E14.2)', () => {
    it('rejects raster images in logo mode', () => {
      const withImage = '<svg><image href="data:image/png;base64,..." width="100" height="100"/></svg>';
      const result = sanitizeSvg(withImage, LOGO_SANITIZE_CONFIG);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('ASSET.RASTER_IN_LOGO');
      }
    });

    it('allows raster images in non-logo mode', () => {
      const withImage = '<svg><image href="test.png" width="100" height="100"/></svg>';
      const result = sanitizeSvg(withImage, DEFAULT_SANITIZE_CONFIG);
      // Either ok with warning or stripped — both acceptable
      if (result.ok) {
        expect(result.cleanSvg).not.toContain('image');
      }
    });
  });
});

/**
 * Les contournements que l'assainissement par expressions régulières
 * laissait passer, relevés par l'audit de sécurité. Chacun est rendu dans la
 * page par `AdCreativesView` : ce qui passe ici s'exécute.
 */
describe('E14.2 — réécriture par liste blanche, contournements connus', () => {
  function cleaned(svg: string): string {
    const result = sanitizeSvg(svg);
    if (!result.ok) throw new Error(`refusé : ${String(result.finding.params['reason'])}`);
    return result.cleanSvg;
  }

  it('un SVG propre ressort octet pour octet', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect x="0" y="0" width="100" height="40"/><text x="8" y="26" font-size="14">Vaudel</text></svg>';
    expect(cleaned(svg)).toBe(svg);
  });

  it('gestionnaire sans guillemets ou collé derrière une barre : refusé, jamais réparé', () => {
    for (const svg of ['<svg onload=alert(1)><rect/></svg>', '<svg/onload="alert(1)"><rect/></svg>']) {
      const result = sanitizeSvg(svg);
      expect(result.ok, svg).toBe(false);
    }
  });

  it('gestionnaire bien formé : retiré, quelle que soit sa casse', () => {
    expect(cleaned('<svg><rect ONCLICK="alert(1)" onMouseOver=\'x()\' width="1"/></svg>'))
      .toBe('<svg><rect width="1"/></svg>');
  });

  it('javascript: codé en entité ou coupé de blancs : retiré', () => {
    const out = cleaned('<svg><a href="javascript&#58;alert(1)"><rect width="1"/></a><use href="java&#x09;script:x()"/></svg>');
    expect(out.toLowerCase()).not.toContain('javascript');
    expect(out).toContain('<rect width="1"/>');
  });

  it('éléments que nulle liste noire ne nommait : iframe, embed, style, animate, foreignObject', () => {
    const out = cleaned([
      '<svg>',
      '<iframe src="https://exemple.invalide"></iframe>',
      '<embed src="x"/>',
      '<style>rect{fill:url(https://exemple.invalide/x)}</style>',
      '<animate attributeName="href" to="javascript:alert(1)"/>',
      '<foreignObject><div>html</div></foreignObject>',
      '<rect width="1"/>',
      '</svg>',
    ].join(''));
    expect(out).toBe('<svg><rect width="1"/></svg>');
  });

  it('références externes dans les valeurs : retirées, références internes gardées', () => {
    const out = cleaned('<svg><rect fill="url(https://exemple.invalide/a)" stroke="url(#g)" style="fill:url(data:x);stroke:red;behavior:url(x)"/></svg>');
    expect(out).toBe('<svg><rect stroke="url(#g)" style="stroke:red"/></svg>');
  });

  it('use : seul un fragment interne est suivi', () => {
    expect(cleaned('<svg><use href="#a"/><use xlink:href="https://exemple.invalide/s.svg#a"/></svg>'))
      .toBe('<svg><use href="#a"/><use/></svg>');
  });

  it('le texte est réencodé : une balise écrite en entités ne renaît pas', () => {
    expect(cleaned('<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>'))
      .toBe('<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>');
  });

  it('balisage cassé ou racine qui n’est pas un SVG : refusé', () => {
    expect(sanitizeSvg('<svg><rect></svg>').ok).toBe(false);
    expect(sanitizeSvg('<html><body/></html>').ok).toBe(false);
    expect(sanitizeSvg('<svg></svg><script>alert(1)</script>').ok).toBe(false);
  });

  it('la réécriture est stable : réécrire ce qui est réécrit ne change rien', () => {
    const once = cleaned('<svg><!-- outil --><?xml-stylesheet x?><g style="fill:red"><a><path d="M0 0L1 1"/></a></g></svg>');
    expect(cleaned(once)).toBe(once);
    expect(once).toBe('<svg><g style="fill:red"><path d="M0 0L1 1"/></g></svg>');
  });
});

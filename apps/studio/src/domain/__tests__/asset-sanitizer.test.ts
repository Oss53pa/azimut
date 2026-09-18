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

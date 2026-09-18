import { describe, it, expect } from 'vitest';
import { receiveCreative, receiveCreatives } from '../ad-creative-intake.js';
import type { CreativePayload } from '../ad-creative-intake.js';
import type { Creative, CreativeSpec } from '../ad-creative-control.js';
import { DEFAULT_SANITIZE_CONFIG } from '../asset-sanitizer.js';

const SPEC: CreativeSpec = {
  format: 'svg',
  min_resolution_dpi: 150,
  safe_zone_mm: 10,
  color_profile: 'CMYK',
  max_weight_bytes: 10_000_000,
};

function creative(id: string, overrides: Partial<Creative> = {}): Creative {
  return {
    id,
    format: 'svg',
    resolution_dpi: 300,
    safe_zone_mm: 12,
    color_profile: 'CMYK',
    weight_bytes: 900_000,
    ...overrides,
  };
}

const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const DIRTY_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<metadata>Outil 1.0</metadata>',
  '<script>alert(1)</script>',
  '<rect width="10" height="10" onclick="alert(2)"/>',
  '</svg>',
].join('');

function svg(source: string): CreativePayload {
  return { kind: 'svg', source };
}

const BINARY: CreativePayload = { kind: 'binary' };

/**
 * N5.2 — R5 (assainissement avant stockage, jamais rendu sinon) et R6
 * (contrôles techniques automatiques), dans cet ordre.
 */
describe('R5 — assainissement du visuel reçu', () => {
  it('assainit un SVG et le rend affichable', () => {
    const intake = receiveCreative({ creative: creative('cr-1'), payload: svg(CLEAN_SVG) }, SPEC);
    expect(intake.sanitation).toBe('clean');
    expect(intake.renderable).toBe(true);
    expect(intake.clean_svg).toBe(CLEAN_SVG);
  });

  it('retire ce qui est dangereux plutôt que de refuser le fichier', () => {
    const intake = receiveCreative({ creative: creative('cr-2'), payload: svg(DIRTY_SVG) }, SPEC);
    expect(intake.sanitation).toBe('clean');
    expect(intake.clean_svg).not.toContain('<script');
    expect(intake.clean_svg).not.toContain('onclick');
    expect(intake.clean_svg).not.toContain('<metadata');
    // Ce qui est stocké n'est pas ce qui a été reçu.
    expect(intake.clean_svg).not.toBe(DIRTY_SVG);
  });

  it('refuse un fichier hors des bornes, et ne le rend jamais', () => {
    // `sanitizeSvg` ne refuse que sur la taille ou la complexité ; une
    // configuration serrée l'éprouve sans jeu d'essai de cinq mégaoctets.
    const intake = receiveCreative(
      { creative: creative('cr-3'), payload: svg(CLEAN_SVG) },
      SPEC,
      { ...DEFAULT_SANITIZE_CONFIG, maxFileSize: 10 },
    );
    expect(intake.sanitation).toBe('failed');
    expect(intake.renderable).toBe(false);
    expect(intake.clean_svg).toBeUndefined();
    expect(intake.findings[0]?.code).toBe('ASSET.SANITIZATION_FAILED');
    expect(intake.findings[0]?.severity).toBe('blocking');
  });

  it('rattache l’anomalie d’assainissement au visuel', () => {
    const intake = receiveCreative(
      { creative: creative('cr-4'), payload: svg(CLEAN_SVG) },
      SPEC,
      { ...DEFAULT_SANITIZE_CONFIG, maxFileSize: 10 },
    );
    expect(intake.findings[0]?.entity).toEqual({ kind: 'creative', id: 'cr-4' });
  });

  it('ne contrôle pas la fiche technique d’un visuel refusé à l’assainissement', () => {
    // Le contrôler reviendrait à traiter comme un document un fichier qu'on
    // vient de déclarer dangereux.
    const intake = receiveCreative(
      { creative: creative('cr-5', { format: 'png', resolution_dpi: 10 }), payload: svg(CLEAN_SVG) },
      SPEC,
      { ...DEFAULT_SANITIZE_CONFIG, maxFileSize: 10 },
    );
    expect(intake.findings).toHaveLength(1);
    expect(intake.findings.every(f => f.code === 'ASSET.SANITIZATION_FAILED')).toBe(true);
  });

  it('remet un format binaire au serveur, et ne le tient pas pour propre', () => {
    const intake = receiveCreative({ creative: creative('cr-6'), payload: BINARY }, SPEC);
    expect(intake.sanitation).toBe('deferred');
    // « Pas encore assaini » n'est pas « propre en attendant » (E14.2).
    expect(intake.renderable).toBe(false);
  });
});

describe('R6 — fiche technique, après l’assainissement', () => {
  it('signale chaque axe non conforme d’un visuel assaini', () => {
    const intake = receiveCreative(
      {
        creative: creative('cr-7', { format: 'png', resolution_dpi: 96, color_profile: 'RGB' }),
        payload: svg(CLEAN_SVG),
      },
      SPEC,
    );
    expect(intake.sanitation).toBe('clean');
    // Non conforme, mais regardable : les deux axes ne se confondent pas.
    expect(intake.renderable).toBe(true);
    const axes = intake.findings.map(f => f.params['axis']);
    expect(axes).toEqual(['format', 'resolution', 'color_profile']);
  });

  it('contrôle aussi la fiche d’un visuel remis au serveur', () => {
    const intake = receiveCreative(
      { creative: creative('cr-8', { resolution_dpi: 72 }), payload: BINARY },
      SPEC,
    );
    expect(intake.sanitation).toBe('deferred');
    expect(intake.findings.map(f => f.params['axis'])).toEqual(['resolution']);
  });

  it('ne signale rien sur un visuel propre et conforme', () => {
    const intake = receiveCreative({ creative: creative('cr-9'), payload: svg(CLEAN_SVG) }, SPEC);
    expect(intake.findings).toEqual([]);
  });
});

describe('receiveCreatives', () => {
  it('conserve l’ordre reçu', () => {
    const intakes = receiveCreatives([
      { creative: creative('cr-b'), payload: BINARY },
      { creative: creative('cr-a'), payload: svg(CLEAN_SVG) },
    ], SPEC);
    expect(intakes.map(i => i.creative_id)).toEqual(['cr-b', 'cr-a']);
  });

  it('rend le même constat deux fois de suite', () => {
    const receptions = [{ creative: creative('cr-a'), payload: svg(DIRTY_SVG) }];
    expect(receiveCreatives(receptions, SPEC)).toEqual(receiveCreatives(receptions, SPEC));
  });
});

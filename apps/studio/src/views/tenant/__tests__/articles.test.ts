import { describe, it, expect } from 'vitest';
import { DEMO_SIGN_DOSSIERS, DEMO_SIGN_REGULATION } from '../../../domain/demo/commerce.js';
import type { SignRegulation } from '../../../domain/tenant-regulation.js';
import { instructDossier, regulationArticles } from '../articles.js';

describe('H5.2 — règlement d’enseigne article par article', () => {
  it('numérote un article par axe borné, dans l’ordre du règlement', () => {
    const articles = regulationArticles(DEMO_SIGN_REGULATION);
    expect(articles.map(a => [a.code, a.axis])).toEqual([
      ['RE-01', 'height'], ['RE-02', 'overhang'], ['RE-03', 'material'],
      ['RE-04', 'lighting'], ['RE-05', 'forbidden_feature'],
    ]);
  });

  it('ne fait pas un article d’un axe que le règlement ne borne pas', () => {
    const loose: SignRegulation = { ...DEMO_SIGN_REGULATION, max_height_mm: null, allowed_lighting: [] };
    expect(regulationArticles(loose).map(a => a.axis)).toEqual(['overhang', 'material', 'forbidden_feature']);
  });

  it('range les écarts du garde sous l’article de leur axe', () => {
    const dossier = DEMO_SIGN_DOSSIERS.find(d => d.id === 'ts-0118');
    if (dossier === undefined) throw new Error('dossier manquant');
    const instruction = instructDossier(dossier, DEMO_SIGN_REGULATION);
    const failing = instruction.checks.filter(c => c.findings.length > 0).map(c => c.article.axis);
    // 1 120 mm > 900 mm, plexiglas hors liste, néon nu interdit.
    expect(failing).toEqual(['height', 'material', 'forbidden_feature']);
    expect(instruction.missingParts).toEqual(['material_samples']);
  });

  it('ne relève aucun écart sur un dossier conforme', () => {
    const dossier = DEMO_SIGN_DOSSIERS.find(d => d.id === 'ts-0031');
    if (dossier === undefined) throw new Error('dossier manquant');
    const instruction = instructDossier(dossier, DEMO_SIGN_REGULATION);
    expect(instruction.checks.every(c => c.findings.length === 0)).toBe(true);
    expect(instruction.missingParts).toHaveLength(0);
  });
});

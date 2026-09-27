/**
 * H5.2 — le règlement d'enseigne lu article par article, et l'instruction
 * d'un dossier contre lui.
 *
 * Un article est un axe du règlement du site (hauteur, débord, matériau,
 * éclairage, interdits). Le verdict de chaque article vient du garde
 * `guardSignProject` : on ne recompte rien ici, on range ses anomalies par
 * axe. Un axe que le règlement ne borne pas n'est pas un article.
 */
import type { Finding } from '@azimut/core-model';
import { guardSignProject, type SignProject, type SignRegulation } from '../../domain/tenant-regulation.js';
import type { SignDossier } from './dossiers.js';

export const ARTICLE_AXES = ['height', 'overhang', 'material', 'lighting', 'forbidden_feature'] as const;
export type ArticleAxis = (typeof ARTICLE_AXES)[number];

export type Article = {
  /** Rang dans le règlement, « RE-01 » et suivants. */
  readonly code: string;
  readonly axis: ArticleAxis;
  /** L'exigence, telle que le règlement la porte : un nombre de mm ou une liste. */
  readonly limitMm: number | null;
  readonly values: readonly string[];
};

export function regulationArticles(regulation: SignRegulation): readonly Article[] {
  const candidates: readonly Omit<Article, 'code'>[] = [
    { axis: 'height', limitMm: regulation.max_height_mm, values: [] },
    { axis: 'overhang', limitMm: regulation.max_overhang_mm, values: [] },
    { axis: 'material', limitMm: null, values: regulation.allowed_materials },
    { axis: 'lighting', limitMm: null, values: regulation.allowed_lighting },
    { axis: 'forbidden_feature', limitMm: null, values: regulation.forbidden_features },
  ];
  return candidates
    .filter(a => a.limitMm !== null || a.values.length > 0)
    .map((a, i) => ({ ...a, code: `RE-${String(i + 1).padStart(2, '0')}` }));
}

/** Ce que le projet demande sur l'axe de l'article. */
export function requested(project: SignProject, axis: ArticleAxis): { readonly mm: number | null; readonly values: readonly string[] } {
  switch (axis) {
    case 'height': return { mm: project.height_mm, values: [] };
    case 'overhang': return { mm: project.overhang_mm, values: [] };
    case 'material': return { mm: null, values: [project.material] };
    case 'lighting': return { mm: null, values: [project.lighting] };
    case 'forbidden_feature': return { mm: null, values: project.features };
  }
}

export type ArticleCheck = {
  readonly article: Article;
  readonly findings: readonly Finding[];
};

export type Instruction = {
  readonly dossier: SignDossier;
  readonly checks: readonly ArticleCheck[];
  readonly missingParts: readonly string[];
};

export function instructDossier(dossier: SignDossier, regulation: SignRegulation): Instruction {
  const guarded = guardSignProject(dossier.project, regulation);
  const findings = guarded.ok ? guarded.warnings : guarded.findings;
  return {
    dossier,
    checks: regulationArticles(regulation).map(article => ({
      article,
      findings: findings.filter(f => f.params['axis'] === article.axis),
    })),
    missingParts: dossier.parts.filter(p => !p.provided).map(p => p.key),
  };
}

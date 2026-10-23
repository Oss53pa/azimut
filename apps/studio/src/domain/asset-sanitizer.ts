/**
 * E14.2 et lot 5 de l'audit (D-7) : la réception d'un SVG.
 *
 * Avant tout stockage, un SVG passe par l'analyseur par liste blanche de
 * `core-model` (`validateSvg`, profil `asset`) :
 *  - script, gestionnaire d'événement, référence externe, entité, DOCTYPE,
 *    style, `foreignObject`, image en mode point : **refusés**, le fichier
 *    entier, jamais nettoyé. Un nettoyage par expressions régulières se
 *    contourne ; une liste blanche suivie d'une reconstruction, non ;
 *  - métadonnées, titre, description, attributs d'éditeur : retirés ;
 *  - taille, nombre d'éléments, profondeur : bornés par les seuils de la
 *    configuration (D-5), jamais par une constante.
 *
 * Un actif non assaini n'est jamais rendu. Le champ `sanitized` fait foi.
 */
import { validateSvg } from '@azimut/core-model';
import type { Finding, SvgRefusal } from '@azimut/core-model';
import type { SecuritySettings } from '../data/security-settings.js';

export type SanitizeConfig = {
  readonly maxFileSize: number;
  readonly maxElements: number;
  readonly maxDepth: number;
  /** E14.2 : « aucune image en mode point acceptée dans un logo ». */
  readonly forbidRaster: boolean;
};

/** Les bornes de réception, tirées des seuils en vigueur. */
export function sanitizeConfigFrom(settings: SecuritySettings, forbidRaster: boolean): SanitizeConfig {
  return {
    maxFileSize: settings['asset.svg.max_bytes'],
    maxElements: settings['asset.svg.max_elements'],
    maxDepth: settings['asset.svg.max_depth'],
    forbidRaster,
  };
}

export type SanitizeResult =
  | { readonly ok: true; readonly cleanSvg: string; readonly warnings: readonly Finding[] }
  | { readonly ok: false; readonly finding: Finding };

/** Les motifs de l'analyseur, sous les noms que l'écran et ses essais emploient déjà. */
const REASON: Partial<Record<SvgRefusal, string>> = {
  too_large: 'file_too_large',
  too_complex: 'too_complex',
};

export function sanitizeSvg(svgContent: string, config: SanitizeConfig): SanitizeResult {
  const checked = validateSvg(svgContent, 'asset', {
    maxBytes: config.maxFileSize,
    maxElements: config.maxElements,
    maxDepth: config.maxDepth,
  });
  if (checked.ok) return { ok: true, cleanSvg: checked.svg, warnings: [] };

  const raster = checked.reason === 'element' && checked.detail === 'image';
  return {
    ok: false,
    finding: {
      code: raster && config.forbidRaster ? 'ASSET.RASTER_IN_LOGO' : 'ASSET.SANITIZATION_FAILED',
      severity: 'blocking',
      entity: null,
      params: { reason: REASON[checked.reason] ?? checked.reason, detail: checked.detail },
      ruleRef: 'E14.2',
    },
  };
}

import type { Finding } from '@azimut/core-model';
import { countPdfPaintedPaths } from '../domain/pdf-painted-paths.js';
import { countDxfGeometry, looksLikeTextDxf } from '../domain/dxf-geometry.js';

/**
 * M2 (partie M), version 27 — la précision d'un fond de plan, jugée sur son
 * contenu.
 *
 * « Un fichier sans contenu vectoriel exploitable est accepté en dernier
 * recours et lève `IMPORT.RASTER_PRECISION_LIMITED`. Cela vise l'image en
 * mode point comme le PDF qui se présente comme vectoriel sans l'être : c'est
 * le contenu qui est contrôlé, jamais l'extension. »
 *
 * La nature du fichier se lit dans ses premiers octets, pas dans son nom ni
 * dans le type que le navigateur annonce. Un PNG renommé `.pdf` est une image
 * en mode point. Un PDF sans tracé peint est un plan numérisé. Ce qui ne se
 * lit pas, faute de savoir le décoder, n'est pas présumé vectoriel :
 * l'avertissement est levé et dit pourquoi.
 */

export type PlanContentKind = 'pdf' | 'dxf' | 'png' | 'jpeg' | 'unknown';

export type PlanPrecision =
  /** Tracés lus dans le contenu : aucune réserve. */
  | 'vector'
  /** Image en mode point, PNG ou JPEG. */
  | 'raster'
  /** PDF lu en entier, sans aucun tracé peint. */
  | 'pdf_without_paths'
  /** DXF lu en entier, sans aucune entité géométrique. */
  | 'dxf_without_geometry'
  /** Contenu non reconnu, ou flux que le produit ne sait pas décoder. */
  | 'undetermined';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // « %PDF- »

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/** La nature du fichier, lue dans ses octets. */
export function sniffPlanContent(bytes: Uint8Array): PlanContentKind {
  if (startsWith(bytes, PDF_SIGNATURE)) return 'pdf';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  if (looksLikeTextDxf(bytes) || new TextDecoder('latin1').decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF') {
    return 'dxf';
  }
  return 'unknown';
}

export async function judgePlanPrecision(bytes: Uint8Array): Promise<PlanPrecision> {
  switch (sniffPlanContent(bytes)) {
    case 'png':
    case 'jpeg':
      return 'raster';
    case 'pdf': {
      const paths = await countPdfPaintedPaths(bytes);
      if (paths.painted > 0) return 'vector';
      return paths.undecodable > 0 ? 'undetermined' : 'pdf_without_paths';
    }
    case 'dxf': {
      const geometry = countDxfGeometry(bytes);
      if (geometry.binary) return 'undetermined';
      return geometry.geometric > 0 ? 'vector' : 'dxf_without_geometry';
    }
    case 'unknown':
      return 'undetermined';
  }
}

/**
 * L'avertissement de précision limitée, ou rien. Il n'empêche ni le calage ni
 * la numérisation : « le calage et la numérisation restent possibles, avec
 * une précision moindre ».
 */
export async function planPrecisionWarnings(
  bytes: Uint8Array,
  fileName: string,
): Promise<readonly Finding[]> {
  const precision = await judgePlanPrecision(bytes);
  return precision === 'vector' ? [] : [precisionWarning(precision, fileName)];
}

/** Le fichier n'a pas pu être lu : rien n'établit qu'il soit vectoriel. */
export function unreadablePlanWarnings(fileName: string): readonly Finding[] {
  return [precisionWarning('undetermined', fileName)];
}

function precisionWarning(precision: Exclude<PlanPrecision, 'vector'>, fileName: string): Finding {
  return {
    code: 'IMPORT.RASTER_PRECISION_LIMITED',
    severity: 'warning',
    entity: null,
    params: { content: precision, file: fileName },
    ruleRef: 'partieM-M2',
  };
}

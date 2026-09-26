import type { Finding, PlanContentKind } from '@azimut/core-model';
import { countPdfPaintedPaths } from '../domain/pdf-painted-paths.js';
import { countPdfPages } from '../domain/pdf-pages.js';
import { countDxfGeometry, looksLikeTextDxf } from '../domain/dxf-geometry.js';
import type { PlanFormatKey } from './plan-import.js';

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
 * en mode point. Un PDF sans tracé peint est un plan numérisé. Un format
 * reconnu dont un flux ne se décode pas n'est pas présumé vectoriel :
 * l'avertissement est levé et dit pourquoi. Un contenu qui n'est aucun des
 * formats acceptés est refusé par `acceptPlanFile` (version 28).
 */

export type PlanPrecision =
  /** Tracés lus dans le contenu : aucune réserve. */
  | 'vector'
  /** Image en mode point, PNG ou JPEG. */
  | 'raster'
  /** PDF lu en entier, sans aucun tracé peint. */
  | 'pdf_without_paths'
  /** DXF lu en entier, sans aucune entité géométrique. */
  | 'dxf_without_geometry'
  /** Format reconnu, mais flux que le produit ne sait pas décoder. */
  | 'undetermined';

/** Ce que le contenu d'un fichier dit de lui, lu dans ses octets. */
export type PlanInspection = {
  /** Le format lu dans le contenu ; `null` s'il n'est aucun des formats acceptés. */
  readonly format: PlanFormatKey | null;
  readonly precision: PlanPrecision;
  /** Le nombre de pages d'un PDF ; `null` pour un autre format, ou s'il ne se lit pas. */
  readonly pageCount: number | null;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // « %PDF- »

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Le format du fichier, lu dans ses octets. Version 28 : « Le format se juge
 * sur le contenu, jamais sur l'extension ni sur le type annoncé. » Un DWG, dont
 * le contenu commence par `AC10`, n'est aucun des formats acceptés.
 */
export function sniffPlanFormat(bytes: Uint8Array): PlanFormatKey | null {
  if (startsWith(bytes, PDF_SIGNATURE)) return 'pdf';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpg';
  if (looksLikeTextDxf(bytes) || new TextDecoder('latin1').decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF') {
    return 'dxf';
  }
  return null;
}

export async function inspectPlanContent(bytes: Uint8Array): Promise<PlanInspection> {
  const format = sniffPlanFormat(bytes);
  switch (format) {
    case 'png':
    case 'jpg':
      return { format, precision: 'raster', pageCount: null };
    case 'pdf': {
      const paths = await countPdfPaintedPaths(bytes);
      const precision = paths.painted > 0 ? 'vector' : paths.undecodable > 0 ? 'undetermined' : 'pdf_without_paths';
      return { format, precision, pageCount: await countPdfPages(bytes) };
    }
    case 'dxf': {
      const geometry = countDxfGeometry(bytes);
      const precision = geometry.binary ? 'undetermined' : geometry.geometric > 0 ? 'vector' : 'dxf_without_geometry';
      return { format, precision, pageCount: null };
    }
    case null:
      return { format, precision: 'undetermined', pageCount: null };
  }
}

/**
 * La nature du contenu enregistrée sur la source de plan (A5.2). Un fond lu
 * sans aucun tracé n'a pas de contenu vectoriel : il est `raster`, qu'il soit
 * une image, un PDF numérisé ou un DXF sans entité géométrique.
 */
export function contentKindOf(precision: PlanPrecision): PlanContentKind {
  switch (precision) {
    case 'vector': return 'vector';
    case 'undetermined': return 'undetermined';
    case 'raster':
    case 'pdf_without_paths':
    case 'dxf_without_geometry':
      return 'raster';
  }
}

/**
 * L'avertissement de précision limitée, ou rien. Il n'empêche ni le calage ni
 * la numérisation : « le calage et la numérisation restent possibles, avec
 * une précision moindre ».
 */
export function planPrecisionWarnings(precision: PlanPrecision, fileName: string): readonly Finding[] {
  return precision === 'vector' ? [] : [precisionWarning(precision, fileName)];
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

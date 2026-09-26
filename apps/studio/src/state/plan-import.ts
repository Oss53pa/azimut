/**
 * M2 (partie M), étape 1 — le fond de plan.
 *
 * « Fichier | dépôt ou sélection | PDF vectoriel, DXF, PNG, JPG. 60 Mo maximum |
 * `IMPORT.FILE_TOO_LARGE`, `IMPORT.FORMAT_UNSUPPORTED` »
 * « Page | sélecteur | si PDF multipage, requis | `IMPORT.PAGE_REQUIRED` »
 * « Le DWG n'est pas accepté. »
 * Version 28 : « Le format se juge sur le contenu, jamais sur l'extension ni
 * sur le type annoncé. Un fichier dont le contenu ne correspond à aucun des
 * formats acceptés est refusé. »
 *
 * Les deux valeurs que M2 (partie M) donne — quatre formats, 60 Mo — sont des contraintes
 * d'interface et non des valeurs d'origine normative : elles bornent ce que le
 * poste accepte de téléverser, elles ne décident d'aucune conformité. Elles
 * restent donc ici, nommées, et non dans un paquet de règles (INV-5).
 */
import type { Finding, Outcome, PlanContentKind } from '@azimut/core-model';
import { contentKindOf, planPrecisionWarnings, precisionOfPage } from './plan-content.js';
import type { PlanInspection } from './plan-content.js';

/** M2 (partie M) : « 60 Mo maximum ». */
export const MAX_PLAN_BYTES = 60 * 1024 * 1024;

/**
 * M2 (partie M) : « PDF vectoriel, DXF, PNG, JPG ». Chaque format porte le type
 * de média que le produit enregistre : celui du contenu reconnu, et non celui
 * que le navigateur annonce. Qu'un PDF soit vectoriel se juge sur ses tracés
 * (`plan-content.ts`), et non sur son format.
 */
export const ACCEPTED_PLAN_FORMATS = [
  { key: 'pdf', mediaType: 'application/pdf' },
  { key: 'png', mediaType: 'image/png' },
  { key: 'jpg', mediaType: 'image/jpeg' },
  { key: 'dxf', mediaType: 'image/vnd.dxf' },
] as const;

export type PlanFormatKey = (typeof ACCEPTED_PLAN_FORMATS)[number]['key'];

/**
 * Ce que l'écran sait du fichier déposé. Ni son extension ni son type annoncé
 * n'y figurent : le contenu seul en décide, par `PlanInspection`.
 */
export type PlanFile = {
  readonly name: string;
  readonly byteSize: number;
  /** Page retenue, une fois choisie. */
  readonly page: number | null;
};

export type AcceptedPlan = {
  readonly format: PlanFormatKey;
  readonly mediaType: string;
  readonly byteSize: number;
  /** La page retenue, ou 1 pour un document d'une seule page. */
  readonly page: number;
  /** A5.2 : la nature du contenu, enregistrée sur la source de plan. */
  readonly contentKind: PlanContentKind;
};

/**
 * Juge un fichier déposé sur son contenu. Rend toutes les anomalies ensemble :
 * M7.5 (partie M) veut qu'un refus n'efface pas le travail en cours, et
 * découvrir les défauts un par un ferait reprendre le dépôt autant de fois.
 *
 * Un fond accepté porte, en avertissement, `IMPORT.RASTER_PRECISION_LIMITED`
 * quand son contenu n'a pas de tracé lisible. Version 29 : c'est la page
 * retenue qui en décide, et non le fichier entier.
 */
export function acceptPlanFile(file: PlanFile, inspection: PlanInspection): Outcome<AcceptedPlan> {
  const findings: Finding[] = [];

  if (inspection.format === null) {
    findings.push(finding('IMPORT.FORMAT_UNSUPPORTED', {
      accepted: ACCEPTED_PLAN_FORMATS.map(f => f.key).join(','),
    }));
  }

  if (file.byteSize > MAX_PLAN_BYTES) {
    findings.push(finding('IMPORT.FILE_TOO_LARGE', {
      bytes: file.byteSize,
      maximum: MAX_PLAN_BYTES,
    }));
  }

  findings.push(...pageFindings(file.page, inspection.pageCount));

  if (findings.length > 0 || inspection.format === null) {
    return { ok: false, findings };
  }

  const page = file.page ?? 1;
  const precision = precisionOfPage(inspection, page);
  return {
    ok: true,
    value: {
      format: inspection.format,
      mediaType: mediaTypeOf(inspection.format),
      byteSize: file.byteSize,
      page,
      contentKind: contentKindOf(precision),
    },
    warnings: [...planPrecisionWarnings(precision, file.name)],
  };
}

/**
 * « Si PDF multipage, requis. » Un document d'une seule page n'a pas de page
 * à choisir, et la demander serait une question sans objet.
 */
function pageFindings(page: number | null, pageCount: number | null): Finding[] {
  if (pageCount === null || pageCount <= 1) return [];
  if (page === null) return [finding('IMPORT.PAGE_REQUIRED', { pages: pageCount })];
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    return [finding('IMPORT.PAGE_REQUIRED', { given: page, pages: pageCount })];
  }
  return [];
}

function mediaTypeOf(format: PlanFormatKey): string {
  return ACCEPTED_PLAN_FORMATS.find(f => f.key === format)?.mediaType ?? 'application/octet-stream';
}

/**
 * Le fichier n'a pas pu être lu : aucun contenu n'a été reconnu, et un
 * contenu qui ne correspond à aucun format accepté est refusé.
 */
export function unreadablePlanInspection(): PlanInspection {
  return { format: null, pageCount: null, pages: [] };
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: 'partieM-M2 (partie M)' };
}

// ---------------------------------------------------------------------------
// M2 (partie M) — remplacer le fond
// ---------------------------------------------------------------------------

/**
 * « Remplacer le fond | Conserve le calage si les dimensions concordent,
 * sinon avertit et propose de recaler. »
 *
 * Et, en toutes lettres : « Remplacer un fond sans recaler est le geste qui
 * décale silencieusement toute une modélisation. Il demande donc une
 * confirmation nommant la conséquence. » C'est M7.9 (partie M) appliqué au cas
 * le plus coûteux de la tranche.
 */
export type PlanDimensions = {
  readonly widthPx: number;
  readonly heightPx: number;
};

export type ReplacementVerdict =
  /** Les dimensions concordent : le calage tient, la confirmation reste due. */
  | { readonly kind: 'keeps_calibration'; readonly consequence: 'calibration_kept' }
  /** Les dimensions diffèrent : le calage ne peut pas être conservé. */
  | { readonly kind: 'requires_recalibration'; readonly consequence: 'calibration_lost' };

/**
 * Ce que produit un remplacement de fond, avant toute écriture.
 *
 * La fonction ne décide pas d'agir : elle dit ce qui arrivera, pour que la
 * confirmation puisse le nommer. Un remplacement n'est jamais silencieux, même
 * quand les dimensions concordent — l'utilisateur doit savoir que le calage
 * d'un fond a été reporté sur un autre.
 */
export function judgeReplacement(
  current: PlanDimensions,
  replacement: PlanDimensions,
): ReplacementVerdict {
  const same = current.widthPx === replacement.widthPx
    && current.heightPx === replacement.heightPx;
  return same
    ? { kind: 'keeps_calibration', consequence: 'calibration_kept' }
    : { kind: 'requires_recalibration', consequence: 'calibration_lost' };
}

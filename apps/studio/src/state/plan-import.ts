/**
 * M2 (partie M), étape 1 — le fond de plan.
 *
 * « Fichier | dépôt ou sélection | PDF, PNG, JPG, DWG. 60 Mo maximum |
 * `IMPORT.FILE_TOO_LARGE`, `IMPORT.FORMAT_UNSUPPORTED` »
 * « Page | sélecteur | si PDF multipage, requis | `IMPORT.PAGE_REQUIRED` »
 *
 * Les deux valeurs que M2 (partie M) donne — quatre formats, 60 Mo — sont des contraintes
 * d'interface et non des valeurs d'origine normative : elles bornent ce que le
 * poste accepte de téléverser, elles ne décident d'aucune conformité. Elles
 * restent donc ici, nommées, et non dans un paquet de règles (INV-5).
 */
import type { Finding, Outcome } from '@azimut/core-model';

/** M2 (partie M) : « 60 Mo maximum ». */
export const MAX_PLAN_BYTES = 60 * 1024 * 1024;

/**
 * M2 (partie M) : « PDF, PNG, JPG, DWG ». Le type est jugé sur le type de média quand le
 * navigateur en donne un, sur l'extension sinon — un DWG n'a pas de type de
 * média enregistré, et beaucoup de navigateurs rendent une chaîne vide.
 */
export const ACCEPTED_PLAN_FORMATS = [
  { key: 'pdf', mediaTypes: ['application/pdf'], extensions: ['.pdf'] },
  { key: 'png', mediaTypes: ['image/png'], extensions: ['.png'] },
  { key: 'jpg', mediaTypes: ['image/jpeg'], extensions: ['.jpg', '.jpeg'] },
  { key: 'dwg', mediaTypes: ['image/vnd.dwg', 'application/acad'], extensions: ['.dwg'] },
] as const;

export type PlanFormatKey = (typeof ACCEPTED_PLAN_FORMATS)[number]['key'];

/** Ce que l'écran sait du fichier déposé. */
export type PlanFile = {
  readonly name: string;
  readonly byteSize: number;
  /** Type de média, éventuellement vide : le navigateur ne le donne pas toujours. */
  readonly mediaType: string;
  /**
   * Nombre de pages, pour un PDF. `null` quand le fichier n'est pas paginé ou
   * que le compte n'est pas encore connu.
   */
  readonly pageCount: number | null;
  /** Page retenue, une fois choisie. */
  readonly page: number | null;
};

export type AcceptedPlan = {
  readonly format: PlanFormatKey;
  readonly mediaType: string;
  readonly byteSize: number;
  /** La page retenue, ou 1 pour un document d'une seule page. */
  readonly page: number;
};

/**
 * Juge un fichier déposé. Rend toutes les anomalies ensemble : M7.5 (partie M)
 * veut qu'un refus n'efface pas le travail en cours, et découvrir les défauts
 * un par un ferait reprendre le dépôt autant de fois.
 */
export function acceptPlanFile(file: PlanFile): Outcome<AcceptedPlan> {
  const findings: Finding[] = [];

  const format = formatOf(file);
  if (format === null) {
    findings.push(finding('IMPORT.FORMAT_UNSUPPORTED', {
      given: file.mediaType === '' ? extensionOf(file.name) : file.mediaType,
      accepted: ACCEPTED_PLAN_FORMATS.map(f => f.key).join(','),
    }));
  }

  if (file.byteSize > MAX_PLAN_BYTES) {
    findings.push(finding('IMPORT.FILE_TOO_LARGE', {
      bytes: file.byteSize,
      maximum: MAX_PLAN_BYTES,
    }));
  }

  // « Si PDF multipage, requis. » Un document d'une seule page n'a pas de page
  // à choisir, et la demander serait une question sans objet.
  const multipage = file.pageCount !== null && file.pageCount > 1;
  if (multipage && file.page === null) {
    findings.push(finding('IMPORT.PAGE_REQUIRED', { pages: file.pageCount ?? 0 }));
  }
  if (multipage && file.page !== null
      && (file.page < 1 || file.page > (file.pageCount ?? 0))) {
    findings.push(finding('IMPORT.PAGE_REQUIRED', {
      given: file.page,
      pages: file.pageCount ?? 0,
    }));
  }

  if (findings.length > 0 || format === null) {
    return { ok: false, findings };
  }

  return {
    ok: true,
    value: {
      format,
      mediaType: file.mediaType === '' ? defaultMediaType(format) : file.mediaType,
      byteSize: file.byteSize,
      page: file.page ?? 1,
    },
    warnings: [],
  };
}

function formatOf(file: PlanFile): PlanFormatKey | null {
  const extension = extensionOf(file.name);
  for (const candidate of ACCEPTED_PLAN_FORMATS) {
    const byMediaType = file.mediaType !== ''
      && (candidate.mediaTypes as readonly string[]).includes(file.mediaType);
    const byExtension = (candidate.extensions as readonly string[]).includes(extension);
    if (byMediaType || byExtension) return candidate.key;
  }
  return null;
}

function defaultMediaType(format: PlanFormatKey): string {
  const found = ACCEPTED_PLAN_FORMATS.find(f => f.key === format);
  return found?.mediaTypes[0] ?? 'application/octet-stream';
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
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

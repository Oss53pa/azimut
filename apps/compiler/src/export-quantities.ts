import type { SiteData } from '@azimut/core-model';
import {
  computeQuantities,
  quantityReportToCsv,
} from '@azimut/engine-graph';
import type { PlacedSupport, CsvLang } from '@azimut/engine-graph';
import type { Job } from './job.js';

export type ExportQuantitiesContext = {
  readonly site: SiteData;
};

export type ExportQuantitiesResult = {
  readonly total_supports: number;
  readonly total_faces: number;
  readonly cross_check_ok: boolean;
  readonly csv_length: number;
  readonly lang: CsvLang;
};

/**
 * Les supports du travail. T-2.13 : « les totaux se recoupent avec le nombre
 * de supports en base. Écart nul exigé, pas toléré. » Une entrée mal formée
 * n'est donc pas écartée — le total paraîtrait juste en en ayant perdu une —,
 * elle fait échouer le travail entier, qui dit combien il en a refusé.
 */
function parsePlacedSupports(raw: unknown): PlacedSupport[] {
  if (!Array.isArray(raw)) throw new Error('export_quantities : liste des supports absente');
  const result: PlacedSupport[] = [];
  let refused = 0;
  for (const item of raw) {
    const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : null;
    const id = record?.['id'];
    const nodeId = record?.['node_id'];
    const typeKey = record?.['support_type_key'];
    if (typeof id === 'string' && typeof nodeId === 'string' && typeof typeKey === 'string') {
      result.push({ id, node_id: nodeId, support_type_key: typeKey });
    } else {
      refused += 1;
    }
  }
  if (refused > 0) {
    throw new Error(`export_quantities : ${String(refused)} support(s) mal formé(s), aucun total produit`);
  }
  return result;
}

function parseLang(raw: unknown): CsvLang {
  if (raw === 'en') return 'en';
  return 'fr';
}

/**
 * Create a job handler for `export_quantities`.
 *
 * Payload:
 *   - supports: PlacedSupport[] — list of placed supports
 *   - lang?: 'fr' | 'en' — CSV language (default 'fr')
 *
 * Result:
 *   - total_supports, total_faces, cross_check_ok, csv_length, lang
 *   - csv: the full CSV string
 */
export function createExportQuantitiesHandler(
  context: ExportQuantitiesContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site } = context;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const supports = parsePlacedSupports(payload['supports']);
    const lang = parseLang(payload['lang']);

    const result = computeQuantities(site, supports);

    if (!result.ok) {
      const codes = result.findings.map((f) => f.code).join(', ');
      throw new Error(`Quantity computation failed: ${codes}`);
    }

    const report = result.value;
    const csv = quantityReportToCsv(report, lang);

    return {
      total_supports: report.total_supports,
      total_faces: report.total_faces,
      cross_check_ok: report.cross_check_ok,
      csv_length: csv.length,
      csv,
      lang,
    };
  };
}

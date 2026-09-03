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

function parsePlacedSupports(
  raw: unknown,
): PlacedSupport[] {
  if (!Array.isArray(raw)) return [];
  const result: PlacedSupport[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>)['id'] === 'string' &&
      typeof (item as Record<string, unknown>)['node_id'] === 'string' &&
      typeof (item as Record<string, unknown>)['support_type_key'] === 'string'
    ) {
      result.push({
        id: (item as Record<string, unknown>)['id'] as string,
        node_id: (item as Record<string, unknown>)['node_id'] as string,
        support_type_key: (item as Record<string, unknown>)['support_type_key'] as string,
      });
    }
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

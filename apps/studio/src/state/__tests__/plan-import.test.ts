import { describe, it, expect } from 'vitest';
import {
  acceptPlanFile, judgeReplacement, MAX_PLAN_BYTES, ACCEPTED_PLAN_FORMATS, unreadablePlanInspection,
} from '../plan-import.js';
import type { PlanFile } from '../plan-import.js';
import { inspectPlanContent } from '../plan-content.js';
import type { PlanInspection } from '../plan-content.js';
import { latin1, onePagePdf, plain } from './pdf-fixtures.js';

function file(over: Partial<PlanFile> = {}): PlanFile {
  return { name: 'niveau-0.pdf', byteSize: 1024, page: null, ...over };
}

function inspection(over: Partial<PlanInspection> = {}): PlanInspection {
  return { format: 'pdf', pageCount: 1, pages: ['vector'], ...over };
}

function codes(over: Partial<PlanFile> = {}, seen: Partial<PlanInspection> = {}): string[] {
  const r = acceptPlanFile(file(over), inspection(seen));
  return r.ok ? [] : r.findings.map(f => f.code);
}

/** Juge un fichier sur ses octets, comme l'écran le fait. */
async function judgeBytes(name: string, bytes: Uint8Array) {
  return acceptPlanFile(file({ name, byteSize: bytes.length }), await inspectPlanContent(bytes));
}

const VECTOR_PDF = onePagePdf([plain('0 0 m 100 0 l S')]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const DXF = latin1(['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', 'c', '0', 'ENDSEC', '0', 'EOF'].join('\n'));
/** L'en-tête d'un DWG : un format que M2 (partie M) n'accepte pas. */
const DWG = latin1('AC1032\0\0\0\0\0');
const SVG = latin1('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

/**
 * M2 (partie M), étape 1 — « Fichier : PDF vectoriel, DXF, PNG, JPG. 60 Mo
 * maximum ». « Le DWG n'est pas accepté. » Version 28 : « Le format se juge
 * sur le contenu, jamais sur l'extension ni sur le type annoncé. »
 */
describe('M2 (partie M) — import du fond de plan', () => {
  describe('format, jugé sur le contenu', () => {
    it('accepte les quatre formats que M2 (partie M) nomme, lus dans leurs octets', async () => {
      for (const [name, bytes, key] of [
        ['a.pdf', VECTOR_PDF, 'pdf'], ['a.png', PNG, 'png'], ['a.jpg', JPEG, 'jpg'], ['a.dxf', DXF, 'dxf'],
      ] as const) {
        const r = await judgeBytes(name, bytes);
        expect(r.ok, key).toBe(true);
        if (r.ok) expect(r.value.format).toBe(key);
      }
    });

    it('les formats acceptés sont exactement ceux que M2 (partie M) nomme', () => {
      expect(ACCEPTED_PLAN_FORMATS.map(f => f.key)).toEqual(['pdf', 'png', 'jpg', 'dxf']);
    });

    it('refuse un contenu qui n’est aucun des quatre formats', async () => {
      for (const [name, bytes] of [['plan.svg', SVG], ['plan.pdf', SVG], ['plan.bin', latin1('PK\x03\x04')]] as const) {
        const r = await judgeBytes(name, bytes);
        expect(r.ok ? [] : r.findings.map(f => f.code), name).toEqual(['IMPORT.FORMAT_UNSUPPORTED']);
      }
    });

    /** Version 26 : « Le DWG n'est pas accepté. » Son contenu le dit, quel que soit son nom. */
    it('refuse un DWG, qu’il soit nommé .dwg ou .dxf', async () => {
      for (const name of ['plan.dwg', 'plan.dxf', 'plan.pdf']) {
        const r = await judgeBytes(name, DWG);
        expect(r.ok ? [] : r.findings.map(f => f.code), name).toEqual(['IMPORT.FORMAT_UNSUPPORTED']);
      }
    });

    it('le nom ne décide pas : un PDF nommé .png est un PDF', async () => {
      const r = await judgeBytes('plan.png', VECTOR_PDF);
      expect(r.ok).toBe(true);
      if (r.ok) expect([r.value.format, r.value.mediaType]).toEqual(['pdf', 'application/pdf']);
    });

    it('un fichier illisible n’est reconnu comme aucun format', () => {
      expect(acceptPlanFile(file(), unreadablePlanInspection()).ok).toBe(false);
    });
  });

  describe('nature du contenu (A5.2)', () => {
    it('un fond vectoriel est enregistré vectoriel, sans avertissement', () => {
      const r = acceptPlanFile(file(), inspection({ pages: ['vector'] }));
      expect(r.ok).toBe(true);
      if (r.ok) expect([r.value.contentKind, r.warnings]).toEqual(['vector', []]);
    });

    it('un fond sans tracé est accepté, enregistré sans contenu vectoriel, et averti', () => {
      for (const precision of ['raster', 'pdf_without_paths', 'dxf_without_geometry'] as const) {
        const r = acceptPlanFile(file(), inspection({ pages: [precision] }));
        expect(r.ok, precision).toBe(true);
        if (!r.ok) continue;
        expect(r.value.contentKind).toBe('raster');
        expect(r.warnings.map(w => w.code)).toEqual(['IMPORT.RASTER_PRECISION_LIMITED']);
      }
    });

    it('le cas indéterminé est accepté, jamais présumé vectoriel', () => {
      const r = acceptPlanFile(file(), inspection({ pages: ['undetermined'] }));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.contentKind).toBe('undetermined');
      expect(r.warnings.map(w => w.params['content'])).toEqual(['undetermined']);
    });

    /**
     * Version 29 — « la nature se juge sur la page retenue » : les tracés
     * d'une autre page ne masquent pas leur absence sur celle-ci.
     */
    it('la nature est celle de la page retenue', () => {
      const seen = inspection({ pageCount: 2, pages: ['vector', 'pdf_without_paths'] });
      const second = acceptPlanFile(file({ page: 2 }), seen);
      const first = acceptPlanFile(file({ page: 1 }), seen);
      expect(second.ok && [second.value.contentKind, second.warnings.map(w => w.params['content'])])
        .toEqual(['raster', ['pdf_without_paths']]);
      expect(first.ok && [first.value.contentKind, first.warnings]).toEqual(['vector', []]);
    });

    it('une page que le suivi n’a pas atteinte est indéterminée, jamais vectorielle', () => {
      const r = acceptPlanFile(file({ page: 3 }), inspection({ pageCount: 3, pages: ['vector', 'vector'] }));
      expect(r.ok && r.value.contentKind).toBe('undetermined');
      const unwalked = acceptPlanFile(file(), inspection({ pageCount: 1, pages: [] }));
      expect(unwalked.ok && unwalked.value.contentKind).toBe('undetermined');
    });
  });

  describe('taille', () => {
    it('accepte la borne exacte de 60 Mo', () => {
      expect(acceptPlanFile(file({ byteSize: MAX_PLAN_BYTES }), inspection()).ok).toBe(true);
    });

    it('refuse un octet au-delà', () => {
      expect(codes({ byteSize: MAX_PLAN_BYTES + 1 })).toContain('IMPORT.FILE_TOO_LARGE');
    });
  });

  describe('page', () => {
    it('n’en demande pas pour un document d’une seule page', () => {
      expect(acceptPlanFile(file(), inspection({ pageCount: 1 })).ok).toBe(true);
    });

    it('en exige une pour un PDF multipage', () => {
      expect(codes({ page: null }, { pageCount: 12 })).toEqual(['IMPORT.PAGE_REQUIRED']);
    });

    it('refuse une page hors du document', () => {
      expect(codes({ page: 13 }, { pageCount: 12 })).toEqual(['IMPORT.PAGE_REQUIRED']);
      expect(codes({ page: 0 }, { pageCount: 12 })).toEqual(['IMPORT.PAGE_REQUIRED']);
      expect(codes({ page: 2.5 }, { pageCount: 12 })).toEqual(['IMPORT.PAGE_REQUIRED']);
    });

    it('retient la page choisie', () => {
      const r = acceptPlanFile(file({ page: 4 }), inspection({ pageCount: 12 }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.page).toBe(4);
    });

    it('retient la première page d’un document qui n’en a qu’une', () => {
      const r = acceptPlanFile(file(), inspection({ pageCount: 1 }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.page).toBe(1);
    });
  });

  /**
   * M7.5 (partie M) — « Un refus de saisie n'efface jamais le travail en
   * cours. » Découvrir les défauts un par un ferait reprendre le dépôt autant
   * de fois.
   */
  it('rend toutes les anomalies ensemble', () => {
    const all = codes({ byteSize: MAX_PLAN_BYTES + 1, page: null }, { format: null, pageCount: 9 });
    expect(all).toEqual(['IMPORT.FORMAT_UNSUPPORTED', 'IMPORT.FILE_TOO_LARGE', 'IMPORT.PAGE_REQUIRED']);
  });
});

/**
 * M2 (partie M) — « Remplacer un fond sans recaler est le geste qui décale
 * silencieusement toute une modélisation. Il demande donc une confirmation
 * nommant la conséquence. » C'est M7.9 (partie M) au cas le plus coûteux de la
 * tranche, et le critère d'acceptation 5 de l'écran.
 */
describe('M2 (partie M) — remplacer le fond', () => {
  const A = { widthPx: 2480, heightPx: 3508 };

  it('conserve le calage quand les dimensions concordent', () => {
    const verdict = judgeReplacement(A, { ...A });
    expect(verdict.kind).toBe('keeps_calibration');
  });

  it('exige un recalage quand elles diffèrent', () => {
    expect(judgeReplacement(A, { widthPx: 2481, heightPx: 3508 }).kind)
      .toBe('requires_recalibration');
    expect(judgeReplacement(A, { widthPx: 2480, heightPx: 3509 }).kind)
      .toBe('requires_recalibration');
  });

  /**
   * La conséquence est nommée dans les deux cas. Conserver le calage d'un fond
   * sur un autre n'est pas anodin : l'utilisateur doit le savoir, sans quoi le
   * geste reste silencieux, ce que M2 (partie M) nomme précisément comme le danger.
   */
  it('nomme la conséquence dans les deux cas', () => {
    expect(judgeReplacement(A, { ...A }).consequence).toBe('calibration_kept');
    expect(judgeReplacement(A, { widthPx: 1, heightPx: 1 }).consequence)
      .toBe('calibration_lost');
  });
});

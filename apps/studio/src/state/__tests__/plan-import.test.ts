import { describe, it, expect } from 'vitest';
import { acceptPlanFile, judgeReplacement, MAX_PLAN_BYTES, ACCEPTED_PLAN_FORMATS } from '../plan-import.js';
import type { PlanFile } from '../plan-import.js';

function file(over: Partial<PlanFile> = {}): PlanFile {
  return {
    name: 'niveau-0.pdf',
    byteSize: 1024,
    mediaType: 'application/pdf',
    pageCount: 1,
    page: null,
    ...over,
  };
}

function codes(over: Partial<PlanFile> = {}): string[] {
  const r = acceptPlanFile(file(over));
  return r.ok ? [] : r.findings.map(f => f.code);
}

/**
 * M2 (partie M), étape 1 — « Fichier : PDF, PNG, JPG, DWG. 60 Mo maximum ».
 */
describe('M2 (partie M) — import du fond de plan', () => {
  describe('format', () => {
    it('accepte les quatre formats que M2 (partie M) nomme', () => {
      for (const format of ACCEPTED_PLAN_FORMATS) {
        const r = acceptPlanFile(file({
          name: `plan${format.extensions[0]}`,
          mediaType: format.mediaTypes[0],
        }));
        expect(r.ok, format.key).toBe(true);
      }
    });

    it('refuse un format hors des quatre', () => {
      expect(codes({ name: 'plan.svg', mediaType: 'image/svg+xml' }))
        .toContain('IMPORT.FORMAT_UNSUPPORTED');
    });

    /**
     * Un DWG n'a pas de type de média enregistré et beaucoup de navigateurs
     * rendent une chaîne vide. Le refuser pour cette raison rejetterait le
     * format que les bureaux d'études emploient le plus.
     */
    it('reconnaît un fichier dont le navigateur ne donne pas le type', () => {
      expect(acceptPlanFile(file({ name: 'plan.dwg', mediaType: '' })).ok).toBe(true);
    });

    it('reconnaît l’extension quelle que soit sa casse', () => {
      expect(acceptPlanFile(file({ name: 'PLAN.PNG', mediaType: '' })).ok).toBe(true);
    });

    it('accepte les deux extensions du JPEG', () => {
      expect(acceptPlanFile(file({ name: 'a.jpeg', mediaType: '' })).ok).toBe(true);
      expect(acceptPlanFile(file({ name: 'a.jpg', mediaType: '' })).ok).toBe(true);
    });
  });

  describe('taille', () => {
    it('accepte la borne exacte de 60 Mo', () => {
      expect(acceptPlanFile(file({ byteSize: MAX_PLAN_BYTES })).ok).toBe(true);
    });

    it('refuse un octet au-delà', () => {
      expect(codes({ byteSize: MAX_PLAN_BYTES + 1 })).toContain('IMPORT.FILE_TOO_LARGE');
    });
  });

  describe('page', () => {
    it('n’en demande pas pour un document d’une seule page', () => {
      expect(acceptPlanFile(file({ pageCount: 1, page: null })).ok).toBe(true);
    });

    it('en exige une pour un PDF multipage', () => {
      expect(codes({ pageCount: 12, page: null })).toContain('IMPORT.PAGE_REQUIRED');
    });

    it('refuse une page hors du document', () => {
      expect(codes({ pageCount: 12, page: 13 })).toContain('IMPORT.PAGE_REQUIRED');
      expect(codes({ pageCount: 12, page: 0 })).toContain('IMPORT.PAGE_REQUIRED');
    });

    it('retient la page choisie', () => {
      const r = acceptPlanFile(file({ pageCount: 12, page: 4 }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.page).toBe(4);
    });

    it('retient la première page d’un document qui n’en a qu’une', () => {
      const r = acceptPlanFile(file({ pageCount: 1, page: null }));
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
    const all = codes({
      name: 'plan.svg', mediaType: 'image/svg+xml',
      byteSize: MAX_PLAN_BYTES + 1, pageCount: 9, page: null,
    });
    expect(all).toContain('IMPORT.FORMAT_UNSUPPORTED');
    expect(all).toContain('IMPORT.FILE_TOO_LARGE');
    expect(all).toContain('IMPORT.PAGE_REQUIRED');
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

/**
 * Le décor partagé des essais de rendu SVG vers PDF : couleurs prises des
 * jetons de thème, date fixe, et rendu d'une page relue en octets. Réparti
 * entre plusieurs fichiers d'essais pour tenir la limite de 400 lignes (A2.4).
 */
import { PDFDocument } from 'pdf-lib';
import { renderSvgToPage } from '../svg-to-pdf.js';
import { themePapier, stateColors } from '@azimut/design-tokens';

const MM_TO_PT = 72 / 25.4;

// Use tokens as test colors so we don't introduce hardcoded hex (A2.4).
export const FG = themePapier['text-primary'];
export const FG2 = themePapier['text-secondary'];
export const ACCENT = themePapier['accent'];
export const ACCENT2 = themePapier['accent-secondary'];
export const BORDER = themePapier['border-hairline'];
export const ERR = stateColors['state-blocking'];
export const WARN = stateColors['state-warning'];
export const OK = stateColors['state-valid'];

/**
 * Fixed date, as the production export requires from its caller
 * (export-pdf.ts takes `creation_date`). Without it pdf-lib stamps the
 * wall clock into CreationDate and ModDate at second granularity, and
 * two renders straddling a tick differ on those bytes alone — which
 * made the determinism test below measure the clock instead of the
 * renderer, and fail intermittently.
 */
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export async function renderAndExtract(svg: string, widthMm = 200, heightMm = 100) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const widthPt = widthMm * MM_TO_PT;
  const heightPt = heightMm * MM_TO_PT;
  const page = doc.addPage([widthPt, heightPt]);
  renderSvgToPage(page, svg, widthPt, heightPt);
  const bytes = await doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    objectsPerTick: Infinity,
  });
  return { bytes, page };
}

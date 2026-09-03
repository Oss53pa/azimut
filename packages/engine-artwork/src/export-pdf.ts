import { PDFDocument, PDFName, PDFString, PDFArray, PDFHexString } from 'pdf-lib';
import { renderSvgToPage } from './svg-to-pdf.js';

export type PdfTarget = 'pdf-x4' | 'pdf-a';

export type ExportPdfOptions = {
  svg: string;
  target: PdfTarget;
  title: string;
  width_mm: number;
  height_mm: number;
  creation_date: Date;
};

const MM_TO_PT = 72 / 25.4;

export async function exportArtworkPdf(
  options: ExportPdfOptions,
): Promise<Uint8Array> {
  const { svg, target, title, width_mm, height_mm, creation_date } = options;

  const widthPt = width_mm * MM_TO_PT;
  const heightPt = height_mm * MM_TO_PT;

  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreationDate(creation_date);
  doc.setModificationDate(creation_date);
  doc.setProducer('Azimut/engine-artwork');
  doc.setCreator('Azimut');

  const page = doc.addPage([widthPt, heightPt]);

  renderSvgToPage(page, svg, widthPt, heightPt);

  applyConformanceMetadata(doc, target, title);

  return doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    objectsPerTick: Infinity,
  });
}

function applyConformanceMetadata(
  doc: PDFDocument,
  target: PdfTarget,
  title: string,
): void {
  const catalog = doc.catalog;

  if (target === 'pdf-x4') {
    const outputIntentDict = doc.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFX'),
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
    });
    const ref = doc.context.register(outputIntentDict);
    catalog.set(PDFName.of('OutputIntents'), doc.context.obj([ref]));

    const markInfoDict = doc.context.obj({
      Marked: true,
    });
    catalog.set(PDFName.of('MarkInfo'), markInfoDict);
  }

  if (target === 'pdf-a') {
    const outputIntentDict = doc.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
    });
    const ref = doc.context.register(outputIntentDict);
    catalog.set(PDFName.of('OutputIntents'), doc.context.obj([ref]));
  }

  const idHash = PDFHexString.of(
    Array.from(
      new TextEncoder().encode(`azimut-${target}-${title}`),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );
  catalog.set(PDFName.of('ID'), PDFArray.withContext(doc.context));
  const idArray = catalog.get(PDFName.of('ID')) as PDFArray;
  idArray.push(idHash);
  idArray.push(idHash);
}

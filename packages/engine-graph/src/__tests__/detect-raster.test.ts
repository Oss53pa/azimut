import { describe, it, expect } from 'vitest';
import { guardPictogramsVector } from '../detect-raster.js';

describe('J5.2 — guardPictogramsVector', () => {
  it('passes on pure vector pictograms', () => {
    const r = guardPictogramsVector([
      { id: 'p-exit', svg: '<svg><path d="M0 0L10 10Z"/></svg>' },
    ]);
    expect(r.ok).toBe(true);
  });

  it('blocks an <image> element', () => {
    const r = guardPictogramsVector([
      { id: 'p-bad', svg: '<svg><image href="x.png" /></svg>' },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('PICTO.RASTER_CONTENT');
    expect(r.findings[0]?.params['form']).toBe('image_element');
    expect(r.findings[0]?.ruleRef).toBe('J5.2');
  });

  it('blocks an embedded data:image URI', () => {
    const r = guardPictogramsVector([
      { id: 'p-b64', svg: '<svg><path fill="url(#p)" /><pattern><image xlink:href="data:image/png;base64,AAAA"/></pattern></svg>' },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // data_uri and image_element both present; first pattern (image_element) wins.
    expect(r.findings[0]?.code).toBe('PICTO.RASTER_CONTENT');
  });

  it('blocks an href to a raster file', () => {
    const r = guardPictogramsVector([
      { id: 'p-jpg', svg: '<svg><use href="photo.jpg" /></svg>' },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['form']).toBe('raster_href');
  });

  it('reports one finding per offending pictogram, sorted by id', () => {
    const r = guardPictogramsVector([
      { id: 'p-b', svg: '<svg><image /></svg>' },
      { id: 'p-a', svg: '<svg><path d="M0 0"/></svg>' },
      { id: 'p-c', svg: '<svg><rect fill="data:image/gif;base64,Z"/></svg>' },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['p-b', 'p-c']);
  });

  it('is a no-op for an empty list', () => {
    expect(guardPictogramsVector([]).ok).toBe(true);
  });
});

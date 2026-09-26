import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import {
  declareFaceCommand, updateFaceCommand, inverseCommand, supportFaceCount,
  type SiteData, type Support, type SupportFace,
} from '@azimut/core-model';
import { faceSlots } from '../face-slots.js';

const first = refMultilevel.supports[0];
if (first === undefined) throw new Error('jeu sans support');
const support: Support = first;
const ENV = { newId: () => 'face-new', timestamp: '2026-09-26T00:00:00.000Z' };
const FACE: SupportFace = { id: 'face-1', org_id: support.org_id, support_id: support.id, face_index: 0, langs: ['fr'] };

function withFaces(faces: readonly SupportFace[]): SiteData {
  return { ...refMultilevel, support_faces: faces };
}

describe('A5.6 — emplacements de face', () => {
  it('prévoit autant de faces que la typologie, déclarées ou non', () => {
    const slots = faceSlots(refMultilevel);
    const total = refMultilevel.supports.reduce((n, s) => n + supportFaceCount(refMultilevel, s.id), 0);
    expect(slots).toHaveLength(total);
    expect(slots.every(s => s.face === undefined && !s.outOfRange)).toBe(true);
  });

  it('garde une face déclarée hors typologie, marquée comme telle', () => {
    const extra = { ...FACE, id: 'face-9', face_index: 9 };
    const slot = faceSlots(withFaces([FACE, extra])).find(s => s.face?.id === 'face-9');
    expect(slot?.outOfRange).toBe(true);
  });
});

describe('A5.6 — saisie d’une face', () => {
  it('déclare une face avec son gabarit et ses langues, dans l’ordre du site', () => {
    const langs = [...refMultilevel.site.active_langs].reverse();
    const out = declareFaceCommand(refMultilevel, support.id, 0, { template_key: null, langs }, ENV);
    expect(out.ok && out.value.after).toEqual({
      id: 'face-new', org_id: support.org_id, support_id: support.id, face_index: 0,
      template_key: null, langs: JSON.stringify(refMultilevel.site.active_langs),
    });
  });

  it('refuse une face déjà déclarée, hors typologie, un gabarit inconnu, une langue inactive', () => {
    const codes = (site: SiteData, face: number, template: string | null, langs: readonly string[]): readonly string[] => {
      const out = declareFaceCommand(site, support.id, face, { template_key: template, langs }, ENV);
      return out.ok ? [] : out.findings.map(f => f.code);
    };
    expect(codes(withFaces([FACE]), 0, null, [])).toEqual(['LAYOUT.FACE_ALREADY_DECLARED']);
    expect(codes(refMultilevel, supportFaceCount(refMultilevel, support.id), null, [])).toEqual(['LAYOUT.FACE_INDEX_OUT_OF_RANGE']);
    expect(codes(refMultilevel, 0, 'gabarit-absent', [])).toEqual(['LAYOUT.FACE_TEMPLATE_UNKNOWN']);
    expect(codes(refMultilevel, 0, null, ['xx'])).toEqual(['LAYOUT.FACE_LANG_INACTIVE']);
  });

  it('modifie une face ; l’inverse rétablit ses valeurs, et une clé déjà portée reste permise', () => {
    const face = { ...FACE, template_key: 'hors-poste' };
    const out = updateFaceCommand(refMultilevel, face, { template_key: 'hors-poste', langs: [] }, ENV.timestamp);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.after).toEqual({ template_key: 'hors-poste', langs: null });
    expect(inverseCommand(out.value, ENV.timestamp).after).toEqual({ template_key: 'hors-poste', langs: '["fr"]' });
  });
});

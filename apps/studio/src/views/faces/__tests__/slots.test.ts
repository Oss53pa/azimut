import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import {
  declareBlockCommand, faceTemplate,
  type ContentBlockDef, type SiteData, type Support, type SupportFace,
} from '@azimut/core-model';
import { resolveFaceContent } from '@azimut/engine-graph';

const first = refMultilevel.supports[0];
const baseTemplate = refMultilevel.face_templates[0];
const profile = refMultilevel.travel_profiles[0];
if (first === undefined || baseTemplate === undefined || profile === undefined) throw new Error('jeu incomplet');
const REGION = { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 10 };
const extra: readonly ContentBlockDef[] = [
  { kind: 'free_text', ordinal: 2, region: REGION, config: { text: 'Gabarit' } },
  { kind: 'map', ordinal: 3, region: REGION, config: {} },
];
// Le support porte la typologie du jeu ; le gabarit a un emplacement libre (2) et un plan (3).
const support: Support = { ...first, typology_id: 'stype-directional' };
const FACE: SupportFace = { id: 'face-1', org_id: first.org_id, support_id: first.id, face_index: 0, langs: ['fr', 'en'] };
const SITE: SiteData = {
  ...refMultilevel,
  supports: [support],
  support_faces: [FACE],
  face_templates: [{ ...baseTemplate, blocks: [...baseTemplate.blocks, ...extra] }],
};
const ENV = { newId: () => 'blk-new', timestamp: '2026-09-26T00:00:00.000Z' };

describe('D8.3 — emplacements du gabarit', () => {
  it('place un bloc libre dans l’emplacement libre du gabarit, sans avis', () => {
    const out = declareBlockCommand(SITE, FACE, 'free', { fr: 'Sortie', en: 'Exit' }, ENV);
    expect(out.ok && out.value.after?.['block_index']).toBe(2);
    expect(out.ok && out.warnings).toEqual([]);
    expect(out.ok && out.notices).toEqual([]);
  });

  it('refuse un emplacement d’une autre nature, et un emplacement déjà rempli', () => {
    const wrong = declareBlockCommand(SITE, FACE, 'free', { fr: 'Sortie' }, ENV, 0);
    expect(!wrong.ok && wrong.notices.map(n => n.key)).toEqual(['form.block.slot.none']);
    const filled: SiteData = { ...SITE, content_blocks: [{ id: 'b', org_id: first.org_id, face_id: 'face-1', block_index: 2, kind: 'free' }] };
    const taken = declareBlockCommand(filled, FACE, 'free', { fr: 'Sortie' }, ENV, 2);
    expect(!taken.ok && taken.notices.map(n => n.key)).toEqual(['form.block.slot.taken']);
  });

  it('E1.4 — refuse toute autre nature que free, par EDIT.CONTEXT_VIOLATION', () => {
    for (const kind of ['legend', 'map', 'resolved', 'pictogram']) {
      const out = declareBlockCommand(SITE, FACE, kind, {}, ENV);
      expect(!out.ok && out.findings.map(f => f.code)).toEqual(['EDIT.CONTEXT_VIOLATION']);
    }
  });

  it('rend le texte saisi dans l’emplacement libre, par langue', () => {
    const template = faceTemplate(SITE, support, 0);
    if (template === null) throw new Error('gabarit absent');
    const blocks = [{ id: 'b', org_id: first.org_id, face_id: 'face-1', block_index: 2, kind: 'free', free_text: { fr: 'Sortie', en: 'Exit' } }];
    const resolved = resolveFaceContent(SITE, template, support.node_id, profile, blocks);
    const content = resolved.ok ? resolved.value.blocks[2]?.content : undefined;
    expect(content).toEqual({ type: 'free_text', text: 'Sortie', texts: { fr: 'Sortie', en: 'Exit' } });
    const plain = resolveFaceContent(SITE, template, support.node_id, profile);
    expect(plain.ok && plain.value.blocks[2]?.content).toEqual({ type: 'free_text', text: 'Gabarit' });
  });

});

import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import {
  declareBlockCommand, updateFreeTextCommand, withdrawBlockCommand, inverseCommand, readFreeTexts,
  type ContentBlockInstance, type SiteData, type SupportFace,
} from '@azimut/core-model';

const first = refMultilevel.supports[0];
if (first === undefined) throw new Error('jeu sans support');
const FACE: SupportFace = { id: 'face-1', org_id: first.org_id, support_id: first.id, face_index: 0, langs: ['fr', 'en'] };
const ENV = { newId: () => 'blk-new', timestamp: '2026-09-26T00:00:00.000Z' };
const MAP: ContentBlockInstance = { id: 'blk-0', org_id: first.org_id, face_id: 'face-1', block_index: 0, kind: 'map' };
const SITE: SiteData = { ...refMultilevel, support_faces: [FACE], content_blocks: [MAP] };

function codes(out: { ok: boolean; findings?: readonly { code: string }[] }): readonly string[] {
  return out.findings?.map(f => f.code) ?? [];
}

describe('D8.3 — blocs saisis sur une face', () => {
  it('ajoute un bloc libre après les blocs de la face, une entrée par langue', () => {
    const out = declareBlockCommand(SITE, FACE, 'free', { en: ' Exit ', fr: 'Sortie' }, ENV);
    expect(out.ok && out.value.after).toEqual({
      id: 'blk-new', org_id: first.org_id, face_id: 'face-1', block_index: 1, kind: 'free',
      free_text: JSON.stringify({ fr: 'Sortie', en: 'Exit' }),
    });
    expect(out.ok && out.warnings).toEqual([]);
  });

  it('avertit d’une langue de la face restée sans texte, sans bloquer', () => {
    const out = declareBlockCommand(SITE, FACE, 'free', { fr: 'Sortie' }, ENV);
    expect(out.ok && out.warnings.map(w => [w.code, w.params['lang']])).toEqual([['LAYOUT.FREE_TEXT_LANG_MISSING', 'en']]);
  });

  it('ajoute une légende sans texte', () => {
    const out = declareBlockCommand(SITE, FACE, 'legend', {}, ENV);
    expect(out.ok && out.value.after).toEqual({ id: 'blk-new', org_id: first.org_id, face_id: 'face-1', block_index: 1, kind: 'legend' });
  });

  it('refuse un type résolu, un texte vide, une langue que la face ne porte pas', () => {
    expect(codes(declareBlockCommand(SITE, FACE, 'resolved', {}, ENV))).toEqual(['LAYOUT.BLOCK_KIND_NOT_ENTERABLE']);
    expect(codes(declareBlockCommand(SITE, FACE, 'free', { fr: '  ' }, ENV))).toEqual(['LAYOUT.FREE_TEXT_EMPTY']);
    const frOnly = { ...FACE, langs: ['fr'] };
    expect(codes(declareBlockCommand(SITE, frOnly, 'free', { fr: 'Sortie', en: 'Exit' }, ENV)))
      .toEqual(['LAYOUT.FREE_TEXT_LANG_OUTSIDE_FACE']);
  });

  it('réécrit un texte libre, et l’inverse le rétablit', () => {
    const free: ContentBlockInstance = { ...MAP, id: 'blk-1', block_index: 1, kind: 'free', free_text: { fr: 'Accueil' } };
    expect(readFreeTexts(free)).toEqual({ fr: 'Accueil' });
    const out = updateFreeTextCommand(SITE, FACE, free, { fr: 'Accueil', en: 'Reception' }, ENV.timestamp);
    expect(out.ok && out.value.after).toEqual({ free_text: JSON.stringify({ fr: 'Accueil', en: 'Reception' }) });
    expect(out.ok && inverseCommand(out.value, ENV.timestamp).after).toEqual({ free_text: '{"fr":"Accueil"}' });
  });

  it('retire un bloc libre ou une légende, mais pas un bloc de plan mural', () => {
    const legend: ContentBlockInstance = { ...MAP, id: 'blk-2', kind: 'legend' };
    expect(withdrawBlockCommand(legend, ENV.timestamp).ok).toBe(true);
    expect(codes(withdrawBlockCommand(MAP, ENV.timestamp))).toEqual(['LAYOUT.BLOCK_KIND_NOT_ENTERABLE']);
  });
});

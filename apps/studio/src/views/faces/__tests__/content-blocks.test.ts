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

/** Les codes du catalogue et les clés des refus de saisie, dans cet ordre. */
function codes(out: { ok: boolean; findings?: readonly { code: string }[]; notices: readonly { key: string }[] }): readonly string[] {
  return [...(out.findings?.map(f => f.code) ?? []), ...out.notices.map(n => n.key)];
}

describe('D8.3 — blocs saisis sur une face', () => {
  it('ajoute un bloc libre après les blocs de la face, une entrée par langue', () => {
    const out = declareBlockCommand(SITE, FACE, 'free', { en: ' Exit ', fr: 'Sortie' }, ENV);
    expect(out.ok && out.value.after).toEqual({
      id: 'blk-new', org_id: first.org_id, face_id: 'face-1', block_index: 1, kind: 'free',
      free_text: JSON.stringify({ fr: 'Sortie', en: 'Exit' }),
    });
    // Sans typologie, le gabarit n'est pas connu : l'emplacement n'est pas vérifié, et c'est dit.
    expect(out.ok && out.notices.map(n => n.key)).toEqual(['form.block.template.not_at_hand']);
    expect(out.ok && out.warnings).toEqual([]);
  });

  it('avertit d’une langue de la face restée sans texte, sans bloquer', () => {
    const out = declareBlockCommand(SITE, FACE, 'free', { fr: 'Sortie' }, ENV);
    expect(out.ok && out.notices.map(n => [n.key, n.severity])).toEqual([
      ['form.free_text.lang.missing', 'warning'], ['form.block.template.not_at_hand', 'warning'],
    ]);
    expect(out.ok && out.notices[0]?.params['lang']).toBe('en');
  });

  it('E1.4 — refuse une légende ou un type résolu par EDIT.CONTEXT_VIOLATION', () => {
    expect(codes(declareBlockCommand(SITE, FACE, 'legend', {}, ENV))).toEqual(['EDIT.CONTEXT_VIOLATION']);
    expect(codes(declareBlockCommand(SITE, FACE, 'resolved', {}, ENV))).toEqual(['EDIT.CONTEXT_VIOLATION']);
  });

  it('refuse un texte vide, une langue que la face ne porte pas, sans code au catalogue', () => {
    expect(codes(declareBlockCommand(SITE, FACE, 'free', { fr: '  ' }, ENV))).toEqual(['form.free_text.empty']);
    const frOnly = { ...FACE, langs: ['fr'] };
    expect(codes(declareBlockCommand(SITE, frOnly, 'free', { fr: 'Sortie', en: 'Exit' }, ENV)))
      .toEqual(['form.free_text.lang.outside_face']);
  });

  it('réécrit un texte libre, et l’inverse le rétablit', () => {
    const free: ContentBlockInstance = { ...MAP, id: 'blk-1', block_index: 1, kind: 'free', free_text: { fr: 'Accueil' } };
    expect(readFreeTexts(free)).toEqual({ fr: 'Accueil' });
    const out = updateFreeTextCommand(SITE, FACE, free, { fr: 'Accueil', en: 'Reception' }, ENV.timestamp);
    expect(out.ok && out.value.after).toEqual({ free_text: JSON.stringify({ fr: 'Accueil', en: 'Reception' }) });
    expect(out.ok && inverseCommand(out.value, ENV.timestamp).after).toEqual({ free_text: '{"fr":"Accueil"}' });
  });

  it('retire un bloc libre, mais pas un bloc venu du gabarit', () => {
    const free: ContentBlockInstance = { ...MAP, id: 'blk-2', kind: 'free', free_text: { fr: 'Accueil' } };
    expect(withdrawBlockCommand(free, ENV.timestamp).ok).toBe(true);
    const legend: ContentBlockInstance = { ...MAP, id: 'blk-3', kind: 'legend' };
    expect(codes(withdrawBlockCommand(legend, ENV.timestamp))).toEqual(['EDIT.CONTEXT_VIOLATION']);
    expect(codes(withdrawBlockCommand(MAP, ENV.timestamp))).toEqual(['EDIT.CONTEXT_VIOLATION']);
  });
});

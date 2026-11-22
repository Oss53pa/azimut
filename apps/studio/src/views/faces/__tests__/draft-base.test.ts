import { describe, it, expect } from 'vitest';
import type { ContentBlockInstance, SupportFace } from '@azimut/core-model';
import { blockChangedUnder, faceChangedUnder } from '../draft-base.js';

const FACE = {
  id: 'f1', org_id: 'o1', support_id: 's1', face_index: 0, template_key: 'tpl-a', langs: ['fr'],
} as unknown as SupportFace;
const BLOCK = {
  id: 'b1', org_id: 'o1', face_id: 'f1', block_index: 0, kind: 'free', free_text: { fr: 'Accueil' },
} as unknown as ContentBlockInstance;

describe('S6.6c — la base d’un brouillon', () => {
  it('une face relue à l’identique ne change pas sous le brouillon', () => {
    expect(faceChangedUnder(FACE, { ...FACE })).toBe(false);
    expect(faceChangedUnder(undefined, undefined)).toBe(false);
  });

  it('un gabarit, des langues, une déclaration par un autre poste : changé', () => {
    expect(faceChangedUnder(FACE, { ...FACE, template_key: null } as unknown as SupportFace)).toBe(true);
    expect(faceChangedUnder(FACE, { ...FACE, langs: ['fr', 'en'] } as unknown as SupportFace)).toBe(true);
    expect(faceChangedUnder(undefined, FACE)).toBe(true);
  });

  it('un bloc réécrit ou retiré change sous la saisie ; relu à l’identique, non', () => {
    expect(blockChangedUnder(BLOCK, { ...BLOCK })).toBe(false);
    expect(blockChangedUnder(BLOCK, { ...BLOCK, free_text: { fr: 'Hall' } } as unknown as ContentBlockInstance)).toBe(true);
    expect(blockChangedUnder(BLOCK, undefined)).toBe(true);
  });
});

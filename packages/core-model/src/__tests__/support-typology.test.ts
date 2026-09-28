import { describe, it, expect } from 'vitest';
import { supportTypologyOf, type SupportType } from '../index.js';

const types: readonly SupportType[] = [
  { id: 'typ-a', org_id: 'org-1', key: 'a', name: 'A', face_count: 1, faces: [] },
  { id: 'typ-b', org_id: 'org-1', key: 'b', name: 'B', face_count: 2, faces: [] },
];

describe('A5.6 — supportTypologyOf', () => {
  it('résout la typologie par son identifiant', () => {
    expect(supportTypologyOf(types, { typology_id: 'typ-b' })?.key).toBe('b');
  });

  it('rend null pour un support sans typologie', () => {
    expect(supportTypologyOf(types, {})).toBeNull();
  });

  it('rend null pour une typologie inconnue, sans en choisir une autre', () => {
    expect(supportTypologyOf(types, { typology_id: 'typ-z' })).toBeNull();
  });
});

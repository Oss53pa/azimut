import { describe, it, expect } from 'vitest';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteFact } from '@azimut/core-model';
import { resolveBoundParagraph } from '@azimut/core-model';
import { buildDocumentBindings } from '../document-bindings.js';

const PARKING_GRATUIT: SiteFact = {
  key: 'parking_gratuit',
  value: 'oui',
  source: 'Direction',
  recorded_on: '2026-03-12',
  forbidden: [],
};

describe('buildDocumentBindings (M15)', () => {
  it('offre le site et ses niveaux, quel que soit son contenu', () => {
    const { values, catalogue } = buildDocumentBindings(refMinimal);
    expect(values['site']?.['name']).toBe(refMinimal.site.name);
    expect(values['level']?.['count']).toBe(String(refMinimal.levels.length));
    expect(catalogue['site']).toContain('name');
  });

  it('offre le parking du site qui en porte un', () => {
    const { values } = buildDocumentBindings(refMultilevel);
    expect(values['parking']?.['name']).toBe('Parking Ouest');
    expect(values['parking']?.['capacity']).toBe('4');
    expect(values['parking']?.['digitised_spaces']).toBe('4');
    expect(values['parking']?.['access']).toBe('gratuit');
  });

  it('catalogue les champs de parking même sans parking, et ne les remplit pas', () => {
    // La distinction est tout l'intérêt : le modèle offre `capacity`, ce site
    // n'en a pas. C'est une donnée à saisir, pas une faute du document.
    const { values, catalogue } = buildDocumentBindings(refMinimal);
    expect(catalogue['parking']).toContain('capacity');
    expect(values['parking']?.['capacity']).toBeUndefined();

    const r = resolveBoundParagraph(
      { id: 'p', segments: [{ kind: 'bound', binding: { source: 'parking', field: 'capacity' } }] },
      values,
      catalogue,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing[0]?.cause).toBe('empty');
  });

  it('expose un fait du site par sa clé, sans toucher au module', () => {
    const { values, catalogue } = buildDocumentBindings(refMinimal, [PARKING_GRATUIT]);
    expect(values['site_fact']?.['parking_gratuit']).toBe('oui');
    expect(catalogue['site_fact']).toEqual(['parking_gratuit']);
  });

  it('un fait non déclaré n’est pas au catalogue : le document a tort de le citer', () => {
    const { values, catalogue } = buildDocumentBindings(refMinimal, [PARKING_GRATUIT]);
    const r = resolveBoundParagraph(
      { id: 'p', segments: [{ kind: 'bound', binding: { source: 'site_fact', field: 'horaires' } }] },
      values,
      catalogue,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing[0]?.cause).toBe('unknown');
  });

  it('est déterministe', () => {
    expect(JSON.stringify(buildDocumentBindings(refMultilevel, [PARKING_GRATUIT])))
      .toBe(JSON.stringify(buildDocumentBindings(refMultilevel, [PARKING_GRATUIT])));
  });
});

describe('ce qu’un document a le droit de publier', () => {
  it('ne compte que les places existantes, pas les propositions', () => {
    // Le compte du document diffère de celui de l'audit, et c'est voulu :
    // « ce qui a été tracé » n'est pas « ce que le site a » (P1, complément atelier).
    const site = {
      ...refMultilevel,
      parking_spaces: refMultilevel.parking_spaces.map((s, i) =>
        i === 0
          ? { ...s, provenance: { status: 'proposition' as const, source: 'Détection' } }
          : s,
      ),
    };
    const { values } = buildDocumentBindings(site);
    expect(values['parking']?.['digitised_spaces']).toBe('3');
  });

  it('ne compte pas une place retirée', () => {
    const site = {
      ...refMultilevel,
      parking_spaces: refMultilevel.parking_spaces.map((s, i) =>
        i === 0
          ? { ...s, provenance: { status: 'retire' as const, source: 'Plan indice 19' } }
          : s,
      ),
    };
    const { values } = buildDocumentBindings(site);
    expect(values['parking']?.['digitised_spaces']).toBe('3');
  });
});

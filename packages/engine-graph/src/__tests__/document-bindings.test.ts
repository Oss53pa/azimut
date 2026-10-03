import { describe, it, expect } from 'vitest';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteFact } from '@azimut/core-model';
import {
  resolveBoundParagraph, PARKING_CAPACITY_KEY, PARKING_FREE_KEY,
  PARKING_UNDIGITIZED_SPACES_KEY,
} from '@azimut/core-model';
import { buildDocumentBindings } from '../document-bindings.js';

const PARKING_GRATUIT: SiteFact = {
  key: 'parking_gratuit',
  value: 'oui',
  status: 'existing',
  source_ref: 'Direction',
  declared_at: '2026-03-12',
  forbidden: [],
};

/**
 * Les faits du parking de `refMultilevel` — A5.11. Ils vivent dans le
 * vocabulaire du site et non dans `SiteData`, et l'appelant les passe ; ces
 * essais les posent donc ici, une fois.
 */
function faitParking(key: string, value: number | boolean): SiteFact {
  return {
    key,
    value,
    status: 'existing',
    source_ref: 'Plan RDC indice 20',
    declared_at: '2026-01-05',
    target: { kind: 'zone', id: 'zone-ml-parking-ouest' },
    forbidden: [],
  };
}

const FAITS_PARKING: readonly SiteFact[] = [
  faitParking(PARKING_CAPACITY_KEY, 4),
  faitParking(PARKING_FREE_KEY, true),
];

describe('buildDocumentBindings (M15)', () => {
  it('offre le site et ses niveaux, quel que soit son contenu', () => {
    const { values, catalogue } = buildDocumentBindings(refMinimal);
    expect(values['site']?.['name']).toBe(refMinimal.site.name);
    expect(values['level']?.['count']).toBe(String(refMinimal.levels.length));
    expect(catalogue['site']).toContain('name');
  });

  it('offre le parking du site qui en porte un', () => {
    const { values } = buildDocumentBindings(refMultilevel, FAITS_PARKING);
    expect(values['parking']?.['name']).toBe('Parking Ouest');
    expect(values['parking']?.['capacity']).toBe('4');
    expect(values['parking']?.['digitized_spaces']).toBe('4');
    expect(values['parking']?.['access']).toBe('gratuit');
  });

  it('laisse vide un champ qu’aucun fait ne déclare', () => {
    // M01.S11 : « un nombre affiché dans un livrable provient d'un fait ou
    // d'un calcul ». Le nom vient de la zone, la capacité d'un fait — et sans
    // le fait, le document n'annonce rien plutôt qu'un défaut.
    const { values } = buildDocumentBindings(refMultilevel, []);
    expect(values['parking']?.['name']).toBe('Parking Ouest');
    expect(values['parking']?.['capacity']).toBeUndefined();
    expect(values['parking']?.['access']).toBeUndefined();
  });

  it('dit « payant » quand le fait de gratuité est faux, et non quand il manque', () => {
    const payant = [faitParking(PARKING_FREE_KEY, false)];
    expect(buildDocumentBindings(refMultilevel, payant).values['parking']?.['access'])
      .toBe('payant');
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

describe('ce qu’un document compte comme place tracée', () => {
  /** La marque de S-37 sur l'une des quatre places de `refMultilevel`. */
  const marque: SiteFact = {
    key: PARKING_UNDIGITIZED_SPACES_KEY,
    value: 12,
    status: 'existing',
    source_ref: 'Plan coupé au bord de page',
    declared_at: '2026-01-05',
    target: { kind: 'footprint', id: 'fp-ml-a1' },
    forbidden: [],
  };

  it('ne compte pas une surface non numérisée parmi les places tracées', () => {
    // Le compte du document diffère de celui de l'audit, et c'est voulu :
    // « ce qui a été tracé » n'est pas « ce que le site a » (règle M01.S11).
    // `auditParking` totalise les douze places que la marque déclare ; le
    // document ne cite que les trois emplacements qui restent dessinés.
    const { values } = buildDocumentBindings(refMultilevel, [...FAITS_PARKING, marque]);
    expect(values['parking']?.['digitized_spaces']).toBe('3');
  });

  it('ne compte pas une empreinte que la zone ne déclare pas', () => {
    const site = {
      ...refMultilevel,
      zones: (refMultilevel.zones ?? []).map(z => ({
        ...z, footprint_ids: z.footprint_ids.slice(0, 2),
      })),
    };
    expect(buildDocumentBindings(site, FAITS_PARKING).values['parking']?.['digitized_spaces'])
      .toBe('2');
  });
});

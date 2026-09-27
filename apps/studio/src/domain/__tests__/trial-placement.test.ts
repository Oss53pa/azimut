import { describe, it, expect } from 'vitest';
import { refMultilevel, refMinimal } from '@azimut/testkit/sites';
import { trialPlacement, trialSupportId, placedSupports, untypedSupportCount } from '../trial-placement.js';

const profile = refMultilevel.travel_profiles[0];
if (profile === undefined) throw new Error('fixture without a travel profile');

describe('H2.5 — implantation d’essai', () => {
  it('place un support par point de décision, trié par nœud', () => {
    const result = trialPlacement(refMultilevel, profile, 'directional');
    expect(result.derived).toBe(true);
    expect(result.supports.length).toBe(result.decision_point_count);

    const ids = result.supports.map(s => s.node_id);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });

  it('dérive l’identifiant du nœud, sans compteur ni horloge', () => {
    const result = trialPlacement(refMultilevel, profile, 'directional');
    for (const support of result.supports) {
      expect(support.id).toBe(trialSupportId(support.node_id));
      expect(support.support_type_key).toBe('directional');
    }
  });

  it('rend deux fois la même liste pour le même état de données', () => {
    const a = trialPlacement(refMultilevel, profile, 'totemic');
    const b = trialPlacement(refMultilevel, profile, 'totemic');
    expect(a).toEqual(b);
  });

  it('convertit les supports implantés du site sans en inventer', () => {
    const placed = placedSupports(refMultilevel, 'directional');
    expect(placed.length).toBe(refMultilevel.supports.length);

    const minimalProfile = refMinimal.travel_profiles[0];
    expect(minimalProfile).toBeDefined();
    expect(placedSupports(refMinimal, 'directional')).toEqual([]);
  });
});

describe('A5.6 — typologie portée par le support', () => {
  const [first, ...rest] = refMultilevel.supports;
  if (first === undefined) throw new Error('fixture without supports');
  const typed = {
    ...refMultilevel,
    support_types: [
      ...refMultilevel.support_types,
      { id: 'typ-totem', org_id: first.org_id, key: 'totem', name: 'Totem', face_count: 2, faces: [] },
    ],
    supports: [{ ...first, typology_id: 'typ-totem' }, ...rest],
  };

  it('lit la typologie du support quand il en porte une', () => {
    const placed = placedSupports(typed, 'directional');
    expect(placed.find(s => s.id === first.id)?.support_type_key).toBe('totem');
  });

  it('ne suppose la typologie passée qu’aux supports non rattachés', () => {
    const placed = placedSupports(typed, 'directional');
    for (const s of placed.filter(p => p.id !== first.id)) expect(s.support_type_key).toBe('directional');
    expect(untypedSupportCount(typed)).toBe(refMultilevel.supports.length - 1);
  });

  it('traite une typologie inconnue du site comme une absence', () => {
    const dangling = { ...refMultilevel, supports: [{ ...first, typology_id: 'typ-absente' }, ...rest] };
    expect(placedSupports(dangling, 'directional')[0]?.support_type_key).toBe('directional');
    expect(untypedSupportCount(dangling)).toBe(refMultilevel.supports.length);
  });
});

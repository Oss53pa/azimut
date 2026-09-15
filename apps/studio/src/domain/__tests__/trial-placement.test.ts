import { describe, it, expect } from 'vitest';
import { refMultilevel, refMinimal } from '@azimut/testkit/sites';
import { trialPlacement, trialSupportId, placedSupports } from '../trial-placement.js';

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

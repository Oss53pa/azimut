import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { deriveDecisionPoints } from '@azimut/engine-graph';
import { divergenceReport } from '../divergence.js';

describe('Module 08 — couche de divergence', () => {
  const profile = refMultilevel.travel_profiles[0];

  it('relève comme non couverts les points de décision sans support', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const report = divergenceReport(refMultilevel, profile);
    const points = deriveDecisionPoints(refMultilevel, profile, refMultilevel.destinations);
    const pointIds = points.ok ? points.value.map(p => p.node_id) : [];
    const supported = new Set(refMultilevel.supports.map(s => s.node_id));
    expect(report?.uncovered_count).toBe(pointIds.filter(id => !supported.has(id)).length);
  });

  it('ne relève ni orientation ni dimension, que le modèle ne borne pas', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const report = divergenceReport(refMultilevel, profile);
    expect(report?.orientation_count).toBe(0);
    expect(report?.undersized_count).toBe(0);
  });

  it('rend deux fois la même chose (INV-4)', () => {
    if (profile === undefined) throw new Error('profil manquant');
    expect(divergenceReport(refMultilevel, profile)).toEqual(divergenceReport(refMultilevel, profile));
  });
});

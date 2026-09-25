import { describe, it, expect } from 'vitest';
import { refMultilevel, refMinimal } from '@azimut/testkit';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';
import { staggeringPlan } from '../staggering.js';

function line(point: string, destination: string): MessageLine {
  return {
    id: `l-${point}`,
    support_id: `s-${point}`,
    face_index: 0,
    block_index: 0,
    block_kind: 'destination_list',
    entries: [{ destination_id: destination, text: {}, direction: null, distance_m: null }],
    pictogram_id: null,
    direction: null,
    information_level: null,
    decision_point_id: point,
    stale: false,
  };
}

function schedule(lines: readonly MessageLine[]): MessageSchedule {
  return {
    site_id: refMultilevel.site.id,
    version: 1,
    state: 'draft',
    generated_at: '1970-01-01T00:00:00.000Z',
    inputs_hash: 'h',
    lines,
  };
}

const profile = refMultilevel.travel_profiles[0];
const TARGET = 'dest-ml-r1';
const ID = `n-ml-entrance→${TARGET}`;

describe('H2.4 — plan de jalonnement parcours par parcours', () => {
  it('relie chaque entrée à chaque destination, points de décision dans l’ordre de marche', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const plan = staggeringPlan(refMultilevel, profile, null);
    const sequence = plan.sequences.find(s => s.id === ID);
    expect(sequence?.steps.map(s => s.nodeId)).toEqual([
      'n-ml-hall', 'n-ml-elevator-rdc', 'n-ml-elevator-r1', 'n-ml-hall-r1', 'n-ml-dest-r1',
    ]);
    expect(sequence?.steps.at(-1)?.arrival).toBe(true);
    expect(sequence?.lengthM).toBeGreaterThan(0);
  });

  it('ne relève aucune rupture tant que rien n’est annoncé', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const plan = staggeringPlan(refMultilevel, profile, null);
    expect(plan.sequences.every(s => s.breaks.length === 0)).toBe(true);
  });

  it('relève la rupture là où l’annonce s’interrompt', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const gap = schedule([
      line('n-ml-hall', TARGET),
      line('n-ml-elevator-r1', TARGET),
      line('n-ml-hall-r1', TARGET),
    ]);
    const sequence = staggeringPlan(refMultilevel, profile, gap).sequences.find(s => s.id === ID);
    expect(sequence?.breaks).toHaveLength(1);
    expect(sequence?.breaks[0]?.code).toBe('WAYFIND.CONTINUITY_BROKEN');
    expect(sequence?.breaks[0]?.params['break_point']).toBe('n-ml-elevator-rdc');
  });

  it('ignore les autres destinations du même panneau', () => {
    if (profile === undefined) throw new Error('profil manquant');
    const other = schedule([line('n-ml-hall', 'dest-ml-rdc')]);
    const sequence = staggeringPlan(refMultilevel, profile, other).sequences.find(s => s.id === ID);
    expect(sequence?.breaks).toHaveLength(0);
    expect(sequence?.steps.every(s => s.arrival || !s.announced)).toBe(true);
  });

  it('rend deux fois la même chose (INV-4)', () => {
    const p = refMinimal.travel_profiles[0];
    if (p === undefined) throw new Error('profil manquant');
    expect(staggeringPlan(refMinimal, p, null)).toEqual(staggeringPlan(refMinimal, p, null));
  });
});

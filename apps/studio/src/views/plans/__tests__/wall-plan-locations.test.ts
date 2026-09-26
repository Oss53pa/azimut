import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { SiteData, Support } from '@azimut/core-model';
import { wallPlanSupportIds } from '../wall-plan-locations.js';

const first = refMultilevel.supports[0];
if (first === undefined) throw new Error('jeu sans support');
const support: Support = first;

function withBlock(kind: string): SiteData {
  return {
    ...refMultilevel,
    support_faces: [{ id: 'face-1', org_id: support.org_id, support_id: support.id, face_index: 0 }],
    content_blocks: [{ id: 'blk-1', org_id: support.org_id, face_id: 'face-1', block_index: 0, kind }],
  };
}

describe('T-2.9 — emplacements de plan mural', () => {
  it('retient le support dont une face porte un bloc map', () => {
    expect([...wallPlanSupportIds(withBlock('map'))]).toEqual([support.id]);
  });

  it('ne retient pas un support sans bloc map, même s’il a des faces', () => {
    expect(wallPlanSupportIds(withBlock('resolved')).size).toBe(0);
    expect(wallPlanSupportIds(refMultilevel).size).toBe(0);
  });
});

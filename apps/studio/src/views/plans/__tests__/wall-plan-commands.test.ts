import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import {
  declareWallPlanCommands, withdrawWallPlanCommand, inverseCommand, supportFaceCount,
  type SiteData, type Support,
} from '@azimut/core-model';

const first = refMultilevel.supports[0];
if (first === undefined) throw new Error('jeu sans support');
const support: Support = first;
const TIMESTAMP = '2026-09-26T00:00:00.000Z';

function ids(): () => string {
  let n = 0;
  return () => { n += 1; return `id-${String(n)}`; };
}

function withFace(blocks: readonly { kind: string; block_index: number }[]): SiteData {
  return {
    ...refMultilevel,
    support_faces: [{ id: 'face-1', org_id: support.org_id, support_id: support.id, face_index: 0 }],
    content_blocks: blocks.map((b, i) => ({
      id: `blk-${String(i)}`, org_id: support.org_id, face_id: 'face-1', block_index: b.block_index, kind: b.kind,
    })),
  };
}

describe('T-2.9 — saisie d’un plan mural', () => {
  it('crée la face puis le bloc map quand le support n’a pas encore la face', () => {
    const out = declareWallPlanCommands(refMultilevel, support.id, 0, { newId: ids(), timestamp: TIMESTAMP });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.map(c => [c.operation, c.module, c.table])).toEqual([
      ['create', '04-signaletique', 'support_face'],
      ['create', '04-signaletique', 'support_content_block'],
    ]);
    expect(out.value[0]?.after).toEqual({ id: 'id-1', org_id: support.org_id, support_id: support.id, face_index: 0 });
    expect(out.value[1]?.after).toEqual({
      id: 'id-2', org_id: support.org_id, face_id: 'id-1', block_index: 0, kind: 'map',
    });
  });

  it('ajoute le bloc après ceux de la face existante, sans recréer la face', () => {
    const site = withFace([{ kind: 'resolved', block_index: 0 }, { kind: 'pictogram', block_index: 3 }]);
    const out = declareWallPlanCommands(site, support.id, 0, { newId: ids(), timestamp: TIMESTAMP });
    expect(out.ok && out.value.map(c => c.table)).toEqual(['support_content_block']);
    expect(out.ok && out.value[0]?.after).toMatchObject({ face_id: 'face-1', block_index: 4 });
  });

  it('refuse un doublon, une face que le support n’a pas, un support inconnu', () => {
    const code = (site: SiteData, id: string, face: number): string | undefined => {
      const out = declareWallPlanCommands(site, id, face, { newId: ids(), timestamp: TIMESTAMP });
      return out.ok ? undefined : out.findings[0]?.code;
    };
    expect(code(withFace([{ kind: 'map', block_index: 0 }]), support.id, 0)).toBe('LAYOUT.WALL_PLAN_DUPLICATE');
    expect(code(refMultilevel, support.id, supportFaceCount(refMultilevel, support.id))).toBe('LAYOUT.WALL_PLAN_FACE_OUT_OF_RANGE');
    expect(code(refMultilevel, support.id, -1)).toBe('LAYOUT.WALL_PLAN_FACE_OUT_OF_RANGE');
    expect(code(refMultilevel, 'absent', 0)).toBe('LAYOUT.WALL_PLAN_SUPPORT_UNKNOWN');
  });

  it('retire le bloc par une suppression dont l’inverse le recrée à l’identique', () => {
    const site = withFace([{ kind: 'map', block_index: 2 }]);
    const block = site.content_blocks[0];
    if (block === undefined) throw new Error('bloc absent');
    const out = withdrawWallPlanCommand(block, TIMESTAMP);
    expect(out.ok && out.value.operation).toBe('delete');
    expect(out.ok && inverseCommand(out.value, TIMESTAMP).after).toEqual({
      id: 'blk-0', org_id: support.org_id, face_id: 'face-1', block_index: 2, kind: 'map',
    });
    const other = withFace([{ kind: 'resolved', block_index: 0 }]).content_blocks[0];
    if (other === undefined) throw new Error('bloc absent');
    const refused = withdrawWallPlanCommand(other, TIMESTAMP);
    expect(!refused.ok && refused.findings[0]?.code).toBe('LAYOUT.WALL_PLAN_NOT_A_PLAN');
  });
});

import { describe, it, expect } from 'vitest';
import { resolveFaceContent } from '../resolve-face.js';
import { refMultilevel } from '@azimut/testkit';
import type {
  FaceTemplate,
  TravelProfile,
  SiteData,
} from '@azimut/core-model';

function getProfile(
  profiles: readonly TravelProfile[],
  key: string,
): TravelProfile {
  const p = profiles.find((pr) => pr.key === key);
  if (!p) throw new Error(`No profile with key ${key}`);
  return p;
}

function getTemplate(
  templates: readonly FaceTemplate[],
  id: string,
): FaceTemplate {
  const t = templates.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`No template with id ${id}`);
  return t;
}

const stdProfile = getProfile(
  refMultilevel.travel_profiles,
  'standard',
);
const tpl = getTemplate(
  refMultilevel.face_templates,
  'ftpl-dir-front',
);

describe('T-2.3 resolveFaceContent', () => {
  it('resolves header with site name', () => {
    const result = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-ml-hall',
      stdProfile,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const header = result.value.blocks.find(
      (b) => b.kind === 'header',
    );
    expect(header).toBeDefined();
    if (header?.content.type === 'header') {
      expect(header.content.site_name).toBe('Site multi-niveaux');
    }
  });

  it('resolves destination_list from graph and directory', () => {
    const result = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-ml-hall',
      stdProfile,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const destList = result.value.blocks.find(
      (b) => b.kind === 'destination_list',
    );
    expect(destList).toBeDefined();
    if (destList?.content.type === 'destination_list') {
      expect(destList.content.entries.length).toBe(2);
      const rdcEntry = destList.content.entries.find(
        (e) => e.destination_id === 'dest-ml-rdc',
      );
      expect(rdcEntry?.names['fr']).toBe('Bureau RDC');
      expect(rdcEntry?.names['en']).toBe('Ground floor office');
      expect(rdcEntry?.distance_m).toBeGreaterThan(0);
    }
  });

  it('INV-2: changing a destination changes resolved content', () => {
    const r1 = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-ml-hall',
      stdProfile,
    );

    const modified: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.map((dn) =>
        dn.id === 'dn-ml-rdc-fr'
          ? { ...dn, value: 'Accueil modifié' }
          : dn,
      ),
    };

    const r2 = resolveFaceContent(modified, tpl, 'n-ml-hall', stdProfile);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    const list1 = r1.value.blocks.find(
      (b) => b.kind === 'destination_list',
    );
    const list2 = r2.value.blocks.find(
      (b) => b.kind === 'destination_list',
    );
    expect(list1).not.toStrictEqual(list2);

    if (
      list2?.content.type === 'destination_list'
    ) {
      const entry = list2.content.entries.find(
        (e) => e.destination_id === 'dest-ml-rdc',
      );
      expect(entry?.names['fr']).toBe('Accueil modifié');
    }
  });

  it('INV-2: unrelated face is unchanged', () => {
    const otherTpl: FaceTemplate = {
      id: 'ftpl-other',
      org_id: 'org-test-001',
      support_type_key: 'directional',
      side: 'front',
      name: 'Autre',
      blocks: [
        {
          kind: 'header',
          ordinal: 0,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
          config: {},
        },
      ],
    };

    const modified: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.map((dn) =>
        dn.id === 'dn-ml-rdc-fr'
          ? { ...dn, value: 'Changé' }
          : dn,
      ),
    };

    const r1 = resolveFaceContent(
      refMultilevel,
      otherTpl,
      'n-ml-hall',
      stdProfile,
    );
    const r2 = resolveFaceContent(
      modified,
      otherTpl,
      'n-ml-hall',
      stdProfile,
    );
    expect(r1).toStrictEqual(r2);
  });

  it('fails on non-existent node', () => {
    const result = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-nonexistent',
      stdProfile,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('GRAPH.RESOLVE_NODE_NOT_FOUND');
  });

  it('sorts blocks by ordinal', () => {
    const result = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-ml-hall',
      stdProfile,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (let i = 1; i < result.value.blocks.length; i++) {
      const prev = result.value.blocks[i - 1];
      const curr = result.value.blocks[i];
      if (prev && curr) {
        expect(prev.ordinal).toBeLessThanOrEqual(curr.ordinal);
      }
    }
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = resolveFaceContent(
        refMultilevel,
        tpl,
        'n-ml-hall',
        stdProfile,
      );
      const r2 = resolveFaceContent(
        refMultilevel,
        tpl,
        'n-ml-hall',
        stdProfile,
      );
      expect(r1).toStrictEqual(r2);
    });
  });
});

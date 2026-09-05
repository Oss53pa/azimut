import { describe, it, expect } from 'vitest';
import { resolveFaceContent } from '../resolve-face.js';
import { refMultilevel } from '@azimut/testkit';
import type {
  FaceTemplate,
  TravelProfile,
  SiteData,
  ContentBlockKind,
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

const stdProfile = getProfile(refMultilevel.travel_profiles, 'standard');
const tpl = getTemplate(refMultilevel.face_templates, 'ftpl-dir-front');

function singleBlockTpl(kind: ContentBlockKind, config: Record<string, unknown>): FaceTemplate {
  return {
    id: `ftpl-${kind}-test`, org_id: 'org-test-001', support_type_key: 'directional',
    side: 'front', name: `${kind} test`,
    blocks: [{ kind, ordinal: 0, region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 }, config }],
  };
}

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

  it('resolves cardinal direction from route bearing', () => {
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
    if (destList?.content.type === 'destination_list') {
      for (const entry of destList.content.entries) {
        // Direction should now be a cardinal string, not null
        expect(entry.direction).toMatch(/^(N|NE|E|SE|S|SW|W|NW)$/);
      }
    }
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

  it('emits LAYOUT.DESTINATION_NOT_FOUND when destination node is missing', () => {
    const modified: SiteData = {
      ...refMultilevel,
      destinations: [
        ...refMultilevel.destinations,
        {
          id: 'dest-phantom',
          org_id: 'org-test-001',
          footprint_id: 'fp-ml-rdc',
          node_id: 'n-nonexistent-ghost',
          category_id: 'cat-office',
          occupant_name: 'Phantom',
          occupancy_status: 'occupied' as const,
          display_priority: 99,
        },
      ],
    };

    const result = resolveFaceContent(modified, tpl, 'n-ml-hall', stdProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const notFound = result.warnings.find(
      (w) => w.code === 'LAYOUT.DESTINATION_NOT_FOUND',
    );
    expect(notFound).toBeDefined();
    expect(notFound?.entity?.id).toBe('dest-phantom');
    expect(notFound?.params['node_id']).toBe('n-nonexistent-ghost');
  });

  it('emits LAYOUT.DESTINATION_UNREACHABLE when route fails', () => {
    // Create an isolated node with no edges connecting it
    const modified: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-isolated',
            org_id: 'org-test-001',
            level_id: 'lvl-ml-rdc',
            kind: 'junction' as const,
            position: { x_m: 999, y_m: 999 },
            label: 'Isolated',
          },
        ],
      },
      destinations: [
        ...refMultilevel.destinations,
        {
          id: 'dest-isolated',
          org_id: 'org-test-001',
          footprint_id: 'fp-ml-rdc',
          node_id: 'n-isolated',
          category_id: 'cat-office',
          occupant_name: 'Isolated Room',
          occupancy_status: 'occupied' as const,
          display_priority: 99,
        },
      ],
    };

    const result = resolveFaceContent(modified, tpl, 'n-ml-hall', stdProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unreachable = result.warnings.find(
      (w) => w.code === 'LAYOUT.DESTINATION_UNREACHABLE',
    );
    expect(unreachable).toBeDefined();
    expect(unreachable?.entity?.id).toBe('dest-isolated');
    expect(unreachable?.params['from_node']).toBe('n-ml-hall');
    expect(unreachable?.params['to_node']).toBe('n-isolated');
  });

  it('no warnings when all destinations are reachable', () => {
    const result = resolveFaceContent(
      refMultilevel,
      tpl,
      'n-ml-hall',
      stdProfile,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(0);
  });

  describe('block default paths', () => {
    it('arrow block defaults to direction "forward" when config is empty', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('arrow', {}), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const arrow = result.value.blocks[0];
      if (arrow?.content.type === 'arrow') expect(arrow.content.direction).toBe('forward');
    });

    it('arrow block uses explicit config direction', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('arrow', { direction: 'left' }), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const arrow = result.value.blocks[0];
      if (arrow?.content.type === 'arrow') expect(arrow.content.direction).toBe('left');
    });

    it('free_text block defaults to empty string when config has no text', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('free_text', {}), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const block = result.value.blocks[0];
      if (block?.content.type === 'free_text') expect(block.content.text).toBe('');
    });

    it('free_text block uses explicit config text', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('free_text', { text: 'Bienvenue' }), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const block = result.value.blocks[0];
      if (block?.content.type === 'free_text') expect(block.content.text).toBe('Bienvenue');
    });

    it('pictogram block returns null when category does not exist', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('pictogram', { category_id: 'nonexistent-cat' }), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const block = result.value.blocks[0];
      if (block?.content.type === 'pictogram') {
        expect(block.content.pictogram_id).toBeNull();
        expect(block.content.svg_path).toBeNull();
      }
    });

    it('pictogram block returns null when config has no category_id', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('pictogram', {}), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const block = result.value.blocks[0];
      if (block?.content.type === 'pictogram') {
        expect(block.content.pictogram_id).toBeNull();
        expect(block.content.svg_path).toBeNull();
      }
    });

    it('pictogram block finds matching pictogram via category', () => {
      const result = resolveFaceContent(refMultilevel, singleBlockTpl('pictogram', { category_id: 'cat-office' }), 'n-ml-hall', stdProfile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const block = result.value.blocks[0];
      if (block?.content.type === 'pictogram') {
        expect(block.content.pictogram_id).not.toBeNull();
        expect(block.content.svg_path).not.toBeNull();
      }
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = resolveFaceContent(refMultilevel, tpl, 'n-ml-hall', stdProfile);
      const r2 = resolveFaceContent(refMultilevel, tpl, 'n-ml-hall', stdProfile);
      expect(r1).toStrictEqual(r2);
    });
  });
});


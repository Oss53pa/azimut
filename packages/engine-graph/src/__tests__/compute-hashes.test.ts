import { describe, it, expect } from 'vitest';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData, FaceTemplate } from '@azimut/core-model';
import { computeInputsHash, computeContentHash } from '../compute-hashes.js';
import { resolveFaceContent } from '../resolve-face.js';
import type { ContentHashInput } from '../compute-hashes.js';

function first<T>(arr: readonly T[], label: string): T {
  const v = arr[0];
  if (v === undefined) throw new Error(`missing ${label}`);
  return v;
}

const profile = first(refMinimal.travel_profiles, 'profile');
const template = first(refMinimal.face_templates, 'template');

function resolveAtNode(
  site: SiteData,
  tpl: FaceTemplate,
  nodeId: string,
): ContentHashInput {
  const result = resolveFaceContent(site, tpl, nodeId, profile);
  if (!result.ok) throw new Error('resolve failed');
  return {
    resolved: result.value,
    template: tpl,
    charter_version: null,
    rules_pack_version: null,
    active_langs: ['fr', 'en'],
    dimensions: { width_mm: 600, height_mm: 400 },
  };
}

describe('D7.1 — inputs_hash', () => {
  it('produces a 64-char lowercase hex hash', () => {
    const hash = computeInputsHash(refMinimal, profile);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    const a = computeInputsHash(refMinimal, profile);
    const b = computeInputsHash(refMinimal, profile);
    expect(a).toBe(b);
  });

  it('changes when an edge attribute changes', () => {
    const before = computeInputsHash(refMinimal, profile);
    const modified: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) =>
          e.id === 'e-01' ? { ...e, length_m: 999 } : e,
        ),
      },
    };
    const after = computeInputsHash(modified, profile);
    expect(after).not.toBe(before);
  });

  it('does NOT change when only a destination changes', () => {
    const before = computeInputsHash(refMinimal, profile);
    const modified: SiteData = {
      ...refMinimal,
      destinations: refMinimal.destinations.map((d) =>
        d.id === 'dest-a'
          ? { ...d, occupant_name: 'Renamed' }
          : d,
      ),
    };
    const after = computeInputsHash(modified, profile);
    expect(after).toBe(before);
  });

  it('changes when the profile changes', () => {
    const before = computeInputsHash(refMinimal, profile);
    const altProfile = { ...profile, require_accessible: true };
    const after = computeInputsHash(refMinimal, altProfile);
    expect(after).not.toBe(before);
  });

  it('changes when a node position changes', () => {
    const before = computeInputsHash(refMinimal, profile);
    const modified: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        nodes: refMinimal.graph.nodes.map((n) =>
          n.id === 'n-junction'
            ? { ...n, position: { x_m: 999, y_m: 999 } }
            : n,
        ),
      },
    };
    const after = computeInputsHash(modified, profile);
    expect(after).not.toBe(before);
  });

  it('changes when a vertical link attribute changes', () => {
    const mlProfile = refMultilevel.travel_profiles[0];
    if (!mlProfile) throw new Error('missing profile');
    const before = computeInputsHash(refMultilevel, mlProfile);
    const modified: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: refMultilevel.graph.vertical_links.map((vl) =>
          vl === refMultilevel.graph.vertical_links[0]
            ? { ...vl, capacity: 999 }
            : vl,
        ),
      },
    };
    const after = computeInputsHash(modified, mlProfile);
    expect(after).not.toBe(before);
  });
});

describe('D7.1 — content_hash', () => {
  it('produces a 64-char lowercase hex hash', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const hash = computeContentHash(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash(input);
    const b = computeContentHash(input);
    expect(a).toBe(b);
  });

  it('changes when charter version changes', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash(input);
    const b = computeContentHash({ ...input, charter_version: 'v2' });
    expect(a).not.toBe(b);
  });

  it('changes when active languages change', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash(input);
    const b = computeContentHash({ ...input, active_langs: ['fr'] });
    expect(a).not.toBe(b);
  });

  it('changes when dimensions change', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash(input);
    const b = computeContentHash({
      ...input,
      dimensions: { width_mm: 800, height_mm: 600 },
    });
    expect(a).not.toBe(b);
  });

  it('changes when rules_pack_version changes', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash(input);
    const b = computeContentHash({ ...input, rules_pack_version: 'v1.2.0' });
    expect(a).not.toBe(b);
  });

  it('active_langs order does not affect hash (sorted before hashing)', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const a = computeContentHash({ ...input, active_langs: ['en', 'fr'] });
    const b = computeContentHash({ ...input, active_langs: ['fr', 'en'] });
    expect(a).toBe(b);
  });
});

const headerOnlyTemplate: FaceTemplate = {
  id: 'ftpl-header-only',
  org_id: 'org-test-001',
  support_type_key: 'directional',
  side: 'front',
  name: 'En-tête seul',
  blocks: [
    {
      kind: 'header',
      ordinal: 0,
      region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
      config: {},
    },
  ],
};

describe('D7.3 — staleness precision', () => {
  it('destination change affects face with destination_list', () => {
    const input = resolveAtNode(refMinimal, template, 'n-junction');
    const before = computeContentHash(input);

    const modified: SiteData = {
      ...refMinimal,
      destination_names: refMinimal.destination_names.map((dn) =>
        dn.destination_id === 'dest-a' && dn.lang === 'fr'
          ? { ...dn, value: 'Bureau A modifié' }
          : dn,
      ),
    };

    const after = computeContentHash(
      resolveAtNode(modified, template, 'n-junction'),
    );
    expect(after).not.toBe(before);
  });

  it('destination change does NOT affect face without destination_list', () => {
    const input = resolveAtNode(refMinimal, headerOnlyTemplate, 'n-junction');
    const before = computeContentHash(input);

    const modified: SiteData = {
      ...refMinimal,
      destination_names: refMinimal.destination_names.map((dn) =>
        dn.destination_id === 'dest-a' && dn.lang === 'fr'
          ? { ...dn, value: 'Bureau A modifié' }
          : dn,
      ),
    };

    const after = computeContentHash(
      resolveAtNode(modified, headerOnlyTemplate, 'n-junction'),
    );
    expect(after).toBe(before);
  });

  it('stale count is exact — only faces with destination_list are marked', () => {
    const nodeId = 'n-junction';
    const templates = [template, headerOnlyTemplate];

    const hashes_before = templates.map((tpl) =>
      computeContentHash(resolveAtNode(refMinimal, tpl, nodeId)),
    );

    const modified: SiteData = {
      ...refMinimal,
      destination_names: refMinimal.destination_names.map((dn) =>
        dn.destination_id === 'dest-b' && dn.lang === 'en'
          ? { ...dn, value: 'Office B renamed' }
          : dn,
      ),
    };

    const hashes_after = templates.map((tpl) =>
      computeContentHash(resolveAtNode(modified, tpl, nodeId)),
    );

    let staleCount = 0;
    for (let i = 0; i < templates.length; i++) {
      if (hashes_before[i] !== hashes_after[i]) staleCount++;
    }
    expect(staleCount).toBe(1);
  });
});

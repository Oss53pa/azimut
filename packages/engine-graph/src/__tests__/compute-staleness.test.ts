import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { SiteData, FaceTemplate, TravelProfile } from '@azimut/core-model';
import { computeStaleFaces } from '../compute-staleness.js';
import type { FaceHashDescriptor } from '../compute-staleness.js';
import { resolveFaceContent } from '../resolve-face.js';
import { computeContentHash } from '../compute-hashes.js';

function first<T>(arr: readonly T[], label: string): T {
  const v = arr[0];
  if (v === undefined) throw new Error(`missing ${label}`);
  return v;
}

const profile: TravelProfile = first(refMinimal.travel_profiles, 'profile');
const dirTemplate: FaceTemplate = first(refMinimal.face_templates, 'template');

// A face that renders no destination list — must never go stale on a
// destination change.
const headerOnlyTemplate: FaceTemplate = {
  id: 'ftpl-header-only',
  org_id: 'org-test-001',
  support_type_key: 'directional',
  side: 'front',
  name: 'En-tête seul',
  blocks: [
    { kind: 'header', ordinal: 0, region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 }, config: {} },
  ],
};

function descriptor(
  id: string,
  template: FaceTemplate,
  nodeId: string,
  site: SiteData = refMinimal,
): FaceHashDescriptor {
  const resolved = resolveFaceContent(site, template, nodeId, profile);
  if (!resolved.ok) throw new Error('resolve failed');
  const previous = computeContentHash({
    resolved: resolved.value,
    template,
    charter_id: null,
    charter_version: null,
    rules_pack_id: null,
    rules_pack_version: null,
    active_langs: ['fr', 'en'],
    dimensions: { width_mm: 600, height_mm: 400 },
  });
  return {
    id,
    node_id: nodeId,
    template,
    profile,
    charter_id: null,
    charter_version: null,
    rules_pack_id: null,
    rules_pack_version: null,
    active_langs: ['fr', 'en'],
    dimensions: { width_mm: 600, height_mm: 400 },
    previous_content_hash: previous,
  };
}

function renameDestination(destId: string, lang: string, value: string): SiteData {
  return {
    ...refMinimal,
    destination_names: refMinimal.destination_names.map((dn) =>
      dn.destination_id === destId && dn.lang === lang ? { ...dn, value } : dn,
    ),
  };
}

describe('D7.3 — computeStaleFaces', () => {
  it('reports no stale faces when nothing changed', () => {
    const faces = [
      descriptor('dir@junction', dirTemplate, 'n-junction'),
      descriptor('hdr@junction', headerOnlyTemplate, 'n-junction'),
    ];
    const report = computeStaleFaces(refMinimal, faces);
    expect(report.stale_count).toBe(0);
    expect(report.stale_ids).toEqual([]);
  });

  it('marks exactly the faces mentioning a changed destination (mandatory D7.3)', () => {
    const faces = [
      descriptor('dir@junction', dirTemplate, 'n-junction'),
      descriptor('hdr@junction', headerOnlyTemplate, 'n-junction'),
    ];
    const modified = renameDestination('dest-b', 'en', 'Office B renamed');

    const report = computeStaleFaces(modified, faces);
    // Exactly one face is stale: the directional face with a destination list.
    expect(report.stale_count).toBe(1);
    expect(report.stale_ids).toEqual(['dir@junction']);

    const dir = report.faces.find((f) => f.id === 'dir@junction');
    expect(dir?.stale).toBe(true);
    expect(dir?.current_content_hash).not.toBe(dir?.previous_content_hash);
    const hdr = report.faces.find((f) => f.id === 'hdr@junction');
    expect(hdr?.stale).toBe(false);
  });

  it('marks a face stale when it no longer resolves', () => {
    const face = descriptor('dir@junction', dirTemplate, 'n-junction');
    // Point the recorded face at a node that does not exist in the site.
    const brokenFace = { ...face, node_id: 'n-does-not-exist' };
    const report = computeStaleFaces(refMinimal, [brokenFace]);
    expect(report.stale_count).toBe(1);
    expect(report.faces[0]?.current_content_hash).toBeNull();
  });

  it('is deterministic', () => {
    const faces = [descriptor('dir@junction', dirTemplate, 'n-junction')];
    const modified = renameDestination('dest-a', 'fr', 'Bureau A modifié');
    expect(computeStaleFaces(modified, faces)).toEqual(computeStaleFaces(modified, faces));
  });
});

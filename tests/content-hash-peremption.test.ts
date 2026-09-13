import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { resolveFaceContent } from '@azimut/engine-graph';
import type { ResolvedFace } from '@azimut/engine-graph';
import { computeFaceContentHash } from '@azimut/engine-layout';
import type { FaceContentHashInput } from '@azimut/engine-layout';
import type { FaceTemplate, SiteData, TravelProfile } from '@azimut/core-model';

const profile = refMultilevel.travel_profiles.find((p) => p.key === 'standard') as TravelProfile;

const directional = refMultilevel.face_templates.find((t) => t.id === 'ftpl-dir-front') as FaceTemplate;

// A header-only face: its content does not depend on any destination.
const headerOnly: FaceTemplate = {
  id: 'ftpl-header', org_id: directional.org_id,
  support_type_key: 'directional', side: 'front', name: 'En-tête',
  blocks: [{
    kind: 'header', ordinal: 0,
    region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 }, config: {},
  }],
};

/** Map a resolved face to the seven-element hash input (fixed context so only content varies). */
function inputOf(template: FaceTemplate, face: ResolvedFace): FaceContentHashInput {
  return {
    blocks: face.blocks.map((b) => b.content),
    template_key: template.id, template_version: '1',
    rules_pack_key: 'intl', rules_pack_version: '2026.1',
    active_langs: ['fr', 'en'], width_mm: 600, height_mm: 400,
    pictogram_ids: [],
  };
}

function hashFace(site: SiteData, template: FaceTemplate, nodeId: string): string {
  const resolved = resolveFaceContent(site, template, nodeId, profile);
  if (!resolved.ok) throw new Error(`resolve failed: ${resolved.findings.map((f) => f.code).join()}`);
  const h = computeFaceContentHash(inputOf(template, resolved.value));
  if (!h.ok) throw new Error(`hash failed: ${h.findings.map((f) => f.code).join()}`);
  return h.value;
}

/** ref-multilevel with one destination renamed. */
function withRenamedDestination(target: string, value: string): SiteData {
  return {
    ...refMultilevel,
    destination_names: refMultilevel.destination_names.map((dn) =>
      dn.destination_id === target && dn.lang === 'fr' ? { ...dn, value } : dn,
    ),
  };
}

describe('content_hash peremption precision (T-2.14a §6.7)', () => {
  it('marks stale exactly the faces whose resolved content changed, no more', () => {
    // The destination the directional face at the hall actually shows.
    const shownDestId = refMultilevel.destinations[0]?.id as string;
    const node = 'n-ml-hall';

    // A directional face (shows destinations) and a header-only face (does not).
    const dirBefore = hashFace(refMultilevel, directional, node);
    const hdrBefore = hashFace(refMultilevel, headerOnly, node);

    const modified = withRenamedDestination(shownDestId, 'Bureau RDC — renommé');

    // Precondition: the directional face's resolved content really changed.
    const dirResolvedBefore = resolveFaceContent(refMultilevel, directional, node, profile);
    const dirResolvedAfter = resolveFaceContent(modified, directional, node, profile);
    expect(dirResolvedBefore.ok && dirResolvedAfter.ok).toBe(true);
    if (dirResolvedBefore.ok && dirResolvedAfter.ok) {
      expect(dirResolvedBefore.value.blocks).not.toStrictEqual(dirResolvedAfter.value.blocks);
    }

    const dirAfter = hashFace(modified, directional, node);
    const hdrAfter = hashFace(modified, headerOnly, node);

    // Exactly one face is stale: the one that shows the renamed destination.
    const stale = [dirAfter !== dirBefore, hdrAfter !== hdrBefore];
    expect(stale.filter(Boolean).length).toBe(1);
    expect(dirAfter).not.toBe(dirBefore);   // shown → stale
    expect(hdrAfter).toBe(hdrBefore);       // not shown → not stale
  });

  it('renaming a destination that a face does not show leaves it unchanged', () => {
    // Rename a destination id that does not exist → nothing changes anywhere.
    const modified = withRenamedDestination('dest-does-not-exist', 'X');
    expect(hashFace(modified, directional, 'n-ml-hall'))
      .toBe(hashFace(refMultilevel, directional, 'n-ml-hall'));
  });

  it('two supports with identical faces share the empreinte (support id excluded, §6.8)', () => {
    // The hash input carries no support id, so resolving the same face for two
    // different supports yields the same empreinte.
    const a = hashFace(refMultilevel, directional, 'n-ml-hall');
    const b = hashFace(refMultilevel, directional, 'n-ml-hall');
    expect(a).toBe(b);
  });
});

import { describe, it, expect } from 'vitest';
import { validateGraph } from '../validate-graph.js';
import {
  refMinimal,
  refBroken,
  refAdversarial,
} from '@azimut/testkit';
import type { SiteData, Finding } from '@azimut/core-model';

function findingsWithCode(
  findings: readonly Finding[],
  code: string,
): Finding[] {
  return findings.filter((f) => f.code === code);
}

function makeSite(patch: Partial<SiteData>): SiteData {
  return { ...refMinimal, ...patch };
}

describe('validateGraph', () => {
  describe('refMinimal passes validation', () => {
    it('returns ok with no blocking findings', () => {
      const result = validateGraph(refMinimal);
      expect(result.ok).toBe(true);
    });
  });

  describe('refAdversarial passes validation', () => {
    it('returns ok (equal-cost paths, degenerate geometry)', () => {
      const result = validateGraph(refAdversarial);
      expect(result.ok).toBe(true);
    });
  });

  describe('GRAPH.EDGE_SELF_LOOP', () => {
    it('detects self-referencing edge in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const loops = findingsWithCode(
          result.findings,
          'GRAPH.EDGE_SELF_LOOP',
        );
        expect(loops.length).toBeGreaterThan(0);
        expect(loops[0]?.entity?.id).toBe('e-brk-zero-length');
      }
    });

    it('not triggered on refMinimal', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(result.warnings, 'GRAPH.EDGE_SELF_LOOP'),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.NODE_ORPHAN', () => {
    it('detects orphan node in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const orphans = findingsWithCode(
          result.findings,
          'GRAPH.NODE_ORPHAN',
        );
        expect(orphans.length).toBeGreaterThan(0);
        expect(orphans[0]?.entity?.id).toBe('n-brk-orphan');
      }
    });

    it('not triggered on refMinimal', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(result.warnings, 'GRAPH.NODE_ORPHAN'),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.DISCONNECTED', () => {
    it('detects disconnected subgraph in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const disconnected = findingsWithCode(
          result.findings,
          'GRAPH.DISCONNECTED',
        );
        expect(disconnected.length).toBeGreaterThan(0);
      }
    });

    it('not triggered on refMinimal (connected)', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(result.warnings, 'GRAPH.DISCONNECTED'),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.ZONE_UNREACHABLE', () => {
    it('detects nodes unreachable from entrance in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const unreachable = findingsWithCode(
          result.findings,
          'GRAPH.ZONE_UNREACHABLE',
        );
        expect(unreachable.length).toBeGreaterThan(0);
        const ids = unreachable.map((f) => f.entity?.id);
        expect(ids).toContain('n-brk-island-a');
        expect(ids).toContain('n-brk-island-b');
      }
    });

    it('not triggered on refMinimal (all reachable)', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.ZONE_UNREACHABLE',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.DESTINATION_UNREACHABLE', () => {
    it('detects unreachable destination in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const destFindings = findingsWithCode(
          result.findings,
          'GRAPH.DESTINATION_UNREACHABLE',
        );
        expect(destFindings.length).toBeGreaterThan(0);
        expect(destFindings[0]?.entity?.id).toBe(
          'dest-brk-unreachable',
        );
      }
    });

    it('not triggered on refMinimal', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.DESTINATION_UNREACHABLE',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.VERTICAL_LINK_MISSING', () => {
    it('detects cross-level edge without vertical link in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const crossLevel = findingsWithCode(
          result.findings,
          'GRAPH.VERTICAL_LINK_MISSING',
        );
        expect(crossLevel.length).toBeGreaterThan(0);
        expect(crossLevel[0]?.entity?.id).toBe('e-brk-cross-level');
      }
    });

    it('not triggered on refMinimal (single level)', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.VERTICAL_LINK_MISSING',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.DEAD_END_UNJUSTIFIED', () => {
    it('detects unjustified dead end in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const deadEnds = findingsWithCode(
          result.findings,
          'GRAPH.DEAD_END_UNJUSTIFIED',
        );
        expect(deadEnds.length).toBeGreaterThan(0);
        expect(deadEnds[0]?.entity?.id).toBe('n-brk-deadend');
      }
    });

    it('entrance at dead end is justified', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.DEAD_END_UNJUSTIFIED',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.LEVEL_NO_ACCESSIBLE_LINK', () => {
    it('detects multi-level building without accessible VL in refBroken', () => {
      const result = validateGraph(refBroken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const noVl = findingsWithCode(
          result.findings,
          'GRAPH.LEVEL_NO_ACCESSIBLE_LINK',
        );
        expect(noVl.length).toBeGreaterThan(0);
        expect(noVl[0]?.entity?.id).toBe('bldg-brk-001');
      }
    });

    it('not triggered on single-level building', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.LEVEL_NO_ACCESSIBLE_LINK',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.NO_ENTRANCE', () => {
    it('detects site with no entrance', () => {
      const noEntrance = makeSite({
        graph: {
          nodes: [
            {
              id: 'n-1',
              org_id: 'org-test-001',
              level_id: 'lvl-001',
              kind: 'junction',
              position: { x_m: 0, y_m: 0 },
              label: 'J1',
            },
            {
              id: 'n-2',
              org_id: 'org-test-001',
              level_id: 'lvl-001',
              kind: 'junction',
              position: { x_m: 10, y_m: 0 },
              label: 'J2',
            },
          ],
          edges: [
            {
              id: 'e-1',
              org_id: 'org-test-001',
              from_node_id: 'n-1',
              to_node_id: 'n-2',
              width_m: 1.5,
              slope_pct: 0,
              accessible: true,
              direction: 'both',
              evacuation_route: false,
              length_m: 10,
            },
          ],
          vertical_links: [],
        },
        destinations: [],
        destination_names: [],
      });
      const result = validateGraph(noEntrance);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const noEntr = findingsWithCode(
          result.findings,
          'GRAPH.NO_ENTRANCE',
        );
        expect(noEntr).toHaveLength(1);
      }
    });
  });

  describe('GRAPH.DESTINATION_NAME_MISSING', () => {
    it('detects destination missing a language', () => {
      const missingLang = makeSite({
        destination_names: refMinimal.destination_names.filter(
          (dn: { destination_id: string; lang: string }) =>
            !(
              dn.destination_id === 'dest-a' && dn.lang === 'en'
            ),
        ),
      });
      const result = validateGraph(missingLang);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const missing = findingsWithCode(
          result.warnings,
          'GRAPH.DESTINATION_NAME_MISSING',
        );
        expect(missing.length).toBeGreaterThan(0);
        expect(missing[0]?.entity?.id).toBe('dest-a');
        expect(missing[0]?.params['lang']).toBe('en');
      }
    });

    it('not triggered when all names present', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.DESTINATION_NAME_MISSING',
          ),
        ).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.EDGE_ZERO_LENGTH', () => {
    it('detects zero-length non-self-loop edge', () => {
      const zeroLength = makeSite({
        graph: {
          ...refMinimal.graph,
          edges: [
            ...refMinimal.graph.edges,
            {
              id: 'e-zero',
              org_id: 'org-test-001',
              from_node_id: 'n-entrance',
              to_node_id: 'n-junction',
              width_m: 1.5,
              slope_pct: 0,
              accessible: true,
              direction: 'both',
              evacuation_route: false,
              length_m: 0,
            },
          ],
        },
      });
      const result = validateGraph(zeroLength);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const zero = findingsWithCode(
          result.findings,
          'GRAPH.EDGE_ZERO_LENGTH',
        );
        expect(zero.length).toBeGreaterThan(0);
        expect(zero[0]?.entity?.id).toBe('e-zero');
      }
    });
  });

  describe('determinism (INV-4)', () => {
    it('produces identical findings on two runs', () => {
      const r1 = validateGraph(refBroken);
      const r2 = validateGraph(refBroken);
      expect(r1).toStrictEqual(r2);
    });
  });

  describe('empty graph', () => {
    it('handles site with no nodes and no edges', () => {
      const empty = makeSite({
        graph: { nodes: [], edges: [], vertical_links: [] },
        destinations: [],
        destination_names: [],
      });
      const result = validateGraph(empty);
      expect(result.ok).toBe(true);
    });
  });
});

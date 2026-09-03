import { describe, it, expect } from 'vitest';
import {
  crossLevelWithoutVlFindings,
  multiLevelWithoutAccessibleVlFindings,
  missingDestinationNameFindings,
} from '../checks-structure.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

describe('crossLevelWithoutVlFindings', () => {
  it('returns no findings for minimal site (single level)', () => {
    const findings = crossLevelWithoutVlFindings(refMinimal);
    expect(findings).toEqual([]);
  });

  it('returns no findings when all cross-level edges have VLs', () => {
    const findings = crossLevelWithoutVlFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits GRAPH.VERTICAL_LINK_MISSING for cross-level edge without VL', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [],
      },
    };
    const findings = crossLevelWithoutVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code).toBe('GRAPH.VERTICAL_LINK_MISSING');
      expect(f.severity).toBe('blocking');
      expect(f.entity?.kind).toBe('edge');
    }
  });

  it('findings are sorted by edge id', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [],
      },
    };
    const findings = crossLevelWithoutVlFindings(site);
    const ids = findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

describe('multiLevelWithoutAccessibleVlFindings', () => {
  it('returns no findings for single-level buildings', () => {
    const findings = multiLevelWithoutAccessibleVlFindings(refMinimal);
    expect(findings).toEqual([]);
  });

  it('returns no findings when multi-level has accessible VL', () => {
    const findings = multiLevelWithoutAccessibleVlFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits warning when multi-level building lacks accessible VL', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: refMultilevel.graph.vertical_links.map((vl) => ({
          ...vl,
          accessible: false,
        })),
      },
    };
    const findings = multiLevelWithoutAccessibleVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code).toBe('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
      expect(f.severity).toBe('warning');
      expect(f.entity?.kind).toBe('building');
    }
  });
});

describe('missingDestinationNameFindings', () => {
  it('returns no findings when no destination names exist', () => {
    const site: SiteData = {
      ...refMinimal,
      destination_names: [],
    };
    const findings = missingDestinationNameFindings(site);
    expect(findings).toEqual([]);
  });

  it('returns no findings when all destinations have all langs', () => {
    const findings = missingDestinationNameFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits warning for missing lang on a destination', () => {
    // Remove 'en' for only the first destination; the second still has it
    // so 'en' remains an active lang, but first dest is missing it
    const firstDestId = refMultilevel.destinations[0]?.id;
    if (!firstDestId) return;
    const site: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.filter(
        (dn) => !(dn.destination_id === firstDestId && dn.lang === 'en'),
      ),
    };
    const findings = missingDestinationNameFindings(site);
    const enFindings = findings.filter((f) => f.params['lang'] === 'en');
    expect(enFindings.length).toBeGreaterThan(0);
    expect(enFindings[0]?.entity?.id).toBe(firstDestId);
    for (const f of enFindings) {
      expect(f.code).toBe('GRAPH.DESTINATION_NAME_MISSING');
      expect(f.severity).toBe('warning');
      expect(f.entity?.kind).toBe('destination');
    }
  });

  it('findings are sorted by destination id', () => {
    // Remove 'en' for first dest only, ensuring sorted output
    const firstDestId = refMultilevel.destinations[0]?.id;
    if (!firstDestId) return;
    const site: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.filter(
        (dn) => !(dn.destination_id === firstDestId && dn.lang === 'en'),
      ),
    };
    const findings = missingDestinationNameFindings(site);
    const ids = findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

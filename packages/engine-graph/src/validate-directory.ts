import type {
  SiteData,
  Finding,
  Outcome,
} from '@azimut/core-model';

export type DirectoryValidationResult = {
  readonly total_destinations: number;
  readonly total_names: number;
  readonly active_langs: readonly string[];
};

function destNodeNotFoundFindings(site: SiteData): Finding[] {
  const nodeIds = new Set(site.graph.nodes.map((n) => n.id));
  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    if (!nodeIds.has(dest.node_id)) {
      findings.push({
        code: 'GRAPH.DESTINATION_UNLINKED',
        severity: 'blocking',
        entity: { kind: 'destination', id: dest.id },
        params: { node_id: dest.node_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function destNodeWrongKindFindings(site: SiteData): Finding[] {
  const nodeKind = new Map(
    site.graph.nodes.map((n) => [n.id, n.kind]),
  );
  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    const kind = nodeKind.get(dest.node_id);
    if (kind !== undefined && kind !== 'destination_access') {
      findings.push({
        code: 'GRAPH.DESTINATION_NODE_WRONG_KIND',
        severity: 'warning',
        entity: { kind: 'destination', id: dest.id },
        params: { node_id: dest.node_id, actual_kind: kind },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function destFootprintNotFoundFindings(site: SiteData): Finding[] {
  const fpIds = new Set(site.footprints.map((f) => f.id));
  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    if (!fpIds.has(dest.footprint_id)) {
      findings.push({
        code: 'GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'destination', id: dest.id },
        params: { footprint_id: dest.footprint_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function duplicateDestOnNodeFindings(site: SiteData): Finding[] {
  const nodeDestCount = new Map<string, string[]>();
  for (const dest of site.destinations) {
    const existing = nodeDestCount.get(dest.node_id);
    if (existing) {
      existing.push(dest.id);
    } else {
      nodeDestCount.set(dest.node_id, [dest.id]);
    }
  }
  const findings: Finding[] = [];
  const sortedKeys = [...nodeDestCount.keys()].sort();
  for (const nodeId of sortedKeys) {
    const destIds = nodeDestCount.get(nodeId);
    if (destIds && destIds.length > 1) {
      const sorted = [...destIds].sort();
      for (const destId of sorted) {
        findings.push({
          code: 'GRAPH.DESTINATION_DUPLICATE_ON_NODE',
          severity: 'warning',
          entity: { kind: 'destination', id: destId },
          params: { node_id: nodeId, count: destIds.length },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}

function missingNameFindings(site: SiteData): Finding[] {
  const langs = new Set<string>();
  for (const dn of site.destination_names) {
    langs.add(dn.lang);
  }
  if (langs.size === 0) return [];

  const namesByDest = new Map<string, Set<string>>();
  for (const dn of site.destination_names) {
    const existing = namesByDest.get(dn.destination_id);
    if (existing) {
      existing.add(dn.lang);
    } else {
      namesByDest.set(dn.destination_id, new Set([dn.lang]));
    }
  }

  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const activeLangs = [...langs].sort();
  for (const dest of sorted) {
    const destLangs = namesByDest.get(dest.id);
    for (const lang of activeLangs) {
      if (!destLangs?.has(lang)) {
        findings.push({
          code: 'GRAPH.DIRECTORY_NAME_MISSING',
          severity: 'warning',
          entity: { kind: 'destination', id: dest.id },
          params: { lang },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}

function emptyNameFindings(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...site.destination_names].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dn of sorted) {
    if (dn.value.trim() === '') {
      findings.push({
        code: 'GRAPH.DIRECTORY_NAME_EMPTY',
        severity: 'blocking',
        entity: { kind: 'destination_name', id: dn.id },
        params: { destination_id: dn.destination_id, lang: dn.lang },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function orphanNameFindings(site: SiteData): Finding[] {
  const destIds = new Set(site.destinations.map((d) => d.id));
  const findings: Finding[] = [];
  const sorted = [...site.destination_names].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dn of sorted) {
    if (!destIds.has(dn.destination_id)) {
      findings.push({
        code: 'GRAPH.DIRECTORY_NAME_ORPHAN',
        severity: 'warning',
        entity: { kind: 'destination_name', id: dn.id },
        params: { destination_id: dn.destination_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

export function validateDirectory(
  site: SiteData,
): Outcome<DirectoryValidationResult> {
  const allFindings: Finding[] = [
    ...destNodeNotFoundFindings(site),
    ...destFootprintNotFoundFindings(site),
    ...destNodeWrongKindFindings(site),
    ...duplicateDestOnNodeFindings(site),
    ...missingNameFindings(site),
    ...emptyNameFindings(site),
    ...orphanNameFindings(site),
  ];

  const blockings = allFindings.filter((f) => f.severity === 'blocking');
  const warnings = allFindings.filter(
    (f) => f.severity === 'warning' || f.severity === 'info',
  );

  const activeLangs = [
    ...new Set(site.destination_names.map((dn) => dn.lang)),
  ].sort();

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return {
    ok: true,
    value: {
      total_destinations: site.destinations.length,
      total_names: site.destination_names.length,
      active_langs: activeLangs,
    },
    warnings,
  };
}

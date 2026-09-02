import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';

export function DestinationsView(): JSX.Element {
  const site = useSiteData();

  const rows = useMemo(() => {
    const nameMap = new Map<string, Map<string, string>>();
    for (const dn of site.destination_names) {
      let langs = nameMap.get(dn.destination_id);
      if (!langs) {
        langs = new Map<string, string>();
        nameMap.set(dn.destination_id, langs);
      }
      langs.set(dn.lang, dn.value);
    }

    const nodeMap = new Map<string, string>();
    for (const n of site.graph.nodes) {
      nodeMap.set(n.id, n.label);
    }

    const levelMap = new Map<string, string>();
    for (const l of site.levels) {
      levelMap.set(l.id, l.name);
    }

    const nodeLevelMap = new Map<string, string>();
    for (const n of site.graph.nodes) {
      nodeLevelMap.set(n.id, n.level_id);
    }

    return [...site.destinations]
      .sort((a, b) => a.display_priority - b.display_priority || a.id.localeCompare(b.id))
      .map((d) => {
        const langs = nameMap.get(d.id);
        const levelId = nodeLevelMap.get(d.node_id);
        return {
          id: d.id,
          nameFr: langs?.get('fr') ?? '—',
          nameEn: langs?.get('en') ?? '—',
          level: levelId ? (levelMap.get(levelId) ?? '—') : '—',
          node: nodeMap.get(d.node_id) ?? '—',
          status: d.occupancy_status,
          priority: d.display_priority,
        };
      });
  }, [site]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Destinations
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {rows.length} destination{rows.length !== 1 ? 's' : ''} enregistree{rows.length !== 1 ? 's' : ''}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--az-border)' }}>
              <Th>Nom (fr)</Th>
              <Th>Nom (en)</Th>
              <Th>Niveau</Th>
              <Th>Noeud</Th>
              <Th>Statut</Th>
              <Th>Priorite</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--az-border)' }}>
                <Td>{r.nameFr}</Td>
                <Td>{r.nameEn}</Td>
                <Td>{r.level}</Td>
                <Td>{r.node}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td>{String(r.priority)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { readonly children: string }): JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      fontWeight: 600,
      color: 'var(--az-text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { readonly children: string | JSX.Element }): JSX.Element {
  return (
    <td style={{
      padding: '8px 12px',
      color: 'var(--az-text-primary)',
    }}>
      {children}
    </td>
  );
}

const STATUS_LABELS: Record<string, string> = {
  occupied: 'Occupe',
  vacant: 'Vacant',
  reserved: 'Reserve',
  under_fit_out: 'En amenagement',
};

function StatusBadge({ status }: { readonly status: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: 'var(--az-active-bg)',
      color: 'var(--az-active-text)',
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

import { type JSX, useMemo, useState } from 'react';
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
    for (const n of site.graph.nodes) nodeMap.set(n.id, n.label);

    const levelMap = new Map<string, string>();
    for (const l of site.levels) levelMap.set(l.id, l.name);

    const nodeLevelMap = new Map<string, string>();
    for (const n of site.graph.nodes) nodeLevelMap.set(n.id, n.level_id);

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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>
          Destinations
        </h1>
        <span style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 500,
          padding: '2px 10px',
          borderRadius: 12,
        }}>
          {rows.length}
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Points d'intérêt et occupants du site
      </p>
      <div style={{
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-float)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-panel)' }}>
              <Th>Nom (fr)</Th>
              <Th>Nom (en)</Th>
              <Th>Niveau</Th>
              <Th>Nœud</Th>
              <Th>Statut</Th>
              <Th align="center">Priorité</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <TRow key={r.id} even={i % 2 === 0}>
                <Td bold>{r.nameFr}</Td>
                <Td>{r.nameEn}</Td>
                <Td>
                  <LevelBadge>{r.level}</LevelBadge>
                </Td>
                <Td secondary>{r.node}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td align="center">{String(r.priority)}</Td>
              </TRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align }: { readonly children: string; readonly align?: string }): JSX.Element {
  return (
    <th style={{
      textAlign: (align ?? 'left') as 'left' | 'center' | 'right',
      padding: '10px 14px',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '2px solid var(--border-hairline)',
    }}>
      {children}
    </th>
  );
}

function TRow({ children, even }: {
  readonly children: JSX.Element | readonly JSX.Element[];
  readonly even: boolean;
}): JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: '1px solid var(--border-hairline)',
        background: hovered
          ? 'var(--surface-sunken)'
          : even
            ? 'var(--surface-panel)'
            : 'var(--surface-page)',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </tr>
  );
}

type TdProps = {
  readonly children: string | JSX.Element;
  readonly bold?: boolean;
  readonly secondary?: boolean;
  readonly align?: string;
};

function Td({ children, bold, secondary, align }: TdProps): JSX.Element {
  return (
    <td style={{
      padding: '10px 14px',
      color: secondary ? 'var(--text-secondary)' : 'var(--text-primary)',
      fontWeight: bold ? 500 : 400,
      textAlign: (align ?? 'left') as 'left' | 'center' | 'right',
    }}>
      {children}
    </td>
  );
}

function LevelBadge({ children }: { readonly children: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
    }}>
      {children}
    </span>
  );
}

const STATUS_CONFIG: Record<string, { label: string; colorVar: string; bgVar: string }> = {
  occupied: { label: 'Occupé', colorVar: 'var(--state-valid)', bgVar: 'var(--accent-soft)' },
  vacant: { label: 'Vacant', colorVar: 'var(--state-warning)', bgVar: 'var(--accent-soft)' },
  reserved: { label: 'Réservé', colorVar: 'var(--state-info)', bgVar: 'var(--accent-soft)' },
  under_fit_out: { label: 'En aménagement', colorVar: 'var(--accent)', bgVar: 'var(--accent-soft)' },
};

function StatusBadge({ status }: { readonly status: string }): JSX.Element {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    colorVar: 'var(--text-secondary)',
    bgVar: 'var(--surface-sunken)',
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11.5,
      fontWeight: 500,
      background: config.bgVar,
      color: config.colorVar,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: config.colorVar,
      }} />
      {config.label}
    </span>
  );
}

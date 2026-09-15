import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { validateDirectory, guardNamingCollisions } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { orientationNames } from '../domain/wayfinding-checks.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, TEXT, LABEL_STYLE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type DestinationsViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type DirectoryRow = {
  readonly id: string;
  readonly nameFr: string | null;
  readonly nameEn: string | null;
  readonly occupant: string;
  readonly level: string;
  readonly node: string;
  readonly status: string;
  readonly priority: number;
};

const ACTIVE_LANGS = ['fr', 'en'] as const;
const EMPTY = '—';

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

/**
 * Module 01 — l'annuaire des destinations.
 *
 * Une destination porte un nom par langue active ; une face n'affiche jamais
 * autre chose que ce nom. Les deux contrôles qui comptent ici sont donc la
 * couverture linguistique et l'unicité des noms d'orientation entre bâtiments
 * (H2.2) — un lecteur de panneau ne distingue pas deux « Porte A ».
 */
export function DestinationsView({ onNavigate }: DestinationsViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const [missingOnly, setMissingOnly] = useState(false);

  const directoryFindings = useMemo(() => findingsOf(validateDirectory(site)), [site]);
  const collisionFindings = useMemo(
    () => findingsOf(guardNamingCollisions(orientationNames(site, 'fr'))),
    [site],
  );

  const rows = useMemo<readonly DirectoryRow[]>(() => {
    const names = new Map<string, Map<string, string>>();
    for (const entry of site.destination_names) {
      const byLang = names.get(entry.destination_id) ?? new Map<string, string>();
      byLang.set(entry.lang, entry.value);
      names.set(entry.destination_id, byLang);
    }
    const nodeLabels = new Map(site.graph.nodes.map(n => [n.id, n.label]));
    const nodeLevels = new Map(site.graph.nodes.map(n => [n.id, n.level_id]));
    const levelNames = new Map(site.levels.map(l => [l.id, l.name]));

    return [...site.destinations]
      .sort((a, b) => a.display_priority - b.display_priority || a.id.localeCompare(b.id))
      .map((destination): DirectoryRow => {
        const byLang = names.get(destination.id);
        const levelId = nodeLevels.get(destination.node_id);
        return {
          id: destination.id,
          nameFr: byLang?.get('fr') ?? null,
          nameEn: byLang?.get('en') ?? null,
          occupant: destination.occupant_name,
          level: levelId === undefined ? EMPTY : (levelNames.get(levelId) ?? levelId),
          node: nodeLabels.get(destination.node_id) ?? destination.node_id,
          status: destination.occupancy_status,
          priority: destination.display_priority,
        };
      });
  }, [site]);

  const incomplete = rows.filter(r => r.nameFr === null || r.nameEn === null);
  const visible = missingOnly ? incomplete : rows;
  const coverage = rows.length === 0
    ? 100
    : Math.round(((rows.length - incomplete.length) / rows.length) * 100);

  const metrics: readonly Metric[] = [
    { id: 'destinations', label: t('destinations.metric.destinations'), value: String(rows.length) },
    { id: 'names', label: t('destinations.metric.names'), value: String(site.destination_names.length) },
    {
      id: 'coverage',
      label: t('destinations.metric.coverage'),
      value: `${String(coverage)} %`,
      note: ACTIVE_LANGS.join(' · '),
      severity: coverage === 100 ? 'valid' : 'warning',
    },
    {
      id: 'incomplete',
      label: t('destinations.metric.incomplete'),
      value: String(incomplete.length),
      severity: incomplete.length > 0 ? 'warning' : 'valid',
    },
    {
      id: 'collisions',
      label: t('destinations.metric.collisions'),
      value: String(collisionFindings.length),
      severity: collisionFindings.length > 0 ? 'blocking' : 'valid',
    },
  ];

  const columns: readonly Column<DirectoryRow>[] = [
    {
      id: 'fr',
      header: t('destinations.col.namefr'),
      cell: r => (
        r.nameFr
          ?? <Tag label={t('destinations.name.missing')} severity="warning" />
      ),
    },
    {
      id: 'en',
      header: t('destinations.col.nameen'),
      cell: r => (
        r.nameEn
          ?? <Tag label={t('destinations.name.missing')} severity="warning" />
      ),
    },
    { id: 'occupant', header: t('destinations.col.occupant'), cell: r => r.occupant },
    { id: 'level', header: t('destinations.col.level'), cell: r => r.level },
    { id: 'node', header: t('destinations.col.node'), cell: r => r.node },
    {
      id: 'status',
      header: t('destinations.col.status'),
      cell: r => <Tag label={r.status} severity={r.status === 'vacant' ? 'warning' : 'valid'} />,
    },
    { id: 'priority', header: t('destinations.col.priority'), numeric: true, cell: r => String(r.priority) },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('destinations.eyebrow')}
        title={t('destinations.title')}
        subtitle={t('destinations.subtitle')}
        actions={[
          { id: 'schedule', label: t('destinations.action.schedule'), onSelect: () => { onNavigate('message-schedule'); } },
        ]}
      />

      <MetricRow metrics={metrics} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px`,
      }}>
        <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => { setMissingOnly(e.target.checked); }}
          />
          {t('destinations.filter.missingonly')}
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {t('destinations.filter.shown', { shown: visible.length, total: rows.length })}
        </span>
      </div>

      <Panel title={t('destinations.panel.directory')} note={t('destinations.panel.directory.note')} padded={false}>
        <DataTable columns={columns} rows={visible} rowKey={r => r.id} empty={t('destinations.empty')} />
      </Panel>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('destinations.panel.directoryfindings')} note={String(directoryFindings.length)}>
            <FindingList findings={directoryFindings} empty={t('destinations.findings.empty')} limit={10} />
          </Panel>
          <Panel title={t('destinations.panel.collisions')} note={String(collisionFindings.length)}>
            <FindingList findings={collisionFindings} empty={t('destinations.collisions.empty')} limit={10} />
            <Note>{t('destinations.collisions.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('destinations.note')}</Note>
    </div>
  );
}

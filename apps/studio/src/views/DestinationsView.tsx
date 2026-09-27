import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { validateDirectory, guardNamingCollisions } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { orientationNames } from '../domain/wayfinding-checks.js';
import type { OccupancyStatus } from '@azimut/core-model';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  RegisterLayout, Inspector, InspectorEmpty,
  SPACE, type Metric, type Column, type RegisterFilter, type InspectorRow,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { formatDay } from './register/format.js';

type DestinationsViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type DirectoryRow = {
  readonly id: string;
  readonly code: string | null;
  readonly names: ReadonlyMap<string, string>;
  readonly occupant: string;
  readonly levelId: string | null;
  readonly level: string;
  readonly node: string;
  readonly nodeId: string;
  readonly category: string;
  readonly status: OccupancyStatus;
  readonly priority: number;
  readonly validFrom: string | undefined;
  readonly validTo: string | undefined;
};

const ALL = 'all';
const MISSING = 'missing';
const EMPTY = '—';

const STATUS_KEYS: Readonly<Record<OccupancyStatus, UiMessageKey>> = {
  occupied: 'status.occupied',
  vacant: 'status.vacant',
  reserved: 'status.reserved',
  under_fit_out: 'status.underfitout',
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

/**
 * Module 01 — l'annuaire des occupants, au gabarit « registre » de la maquette.
 *
 * Une destination porte un nom par langue active ; une face n'affiche jamais
 * autre chose que ce nom. Les deux contrôles qui comptent ici sont donc la
 * couverture linguistique et l'unicité des noms d'orientation entre bâtiments
 * (H2.2) — un lecteur de panneau ne distingue pas deux « Porte A ».
 */
export function DestinationsView({ onNavigate }: DestinationsViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const langs = site.site.active_langs;

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
    const unitCodes = new Map(site.footprints.map(f => [f.id, f.unit_code]));
    const categories = new Map(site.categories.map(c => [c.id, c.code]));

    return [...site.destinations]
      .sort((a, b) => a.display_priority - b.display_priority || a.id.localeCompare(b.id))
      .map((destination): DirectoryRow => {
        const levelId = nodeLevels.get(destination.node_id) ?? null;
        return {
          id: destination.id,
          code: unitCodes.get(destination.footprint_id) ?? null,
          names: names.get(destination.id) ?? new Map<string, string>(),
          occupant: destination.occupant_name,
          levelId,
          level: levelId === null ? EMPTY : (levelNames.get(levelId) ?? levelId),
          node: nodeLabels.get(destination.node_id) ?? destination.node_id,
          nodeId: destination.node_id,
          category: categories.get(destination.category_id) ?? destination.category_id,
          status: destination.occupancy_status,
          priority: destination.display_priority,
          validFrom: destination.valid_from,
          validTo: destination.valid_to,
        };
      });
  }, [site]);

  const isIncomplete = (r: DirectoryRow): boolean => langs.some(l => !r.names.has(l));
  const incomplete = rows.filter(isIncomplete);
  const visible = filter === ALL
    ? rows
    : filter === MISSING ? incomplete : rows.filter(r => r.levelId === filter);
  const selected = rows.find(r => r.id === selectedId) ?? visible[0] ?? null;
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
      note: langs.join(' · '),
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

  const levelsWithDestinations = site.levels.filter(l => rows.some(r => r.levelId === l.id));
  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('occupants.filter.all') },
    ...levelsWithDestinations.map(l => ({ id: l.id, label: l.name })),
    { id: MISSING, label: t('occupants.filter.missing') },
  ];

  const columns: readonly Column<DirectoryRow>[] = [
    { id: 'code', header: t('occupants.col.code'), cell: r => r.code ?? EMPTY },
    {
      id: 'name',
      header: t('occupants.col.name'),
      cell: r => r.names.get(langs[0] ?? 'fr') ?? r.occupant,
    },
    { id: 'level', header: t('destinations.col.level'), cell: r => r.level },
    { id: 'category', header: t('occupants.col.category'), cell: r => r.category },
    {
      id: 'status',
      header: t('destinations.col.status'),
      cell: r => (isIncomplete(r)
        ? <Tag label={t('occupants.names.incomplete')} severity="warning" />
        : <Tag label={t(STATUS_KEYS[r.status])} severity={r.status === 'vacant' ? 'warning' : 'valid'} />),
    },
    { id: 'priority', header: t('destinations.col.priority'), numeric: true, cell: r => String(r.priority) },
  ];

  const nameRows: readonly InspectorRow[] = langs.map(l => ({
    id: l,
    label: l.toUpperCase(),
    value: selected?.names.get(l) ?? t('destinations.name.missing'),
  }));
  const supportsAtNode = selected === null
    ? 0
    : site.supports.filter(s => s.node_id === selected.nodeId).length;

  const inspector = selected === null
    ? <InspectorEmpty text={t('occupants.inspector.empty')} />
    : (
      <Inspector
        title={selected.code ?? selected.occupant}
        subtitle={t('occupants.inspector.subtitle', {
          category: selected.category,
          status: t(STATUS_KEYS[selected.status]),
        })}
        sections={[
          { id: 'names', title: t('occupants.section.names'), rows: nameRows },
          {
            id: 'occupancy',
            title: t('occupants.section.occupancy'),
            rows: [
              { id: 'occupant', label: t('destinations.col.occupant'), value: selected.occupant },
              { id: 'level', label: t('destinations.col.level'), value: selected.level },
              { id: 'node', label: t('destinations.col.node'), value: selected.node },
              { id: 'from', label: t('occupants.field.from'), value: formatDay(selected.validFrom, lang) ?? EMPTY },
              { id: 'to', label: t('occupants.field.to'), value: formatDay(selected.validTo, lang) ?? EMPTY },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              ...langs.map(l => ({
                id: `length-${l}`,
                label: t('occupants.field.length', { lang: l.toUpperCase() }),
                value: String([...(selected.names.get(l) ?? '')].length),
                unit: t('occupants.unit.chars'),
                computed: true,
              })),
              { id: 'supports', label: t('occupants.field.supports'), value: String(supportsAtNode), computed: true },
            ],
          },
        ]}
      />
    );

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

      <div style={{ marginTop: SPACE.lg }}>
        <RegisterLayout
          title={t('occupants.title')}
          summary={t('occupants.summary', { destinations: rows.length, categories: site.categories.length })}
          filtersLabel={t('register.filters')}
          filters={filters}
          filter={filter}
          onFilter={id => { setFilter(id); setSelectedId(null); }}
          shown={t('destinations.filter.shown', { shown: visible.length, total: rows.length })}
          inspector={inspector}
          note={t('destinations.note')}
        >
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={r => r.id}
            empty={t('destinations.empty')}
            onSelect={r => { setSelectedId(r.id); }}
            selectedKey={selected?.id}
          />
        </RegisterLayout>
      </div>

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
    </div>
  );
}

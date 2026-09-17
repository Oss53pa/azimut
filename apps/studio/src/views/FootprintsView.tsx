import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { validateGeometry, runChecks } from '@azimut/engine-graph';
import { polygonArea, isCellFootprint } from '@azimut/core-model';
import type { Finding, Footprint } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Note, Tag,
  SPACE, TEXT, LABEL_STYLE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type FootprintsViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type FootprintRow = {
  readonly footprint: Footprint;
  readonly level: string;
  readonly area_m2: number;
  readonly vertices: number;
  readonly destination: string | null;
  readonly findings: readonly Finding[];
};

/**
 * Tranche M · écran M3 — les empreintes.
 *
 * Le tracé lui-même appartient à l'atelier (module 12) : le dupliquer ici
 * créerait deux chemins vers la même géométrie, ce que l'invariant 1 interdit.
 * Cet écran porte ce qui manquait : la liste, les propriétés, la surface
 * calculée, et les anomalies de géométrie face à face avec leur empreinte.
 */
export function FootprintsView({ onNavigate }: FootprintsViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const levels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );
  const [levelId, setLevelId] = useState<string>('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const geometry = useMemo(() => validateGeometry(site), [site]);
  const geometryFindings: readonly Finding[] = useMemo(() => {
    const fromGeometry = geometry.ok ? geometry.warnings : geometry.findings;
    // N1.4 — le code d'unité est contrôlé par `runChecks`, pas par la
    // géométrie. Les deux anomalies rejoignent la liste, sans quoi l'écran
    // des empreintes montrerait une colonne Code sans jamais dire ce qui ne
    // va pas avec elle.
    const checks = runChecks(site);
    const fromChecks = (checks.ok ? checks.value.findings : checks.findings)
      .filter(f => f.code === 'DATA.UNIT_CODE_REQUIRED' || f.code === 'DATA.CODE_DUPLICATE');
    return [...fromGeometry, ...fromChecks];
  }, [site, geometry]);

  const rows = useMemo<readonly FootprintRow[]>(() => {
    const levelNames = new Map(site.levels.map(l => [l.id, l.name]));
    const destinationByFootprint = new Map(
      site.destinations.map(d => [d.footprint_id, d.occupant_name]),
    );

    return [...site.footprints]
      .filter(f => levelId === '' || f.level_id === levelId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((footprint): FootprintRow => ({
        footprint,
        level: levelNames.get(footprint.level_id) ?? footprint.level_id,
        area_m2: polygonArea(footprint.geometry),
        vertices: footprint.geometry.vertices.length,
        destination: destinationByFootprint.get(footprint.id) ?? null,
        findings: geometryFindings.filter(f => f.entity?.id === footprint.id),
      }));
  }, [site, levelId, geometryFindings]);

  const totalArea = rows.reduce((sum, row) => sum + row.area_m2, 0);
  const flagged = rows.filter(row => row.findings.length > 0).length;

  const metrics: readonly Metric[] = [
    { id: 'count', label: t('footprints.metric.count'), value: String(rows.length) },
    {
      id: 'area',
      label: t('footprints.metric.area'),
      value: totalArea.toFixed(1),
      note: t('footprints.unit.m2'),
    },
    {
      id: 'kinds',
      label: t('footprints.metric.kinds'),
      value: String(new Set(rows.map(r => r.footprint.kind)).size),
    },
    {
      id: 'flagged',
      label: t('footprints.metric.flagged'),
      value: String(flagged),
      severity: flagged > 0 ? 'warning' : 'valid',
    },
  ];

  const columns: readonly Column<FootprintRow>[] = [
    {
      id: 'unit',
      header: t('footprints.col.unitcode'),
      cell: r => (
        isCellFootprint(r.footprint.kind) && (r.footprint.unit_code ?? '').trim().length === 0
          ? <Tag label={t('footprints.unitcode.missing')} severity="blocking" />
          : (r.footprint.unit_code ?? t('footprints.unitcode.none'))
      ),
    },
    { id: 'id', header: t('footprints.col.code'), cell: r => r.footprint.id },
    { id: 'kind', header: t('footprints.col.kind'), cell: r => r.footprint.kind },
    { id: 'level', header: t('footprints.col.level'), cell: r => r.level },
    {
      id: 'area',
      header: t('footprints.col.area'),
      numeric: true,
      cell: r => r.area_m2.toFixed(2),
    },
    { id: 'vertices', header: t('footprints.col.vertices'), numeric: true, cell: r => String(r.vertices) },
    {
      id: 'destination',
      header: t('footprints.col.destination'),
      cell: r => r.destination ?? t('footprints.nodestination'),
    },
    {
      id: 'state',
      header: t('footprints.col.state'),
      cell: r => (
        <Tag
          label={r.findings.length === 0 ? t('footprints.state.ok') : String(r.findings.length)}
          severity={r.findings.length === 0 ? 'valid' : 'warning'}
        />
      ),
    },
  ];

  const selectedRow = rows.find(r => r.footprint.id === selected);

  return (
    <div>
      <ScreenHeader
        eyebrow={t('footprints.eyebrow')}
        title={t('footprints.title')}
        subtitle={t('footprints.subtitle')}
        actions={[
          { id: 'atelier', label: t('footprints.action.atelier'), onSelect: () => { onNavigate('editor'); } },
        ]}
      />

      <MetricRow metrics={metrics} />

      <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center', margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px` }}>
        <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          {t('footprints.filter.level')}
          <select
            value={levelId}
            onChange={(e) => { setLevelId(e.target.value); }}
            style={{
              border: '1px solid var(--border-interactive)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: TEXT.small,
              fontFamily: 'inherit',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            <option value="">{t('footprints.filter.alllevels')}</option>
            {levels.map(level => (
              <option key={level.id} value={level.id}>{level.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Panel title={t('footprints.panel.list')} note={t('footprints.panel.note')} padded={false}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.footprint.id}
          selectedKey={selected}
          onSelect={r => { setSelected(r.footprint.id); }}
          empty={t('footprints.empty')}
        />
      </Panel>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('footprints.panel.properties')}>
            {selectedRow === undefined ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('footprints.properties.none')}
              </p>
            ) : (
              <VertexList row={selectedRow} />
            )}
          </Panel>
          <Panel title={t('footprints.panel.geometry')} note={String(geometryFindings.length)}>
            <FindingList findings={geometryFindings} empty={t('footprints.geometry.empty')} limit={10} />
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('footprints.note')}</Note>
    </div>
  );
}

type VertexListProps = {
  readonly row: FootprintRow;
};

function VertexList({ row }: VertexListProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={{ display: 'grid', gap: SPACE.sm }}>
      <div style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
        {t('footprints.properties.surface', { area: row.area_m2.toFixed(2) })}
      </div>
      <ol style={{
        margin: 0,
        paddingLeft: 20,
        display: 'grid',
        gap: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: TEXT.micro,
        color: 'var(--text-primary)',
        maxHeight: 220,
        overflow: 'auto',
      }}>
        {row.footprint.geometry.vertices.map((vertex, index) => (
          <li key={`${String(vertex.x_m)}-${String(vertex.y_m)}-${String(index)}`}>
            {`${vertex.x_m.toFixed(3)} · ${vertex.y_m.toFixed(3)}`}
          </li>
        ))}
      </ol>
      <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
        {t('footprints.properties.quantified')}
      </span>
    </div>
  );
}

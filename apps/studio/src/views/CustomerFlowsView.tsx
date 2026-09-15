import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { guardExposureHypotheses, guardFlowResultExport } from '@azimut/engine-graph';
import type { ExposureHypotheses } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, LABEL_STYLE, type Metric, type Column, type ScreenAction,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type ExposureRow = {
  readonly destination_id: string;
  readonly occupant: string;
  readonly footprint_id: string;
};

const EMPTY_HYPOTHESES: ExposureHypotheses = {
  entry_weights: [],
  attraction_weights: [],
  visibility_cones: [],
};

function findingsOf(outcome: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return outcome.ok ? (outcome.warnings ?? []) : (outcome.findings ?? []);
}

/**
 * Module 03 — les parcours clients.
 *
 * Un modèle de flux fondé sur le graphe est une simulation, pas une mesure :
 * aucun chiffre simulé n'est présenté ici comme une observation. Le calcul
 * d'exposition lui-même n'est pas construit (I5.3) ; ce qui existe, et qui
 * tient cet écran, ce sont les garde-fous : pas de rapport sans hypothèses.
 */
export function CustomerFlowsView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const entrances = useMemo(
    () => site.graph.nodes.filter(n => n.kind === 'entrance'),
    [site],
  );
  const typologies = useMemo(
    () => [...site.support_types].sort((a, b) => a.key.localeCompare(b.key)),
    [site],
  );

  const [declared, setDeclared] = useState(false);

  /**
   * Hypothèses déclarées. Elles sont construites depuis le site — accès du
   * graphe, destinations de l'annuaire, typologies — pour qu'aucune entité
   * inventée n'entre dans une pondération.
   */
  const hypotheses = useMemo<ExposureHypotheses>(() => {
    if (!declared) return EMPTY_HYPOTHESES;
    const share = entrances.length === 0 ? 0 : 1 / entrances.length;
    return {
      entry_weights: entrances.map(node => ({ access_id: node.id, weight: share })),
      attraction_weights: site.destinations.map(d => ({ destination_id: d.id, weight: 1 })),
      visibility_cones: typologies.map(type => ({
        typology: type.key,
        angle_deg: 60,
        distance_m: 25,
      })),
    };
  }, [declared, entrances, site.destinations, typologies]);

  const guard = useMemo(() => guardExposureHypotheses(hypotheses), [hypotheses]);
  const exportGuard = useMemo(
    () => guardFlowResultExport(declared ? hypotheses : null),
    [declared, hypotheses],
  );

  const rows = useMemo<readonly ExposureRow[]>(() =>
    [...site.destinations]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((d): ExposureRow => ({
        destination_id: d.id,
        occupant: d.occupant_name,
        footprint_id: d.footprint_id,
      })), [site]);

  const metrics: readonly Metric[] = [
    {
      id: 'hypotheses',
      label: t('flows.metric.hypotheses'),
      value: String(
        (hypotheses.entry_weights.length > 0 ? 1 : 0)
        + (hypotheses.attraction_weights.length > 0 ? 1 : 0)
        + (hypotheses.visibility_cones.length > 0 ? 1 : 0),
      ),
      note: t('flows.metric.hypotheses.note'),
      severity: guard.ok ? 'valid' : 'blocking',
    },
    { id: 'entries', label: t('flows.metric.entries'), value: String(entrances.length) },
    { id: 'destinations', label: t('flows.metric.destinations'), value: String(site.destinations.length) },
    {
      id: 'exportable',
      label: t('flows.metric.exportable'),
      value: exportGuard.ok ? t('flows.exportable.yes') : t('flows.exportable.no'),
      severity: exportGuard.ok ? 'valid' : 'blocking',
    },
  ];

  const actions: readonly ScreenAction[] = [
    {
      id: 'declare',
      label: declared ? t('flows.action.withdraw') : t('flows.action.declare'),
      primary: !declared,
      onSelect: () => { setDeclared(!declared); },
    },
    {
      id: 'export',
      label: t('flows.action.export'),
      disabled: !exportGuard.ok,
    },
  ];

  const columns: readonly Column<ExposureRow>[] = [
    { id: 'destination', header: t('flows.col.destination'), cell: r => r.destination_id },
    { id: 'occupant', header: t('flows.col.occupant'), cell: r => r.occupant },
    { id: 'footprint', header: t('flows.col.footprint'), cell: r => r.footprint_id },
    {
      id: 'passing',
      header: t('flows.col.passing'),
      numeric: true,
      cell: () => <Tag label={t('flows.notcomputed')} muted />,
    },
    {
      id: 'score',
      header: t('flows.col.score'),
      numeric: true,
      cell: () => <Tag label={t('flows.notcomputed')} muted />,
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('flows.eyebrow')}
        title={t('flows.title')}
        subtitle={t('flows.subtitle')}
        actions={actions}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        {!exportGuard.ok && (
          <StateBanner
            severity="blocking"
            code="FLOW.HYPOTHESIS_MISSING"
            message={t('flows.blocked.message')}
            hint={t('flows.blocked.hint')}
          />
        )}
        <StateBanner severity="info" message={t('flows.simulation.message')} />
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('flows.panel.entries')} note={String(hypotheses.entry_weights.length)}>
            <WeightList
              rows={hypotheses.entry_weights.map(w => ({
                key: w.access_id,
                value: `${(w.weight * 100).toFixed(1)} %`,
              }))}
              empty={t('flows.entries.empty')}
            />
          </Panel>
          <Panel title={t('flows.panel.attraction')} note={String(hypotheses.attraction_weights.length)}>
            <WeightList
              rows={hypotheses.attraction_weights.map(w => ({
                key: w.destination_id,
                value: w.weight.toFixed(2),
              }))}
              empty={t('flows.attraction.empty')}
            />
          </Panel>
          <Panel title={t('flows.panel.cones')} note={String(hypotheses.visibility_cones.length)}>
            <WeightList
              rows={hypotheses.visibility_cones.map(c => ({
                key: c.typology,
                value: `${String(c.angle_deg)}° · ${String(c.distance_m)} m`,
              }))}
              empty={t('flows.cones.empty')}
            />
          </Panel>
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('flows.panel.exposure')} note={t('flows.panel.exposure.note')} padded={false}>
          <DataTable columns={columns} rows={rows} rowKey={r => r.destination_id} empty={t('flows.exposure.empty')} />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('flows.panel.guards')}>
          <FindingList
            findings={[...findingsOf(guard), ...findingsOf(exportGuard)]}
            empty={t('flows.guards.empty')}
          />
        </Panel>
      </div>

      <Note>{t('flows.note')}</Note>
    </div>
  );
}

type WeightListProps = {
  readonly rows: readonly { readonly key: string; readonly value: string }[];
  readonly empty: string;
};

function WeightList({ rows, empty }: WeightListProps): JSX.Element {
  if (rows.length === 0) {
    return <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{empty}</p>;
  }
  return (
    <ul style={{
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'grid',
      gap: SPACE.xs,
      maxHeight: 200,
      overflow: 'auto',
    }}>
      {rows.map(row => (
        <li key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
          <span style={{ ...LABEL_STYLE, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-mono)' }}>
            {row.key}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: TEXT.small, color: 'var(--text-primary)' }}>
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

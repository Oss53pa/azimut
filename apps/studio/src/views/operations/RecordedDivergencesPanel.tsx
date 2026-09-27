import { type JSX, useMemo } from 'react';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { appRepository, useMaintenanceRegistryLoad } from '../../data/index.js';
import { DataTable, Panel, Tag, Note, SPACE, type Column } from '../../components/ui/index.js';
import { isOpen, jsonText, recordedDivergenceRows, type RecordedDivergenceRow } from './fleet-rows.js';
import { siteLabels } from '../register/labels.js';
import { MaintenanceBanner } from './MaintenanceBanner.js';
import { formatDay } from '../register/format.js';

type RecordedDivergencesPanelProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

/**
 * A5.7 — les divergences enregistrées en base, relevées sur le terrain, sur
 * un support ou sur le nœud d'un point non couvert (0041). À
 * distinguer du rapprochement, qui les calcule : les deux listes ne se
 * fusionnent pas, elles ne disent pas la même chose.
 */
export function RecordedDivergencesPanel({ siteKey }: RecordedDivergencesPanelProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const state = useMaintenanceRegistryLoad(repository, siteKey);
  const rows = useMemo(() => recordedDivergenceRows(state.registry), [state.registry]);
  const codes = useMemo(() => new Map(site.supports.map(s => [s.id, s.code ?? s.id])), [site]);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const target = (r: RecordedDivergenceRow): string => {
    if (r.supportId !== null) return codes.get(r.supportId) ?? r.supportId;
    return t('recorded.point', { node: r.nodeId === null ? '' : labels.node(r.nodeId) });
  };

  const columns: readonly Column<RecordedDivergenceRow>[] = [
    { id: 'kind', header: t('recorded.col.kind'), cell: r => t(`maint.kind.${r.divergence.kind}`) },
    {
      id: 'support',
      header: t('recorded.col.support'),
      cell: target,
    },
    {
      id: 'detected',
      header: t('recorded.col.detected'),
      cell: r => formatDay(r.divergence.detected_at.slice(0, 10), lang) ?? r.divergence.detected_at,
    },
    {
      id: 'state',
      header: t('recorded.col.state'),
      cell: r => (isOpen(r.divergence)
        ? <Tag label={t('maint.divergence.open')} severity="blocking" />
        : <Tag label={t('maint.divergence.resolved')} severity="valid" />),
    },
    { id: 'detail', header: t('recorded.col.detail'), cell: r => jsonText(r.divergence.detail) },
  ];

  return (
    <div style={{ marginTop: SPACE.lg }}>
      <MaintenanceBanner state={state} empty={false} emptyMessage="" />
      {state.status === 'ready' && (
        <Panel title={t('recorded.panel')} note={String(rows.length)} padded={false}>
          <DataTable columns={columns} rows={rows} rowKey={r => r.divergence.id} empty={t('recorded.empty')} />
        </Panel>
      )}
      <Note>{t('recorded.note')}</Note>
    </div>
  );
}

import { type JSX, useMemo } from 'react';
import { INFORMATION_LEVELS, type InformationLevelRank } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteWayfinding } from '../context/useSiteWayfinding.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  ScreenHeader, MetricRow, Panel, DataTable, Tag, Note, SPACE,
  type Metric, type Column,
} from '../components/ui/index.js';
import { declaredInformationLevels } from './message-schedule/schedule-model.js';
import { RegistryBanner } from './wayfinding/RegistryBanner.js';

type HierarchyRow = {
  readonly key: string;
  readonly name: string;
  readonly levels: ReadonlySet<number>;
};

/**
 * Module 02 — la hiérarchie de l'information : quels niveaux (1 à 4) chaque
 * typologie de support du site peut porter, lus du registre du wayfinding.
 * Les mêmes déclarations alimentent le tableau des messages ; les seuils de
 * lecture, eux, ne sont pas ici : ils viennent du paquet de règles (INV-5).
 */
export function InformationLevelsView(): JSX.Element {
  const site = useSiteData();
  const wayfinding = useSiteWayfinding();
  const { t } = useI18n();
  const bindings = wayfinding.registry.information_levels;

  const rows = useMemo<readonly HierarchyRow[]>(() => {
    const names = new Map(site.support_types.map(s => [s.key, s.name]));
    return declaredInformationLevels(site, bindings).map(d => ({
      key: d.support_type_key,
      name: names.get(d.support_type_key) ?? d.support_type_key,
      levels: new Set(d.levels),
    }));
  }, [site, bindings]);

  const siteKeys = new Set(site.support_types.map(s => s.key));
  const outside = bindings.filter(b => !siteKeys.has(b.typology_key)).length;
  const declared = rows.filter(r => r.levels.size > 0).length;

  const header = <ScreenHeader title={t('hierarchy.title')} subtitle={t('hierarchy.subtitle')} />;
  const banner = <RegistryBanner state={wayfinding} empty={bindings.length === 0} emptyMessage={t('wfregistry.empty.levels')} />;
  if (wayfinding.status !== 'ready') return <div>{header}{banner}</div>;

  const metrics: readonly Metric[] = [
    { id: 'typologies', label: t('hierarchy.metric.typologies'), value: String(rows.length) },
    { id: 'declared', label: t('hierarchy.metric.declared'), value: String(declared), severity: 'valid' },
    {
      id: 'undeclared', label: t('hierarchy.metric.undeclared'), value: String(rows.length - declared),
      severity: rows.length - declared > 0 ? 'warning' : 'valid',
    },
    { id: 'outside', label: t('hierarchy.metric.outside'), value: String(outside) },
  ];

  const levelColumn = (level: InformationLevelRank): Column<HierarchyRow> => ({
    id: `level-${String(level)}`,
    header: t('hierarchy.col.level', { level }),
    cell: r => (r.levels.has(level) ? <Tag label={t('hierarchy.cell.declared')} severity="valid" /> : '—'),
  });

  const columns: readonly Column<HierarchyRow>[] = [
    { id: 'name', header: t('hierarchy.col.typology'), cell: r => r.name },
    { id: 'key', header: t('hierarchy.col.key'), cell: r => r.key },
    ...INFORMATION_LEVELS.map(levelColumn),
    { id: 'count', header: t('hierarchy.col.count'), numeric: true, cell: r => String(r.levels.size) },
  ];

  return (
    <div>
      {header}
      {banner}
      <MetricRow metrics={metrics} />
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('hierarchy.panel.matrix')} note={String(rows.length)} padded={false}>
          <DataTable columns={columns} rows={rows} rowKey={r => r.key} empty={t('hierarchy.empty')} />
        </Panel>
      </div>
      <Note>{t('hierarchy.note')}</Note>
    </div>
  );
}

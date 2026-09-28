import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_BUDGET_REGISTRY, type CostReference } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { loadBudget, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { citedTypologies, missingCostFindings } from './budget/cited.js';
import { FindingList } from './message-schedule/FindingList.js';
import { formatMoney } from './budget/money.js';

const ALL = 'all';
const PRICED = 'priced';
const UNPRICED = 'unpriced';

/**
 * Module 09 — les coûts de référence (H8), au gabarit « registre ». Un coût
 * absent n'est pas estimé : la typologie reste non chiffrée, et le garde
 * `auditCostReferences` la signale si un support du site la porte. Lu en base
 * (0043), ou dans le jeu de démonstration du dépôt de référence.
 */
type BudgetReferencesViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function BudgetReferencesView({ siteKey }: BudgetReferencesViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadBudget, EMPTY_BUDGET_REGISTRY, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const references = state.registry.cost_references;
  const findings = useMemo(() => missingCostFindings(site, references), [site, references]);
  const cited = useMemo(() => new Set(citedTypologies(site)), [site]);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  const rows = references;
  const visible = rows.filter(r => {
    if (filter === PRICED) return r.unit_cost !== null;
    if (filter === UNPRICED) return r.unit_cost === null;
    return true;
  });
  const selected = rows.find(r => r.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('budgetrefs.filter.all') },
    { id: PRICED, label: t('budgetrefs.filter.priced') },
    { id: UNPRICED, label: t('budgetrefs.filter.unpriced') },
  ];
  const stateTag = (r: CostReference): JSX.Element => (r.unit_cost === null
    ? <Tag label={t('budgetrefs.state.unpriced')} severity="warning" />
    : <Tag label={t('budgetrefs.state.priced')} severity="valid" />);

  const columns: readonly Column<CostReference>[] = [
    { id: 'typology', header: t('budget.col.typology'), cell: r => r.typology_key },
    { id: 'substrate', header: t('budget.col.substrate'), cell: r => r.substrate_key },
    { id: 'manufacturer', header: t('budget.col.manufacturer'), cell: r => r.manufacturer_name ?? '—' },
    { id: 'state', header: t('budgetrefs.col.state'), cell: stateTag },
    { id: 'cost', header: t('budget.col.unitcost'), numeric: true, cell: r => formatMoney(r.unit_cost, lang, t('budget.unpriced')) },
    { id: 'since', header: t('budget.col.since'), cell: r => r.since ?? '—' },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('budgetrefs.inspector.empty')} />
    : (
      <Inspector
        title={selected.typology_key}
        subtitle={t('budgetrefs.inspector.subtitle', {
          substrate: selected.substrate_key,
          state: selected.unit_cost === null ? t('budgetrefs.state.unpriced') : t('budgetrefs.state.priced'),
        })}
        sections={[
          {
            id: 'reference',
            title: t('budgetrefs.section.reference'),
            rows: [
              { id: 'manufacturer', label: t('budget.col.manufacturer'), value: selected.manufacturer_name ?? '—' },
              { id: 'since', label: t('budget.col.since'), value: selected.since ?? '—' },
              { id: 'currency', label: t('budgetrefs.field.currency'), value: selected.unit_cost?.currency ?? '—' },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'cost', label: t('budget.col.unitcost'), value: formatMoney(selected.unit_cost, lang, t('budget.unpriced')), computed: true },
              {
                id: 'cited',
                label: t('budgetrefs.field.cited'),
                value: cited.has(selected.typology_key) ? t('placement.point.yes') : t('placement.point.no'),
                computed: true,
              },
            ],
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          <FindingList
            findings={findings.filter(f => f.entity?.id === selected.typology_key)}
            empty={t('budget.audit.empty')}
          />
        </section>
      </Inspector>
    );

  return (
    <div>
      <RegistryStatus state={state} />
      <RegisterLayout
        title={t('budget.panel.references')}
        summary={t('budgetrefs.summary', { count: rows.length, missing: findings.length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('budgetrefs.shown', { count: visible.length })}
        inspector={inspector}
        note={t('budget.audit.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.id}
          empty={t('budget.references.empty')}
          onSelect={r => { setSelectedId(r.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}

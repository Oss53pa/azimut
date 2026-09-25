import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { auditCostReferences } from '../domain/cost-reference.js';
import {
  DEMO_COST_REFERENCES, DEMO_REFERENCED_TYPOLOGIES, type CostReference,
} from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { formatMoney } from './budget/money.js';

const ALL = 'all';
const PRICED = 'priced';
const UNPRICED = 'unpriced';

/**
 * Module 09 — les coûts de référence (H8), au gabarit « registre ». Un coût
 * absent n'est pas estimé : la typologie reste non chiffrée, et le garde
 * `auditCostReferences` la signale si le carnet la cite. Jeu de démonstration.
 */
export function BudgetReferencesView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const priced = new Set(DEMO_COST_REFERENCES.filter(r => r.unit_cost !== null).map(r => r.typology));
    const result = auditCostReferences(DEMO_REFERENCED_TYPOLOGIES, priced);
    return result.ok ? result.warnings : result.findings;
  }, []);
  const cited = new Set(DEMO_REFERENCED_TYPOLOGIES);
  const rows = [...DEMO_COST_REFERENCES].sort((a, b) => a.typology.localeCompare(b.typology));
  const visible = rows.filter(r => {
    if (filter === PRICED) return r.unit_cost !== null;
    if (filter === UNPRICED) return r.unit_cost === null;
    return true;
  });
  const selected = rows.find(r => r.typology === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('budgetrefs.filter.all') },
    { id: PRICED, label: t('budgetrefs.filter.priced') },
    { id: UNPRICED, label: t('budgetrefs.filter.unpriced') },
  ];
  const state = (r: CostReference): JSX.Element => (r.unit_cost === null
    ? <Tag label={t('budgetrefs.state.unpriced')} severity="warning" />
    : <Tag label={t('budgetrefs.state.priced')} severity="valid" />);

  const columns: readonly Column<CostReference>[] = [
    { id: 'typology', header: t('budget.col.typology'), cell: r => r.typology },
    { id: 'substrate', header: t('budget.col.substrate'), cell: r => r.substrate },
    { id: 'manufacturer', header: t('budget.col.manufacturer'), cell: r => r.manufacturer ?? '—' },
    { id: 'state', header: t('budgetrefs.col.state'), cell: state },
    { id: 'cost', header: t('budget.col.unitcost'), numeric: true, cell: r => formatMoney(r.unit_cost, lang, t('budget.unpriced')) },
    { id: 'since', header: t('budget.col.since'), cell: r => r.since ?? '—' },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('budgetrefs.inspector.empty')} />
    : (
      <Inspector
        title={selected.typology}
        subtitle={t('budgetrefs.inspector.subtitle', {
          substrate: selected.substrate,
          state: selected.unit_cost === null ? t('budgetrefs.state.unpriced') : t('budgetrefs.state.priced'),
        })}
        sections={[
          {
            id: 'reference',
            title: t('budgetrefs.section.reference'),
            rows: [
              { id: 'manufacturer', label: t('budget.col.manufacturer'), value: selected.manufacturer ?? '—' },
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
                value: cited.has(selected.typology) ? t('placement.point.yes') : t('placement.point.no'),
                computed: true,
              },
            ],
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          <FindingList
            findings={findings.filter(f => f.entity?.id === selected.typology)}
            empty={t('budget.audit.empty')}
          />
        </section>
      </Inspector>
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
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
          rowKey={r => r.typology}
          empty={t('budget.references.empty')}
          onSelect={r => { setSelectedId(r.typology); }}
          selectedKey={selected?.typology}
        />
      </RegisterLayout>
    </div>
  );
}

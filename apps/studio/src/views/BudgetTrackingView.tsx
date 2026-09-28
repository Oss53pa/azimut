import { type JSX, useMemo, useState } from 'react';
import { EMPTY_BUDGET_REGISTRY, EMPTY_WORKSITE_REGISTRY, type BudgetLine } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { loadBudget, loadWorksite, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { formatMoney, share, variance } from './budget/money.js';
import { phaseKey } from './budget/labels.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';

type LineState = 'unpriced' | 'estimated' | 'quoted' | 'realized';

function lineState(l: BudgetLine): LineState {
  if (l.actual !== null) return 'realized';
  if (l.quoted !== null) return 'quoted';
  if (l.estimated !== null) return 'estimated';
  return 'unpriced';
}

/** Écart du devis à l'estimation, en pour-cent, quand les deux existent. */
function quoteGap(l: BudgetLine): number | null {
  const ratio = share(l.quoted, l.estimated);
  return ratio === null ? null : ratio - 100;
}

const STATE_SEVERITY: Readonly<Record<LineState, Severity>> = {
  unpriced: 'warning',
  estimated: 'info',
  quoted: 'info',
  realized: 'valid',
};

/**
 * Module 09 — le suivi budgétaire (H8), au gabarit « registre » : une ligne
 * par phase, de l'estimation au devis et au réalisé. L'écart et la
 * consommation se calculent en unité mineure, dans une seule devise ; ils ne
 * se saisissent pas. Lu en base (0043), ou dans le jeu de démonstration du
 * dépôt de référence.
 */
type BudgetTrackingViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function BudgetTrackingView({ siteKey }: BudgetTrackingViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const state = useRegistry(loadBudget, EMPTY_BUDGET_REGISTRY, siteKey);
  // Le lot d'une ligne se nomme par son code, qui vit au module 07.
  const worksite = useRegistry(loadWorksite, EMPTY_WORKSITE_REGISTRY, siteKey);
  const lotCodes = useMemo(() => new Map(worksite.registry.lots.map(l => [l.id, l.code])), [worksite.registry]);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  const rows = state.registry.budget_lines;
  const visible = filter === ALL ? rows : rows.filter(l => lineState(l) === filter);
  const selected = rows.find(l => l.id === selectedId) ?? visible[0] ?? null;
  const present = [...new Set(rows.map(lineState))];

  const pct = (v: number | null, signed: boolean): string => {
    if (v === null) return t('budget.novariance');
    return `${signed && v >= 0 ? '+' : ''}${formatNumber(v, lang, 1)} %`;
  };
  const phase = (l: BudgetLine): string => { const key = phaseKey(l.phase_key); return key === null ? l.phase_key : t(key); };
  const lot = (l: BudgetLine): string => (l.lot_id === null ? '—' : lotCodes.get(l.lot_id) ?? l.lot_id);
  const money = (l: BudgetLine, which: 'estimated' | 'quoted' | 'actual'): string =>
    formatMoney(l[which], lang, which === 'estimated' ? t('budget.unpriced') : '—');

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('budgettrack.filter.all') },
    ...present.map(s => ({ id: s, label: t(`budgettrack.state.${s}`) })),
  ];

  const columns: readonly Column<BudgetLine>[] = [
    { id: 'phase', header: t('budget.col.phase'), cell: phase },
    { id: 'lot', header: t('budget.col.lot'), cell: lot },
    { id: 'estimated', header: t('budget.col.estimated'), numeric: true, cell: l => money(l, 'estimated') },
    { id: 'quoted', header: t('budget.col.quoted'), numeric: true, cell: l => money(l, 'quoted') },
    { id: 'actual', header: t('budget.col.actual'), numeric: true, cell: l => money(l, 'actual') },
    {
      id: 'state',
      header: t('budgettrack.col.state'),
      cell: l => <Tag label={t(`budgettrack.state.${lineState(l)}`)} severity={STATE_SEVERITY[lineState(l)]} />,
    },
    { id: 'variance', header: t('budget.col.variance'), numeric: true, cell: l => pct(variance(l), true) },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('budgettrack.inspector.empty')} />
    : (
      <Inspector
        title={phase(selected)}
        subtitle={t('budgettrack.inspector.subtitle', {
          lot: lot(selected),
          state: t(`budgettrack.state.${lineState(selected)}`),
        })}
        sections={[
          {
            id: 'amounts',
            title: t('budgettrack.section.amounts'),
            rows: [
              { id: 'estimated', label: t('budget.col.estimated'), value: money(selected, 'estimated') },
              { id: 'quoted', label: t('budget.col.quoted'), value: money(selected, 'quoted') },
              { id: 'actual', label: t('budget.col.actual'), value: money(selected, 'actual') },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('budgettrack.section.computed.note'),
            rows: [
              { id: 'variance', label: t('budget.col.variance'), value: pct(variance(selected), true), computed: true },
              { id: 'consumed', label: t('budgettrack.field.consumed'), value: pct(share(selected.actual, selected.quoted), false), computed: true },
              {
                id: 'quote',
                label: t('budgettrack.field.quotevsestimate'),
                value: pct(quoteGap(selected), true),
                computed: true,
              },
            ],
          },
        ]}
      />
    );

  return (
    <div>
      <RegistryStatus state={state} />
      <RegisterLayout
        title={t('budgettrack.title')}
        summary={t('budgettrack.summary', { count: rows.length, unpriced: rows.filter(l => l.estimated === null).length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('budgettrack.shown', { count: visible.length })}
        inspector={inspector}
        note={t('budget.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={l => l.id}
          empty={t('budget.lines.empty')}
          onSelect={l => { setSelectedId(l.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}

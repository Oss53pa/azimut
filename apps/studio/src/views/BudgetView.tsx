import { type JSX, useMemo } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { auditCostReferences } from '../domain/cost-reference.js';
import {
  DEMO_BUDGET_LINES, DEMO_COST_REFERENCES, DEMO_REFERENCED_TYPOLOGIES,
  type BudgetLine, type CostReference, type Money,
} from '../domain/demo/production.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { formatMoney as formatMoneyIn, variance } from './budget/money.js';
import { phaseKey } from './budget/labels.js';

/**
 * Module 09 — budget et estimation. Une typologie sans coût de référence
 * n'est pas chiffrée au hasard : la ligne reste non chiffrée et le dit.
 */
export function BudgetView(): JSX.Element {
  const { t, lang } = useI18n();
  const formatMoney = (money: Money | null, unpriced: string): string => formatMoneyIn(money, lang, unpriced);

  const priced = useMemo(
    () => new Set(
      DEMO_COST_REFERENCES.filter(r => r.unit_cost !== null).map(r => r.typology),
    ),
    [],
  );

  const missing = useMemo(() => {
    const result = auditCostReferences(DEMO_REFERENCED_TYPOLOGIES, priced);
    return result.ok ? result.warnings : result.findings;
  }, [priced]);

  const currencies = new Set<string>();
  let committedMinor = 0;
  let actualMinor = 0;
  for (const line of DEMO_BUDGET_LINES) {
    const quoted = line.quoted;
    const actual = line.actual;
    if (quoted !== null) { currencies.add(quoted.currency); committedMinor += quoted.minor; }
    if (actual !== null) { currencies.add(actual.currency); actualMinor += actual.minor; }
  }
  const singleCurrency = currencies.size <= 1;
  const currency = [...currencies][0] ?? 'EUR';
  const unpriced = DEMO_BUDGET_LINES.filter(l => l.estimated === null).length;

  const metrics: readonly Metric[] = [
    {
      id: 'committed',
      label: t('budget.metric.committed'),
      value: singleCurrency
        ? formatMoney({ minor: committedMinor, currency }, t('budget.unpriced'))
        : t('budget.mixed'),
    },
    {
      id: 'actual',
      label: t('budget.metric.actual'),
      value: singleCurrency
        ? formatMoney({ minor: actualMinor, currency }, t('budget.unpriced'))
        : t('budget.mixed'),
    },
    {
      id: 'unpriced',
      label: t('budget.metric.unpriced'),
      value: String(unpriced),
      severity: unpriced > 0 ? 'warning' : 'valid',
    },
    {
      id: 'missing',
      label: t('budget.metric.missingrefs'),
      value: String(missing.length),
      severity: missing.length > 0 ? 'warning' : 'valid',
    },
    { id: 'currencies', label: t('budget.metric.currencies'), value: [...currencies].sort().join(' · ') },
  ];

  const lineColumns: readonly Column<BudgetLine>[] = [
    { id: 'phase', header: t('budget.col.phase'), cell: l => t(phaseKey(l.phase_key)) },
    { id: 'lot', header: t('budget.col.lot'), cell: l => l.lot_id ?? '—' },
    {
      id: 'estimated',
      header: t('budget.col.estimated'),
      numeric: true,
      cell: l => formatMoney(l.estimated, t('budget.unpriced')),
    },
    {
      id: 'quoted',
      header: t('budget.col.quoted'),
      numeric: true,
      cell: l => formatMoney(l.quoted, '—'),
    },
    {
      id: 'actual',
      header: t('budget.col.actual'),
      numeric: true,
      cell: l => formatMoney(l.actual, '—'),
    },
    {
      id: 'variance',
      header: t('budget.col.variance'),
      numeric: true,
      cell: l => {
        const v = variance(l);
        if (v === null) return <Tag label={t('budget.novariance')} muted />;
        return (
          <Tag
            label={`${v > 0 ? '+' : ''}${v.toFixed(1)} %`}
            severity={Math.abs(v) > 5 ? 'warning' : 'valid'}
          />
        );
      },
    },
  ];

  const referenceColumns: readonly Column<CostReference>[] = [
    { id: 'typology', header: t('budget.col.typology'), cell: r => r.typology },
    { id: 'substrate', header: t('budget.col.substrate'), cell: r => r.substrate },
    { id: 'manufacturer', header: t('budget.col.manufacturer'), cell: r => r.manufacturer ?? '—' },
    {
      id: 'cost',
      header: t('budget.col.unitcost'),
      numeric: true,
      cell: r => r.unit_cost === null
        ? <Tag label={t('budget.reference.absent')} severity="warning" />
        : formatMoney(r.unit_cost, t('budget.unpriced')),
    },
    { id: 'since', header: t('budget.col.since'), cell: r => r.since ?? '—' },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('budget.eyebrow')}
        title={t('budget.title')}
        subtitle={t('budget.subtitle')}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
        {missing.length > 0 && (
          <StateBanner
            severity="warning"
            code="COST.REFERENCE_MISSING"
            message={t('budget.missing.message', { count: missing.length })}
            hint={t('budget.missing.hint')}
          />
        )}
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('budget.panel.lines')} note={t('budget.panel.lines.note')} padded={false}>
          <DataTable columns={lineColumns} rows={DEMO_BUDGET_LINES} rowKey={l => l.id} empty={t('budget.lines.empty')} />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={340}>
          <Panel title={t('budget.panel.references')} note={t('budget.panel.references.note')} padded={false}>
            <DataTable
              columns={referenceColumns}
              rows={DEMO_COST_REFERENCES}
              rowKey={r => r.typology}
              empty={t('budget.references.empty')}
            />
          </Panel>
          <Panel title={t('budget.panel.audit')} note={String(missing.length)}>
            <FindingList findings={missing} empty={t('budget.audit.empty')} />
            <Note>{t('budget.audit.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('budget.note')}</Note>
    </div>
  );
}

import { type JSX, useMemo } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { Finding } from '@azimut/core-model';
import { guardPlacementBookings, auditOptionExpiry, type BookingState } from '../domain/ad-planning.js';
import { guardAdRulesPack } from '@azimut/engine-graph';
import { receiveCreatives, type CreativeIntake } from '../domain/ad-creative-intake.js';
import {
  DEMO_PLACEMENTS, DEMO_BOOKINGS, DEMO_OPTIONS,
  DEMO_CREATIVES, DEMO_CREATIVE_SPEC, DEMO_AD_RULES_PACK,
  type CreativeSubmission,
} from '../domain/demo/commerce.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Metric, type Column, type Severity,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { monthsFrom, stateAt, occupancyRate } from './advertising/occupancy.js';

/** Date d'observation : lue une fois ici, jamais dans un moteur (E5.1). */
function observationDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATE_SEVERITY: Readonly<Record<BookingState, Severity | undefined>> = {
  free: undefined,
  option: 'warning',
  reserved: 'info',
  occupied: 'valid',
  maintenance: 'warning',
  retired: undefined,
};

const STATE_KEYS = {
  free: 'ads.state.free',
  option: 'ads.state.option',
  reserved: 'ads.state.reserved',
  occupied: 'ads.state.occupied',
  maintenance: 'ads.state.maintenance',
  retired: 'ads.state.retired',
} as const;

type PlacementRow = {
  readonly id: string;
  readonly typology: string;
  readonly area_m2: number;
  readonly advertiser: string | null;
  readonly states: readonly { readonly month: string; readonly state: BookingState }[];
};

/**
 * Module 05 — la régie publicitaire. Le planning d'occupation et le contrôle
 * automatique des visuels ; Azimut émet les états de vente, jamais le livre
 * comptable.
 */
export function AdvertisingView(): JSX.Element {
  const { t } = useI18n();
  const today = observationDate();
  const months = useMemo(() => monthsFrom(today, 6), [today]);

  const conflicts = useMemo<readonly Finding[]>(() => {
    const result = guardPlacementBookings(DEMO_BOOKINGS);
    return result.ok ? [] : result.findings;
  }, []);

  const expiredOptions = useMemo<readonly Finding[]>(() => {
    const result = auditOptionExpiry(DEMO_OPTIONS, today);
    return result.ok ? result.warnings : result.findings;
  }, [today]);

  /**
   * R7 — les règles publicitaires viennent d'une extension du paquet de règles.
   * En son absence, le module lève une anomalie et n'invente aucune règle : les
   * contrôles techniques de R6 (partie N) continuent, les appréciations déclaratives, non,
   * puisqu'elles reposeraient sur un règlement que personne n'a versé.
   */
  const rulesPackFindings = useMemo<readonly Finding[]>(() => {
    const result = guardAdRulesPack(DEMO_AD_RULES_PACK);
    return result.ok ? [] : result.findings;
  }, []);

  /**
   * R5 (partie N) puis R6 — chaque visuel reçu passe par l'assainissement avant tout, puis
   * par sa fiche technique. L'écran ne contrôle rien lui-même : il affiche le
   * constat de réception.
   */
  const intakes = useMemo(
    () => receiveCreatives(DEMO_CREATIVES, DEMO_CREATIVE_SPEC),
    [],
  );
  const intakeById = useMemo(() => {
    const byId = new Map<string, CreativeIntake>();
    for (const intake of intakes) byId.set(intake.creative_id, intake);
    return byId;
  }, [intakes]);
  const unrenderable = intakes.filter(i => !i.renderable).length;

  const rows = useMemo<readonly PlacementRow[]>(() =>
    DEMO_PLACEMENTS.map((placement): PlacementRow => ({
      id: placement.id,
      typology: placement.typology,
      area_m2: placement.area_m2,
      advertiser: placement.advertiser,
      states: months.map(month => ({
        month,
        state: stateAt(DEMO_BOOKINGS, placement.id, month),
      })),
    })), [months]);

  const firstMonth = months[0] ?? '';
  const rate = occupancyRate(DEMO_BOOKINGS, DEMO_PLACEMENTS.map(p => p.id), firstMonth);
  const toReview = DEMO_CREATIVES.filter(c => c.verdict === 'human_review').length;

  const metrics: readonly Metric[] = [
    { id: 'rate', label: t('ads.metric.rate'), value: `${String(rate)} %`, note: firstMonth },
    { id: 'placements', label: t('ads.metric.placements'), value: String(DEMO_PLACEMENTS.length) },
    {
      id: 'conflicts',
      label: t('ads.metric.conflicts'),
      value: String(conflicts.length),
      severity: conflicts.length > 0 ? 'blocking' : 'valid',
    },
    {
      id: 'options',
      label: t('ads.metric.expired'),
      value: String(expiredOptions.length),
      severity: expiredOptions.length > 0 ? 'warning' : 'valid',
    },
    { id: 'review', label: t('ads.metric.review'), value: String(toReview) },
    {
      id: 'unrenderable',
      label: t('ads.metric.unrenderable'),
      value: String(unrenderable),
      note: t('ads.metric.unrenderable.note'),
      severity: unrenderable > 0 ? 'warning' : 'valid',
    },
  ];

  const columns: readonly Column<PlacementRow>[] = [
    { id: 'id', header: t('ads.col.placement'), cell: r => r.id },
    { id: 'typology', header: t('ads.col.typology'), cell: r => r.typology },
    { id: 'area', header: t('ads.col.area'), numeric: true, cell: r => r.area_m2.toFixed(1) },
    ...months.map((month): Column<PlacementRow> => ({
      id: month,
      header: month.slice(5),
      cell: r => {
        const found = r.states.find(s => s.month === month);
        const state: BookingState = found?.state ?? 'free';
        return <Tag label={t(STATE_KEYS[state])} severity={STATE_SEVERITY[state]} muted={state === 'free'} />;
      },
    })),
    {
      id: 'advertiser',
      header: t('ads.col.advertiser'),
      cell: r => r.advertiser ?? t('ads.noadvertiser'),
    },
  ];

  const creativeColumns: readonly Column<CreativeSubmission>[] = [
    { id: 'id', header: t('ads.creative.col.id'), cell: s => s.creative.id },
    { id: 'placement', header: t('ads.creative.col.placement'), cell: s => s.placement_id },
    {
      id: 'intake',
      header: t('ads.creative.col.intake'),
      cell: s => {
        const intake = intakeById.get(s.creative.id);
        if (intake === undefined) return t('ads.creative.conform');
        return (
          <Tag
            label={t(SANITATION_KEYS[intake.sanitation])}
            severity={intake.renderable ? 'valid' : intake.sanitation === 'failed' ? 'blocking' : 'warning'}
          />
        );
      },
    },
    {
      id: 'checks',
      header: t('ads.creative.col.checks'),
      cell: s => {
        const findings = intakeById.get(s.creative.id)?.findings ?? [];
        if (findings.length === 0) return t('ads.creative.conform');
        return findings
          .map(f => String(f.params['axis'] ?? f.params['reason'] ?? ''))
          .join(' · ');
      },
    },
    {
      id: 'verdict',
      header: t('ads.creative.col.verdict'),
      cell: s => (
        <Tag
          label={t(VERDICT_KEYS[s.verdict])}
          severity={s.verdict === 'approved' ? 'valid' : s.verdict === 'refused' ? 'blocking' : 'warning'}
        />
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('ads.eyebrow')}
        title={t('ads.title')}
        subtitle={t('ads.subtitle')}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        {rulesPackFindings.length > 0 && (
          <StateBanner
            severity="blocking"
            code="AD.RULES_PACK_MISSING"
            message={t('ads.rulespack.missing')}
            hint={t('ads.rulespack.hint')}
          />
        )}
        <StateBanner
          severity="info"
          message={t('demo.dataset.message')}
          hint={t('demo.dataset.hint')}
        />
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('ads.panel.schedule')} note={t('ads.panel.schedule.note', { date: today })} padded={false}>
          <DataTable columns={columns} rows={rows} rowKey={r => r.id} empty={t('ads.empty')} />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('ads.panel.creatives')} note={t('ads.panel.creatives.note')} padded={false}>
          <DataTable
            columns={creativeColumns}
            rows={DEMO_CREATIVES}
            rowKey={s => s.creative.id}
            empty={t('ads.creatives.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('ads.panel.conflicts')}>
            <FindingList findings={conflicts} empty={t('ads.conflicts.empty')} />
          </Panel>
          <Panel title={t('ads.panel.options')}>
            <FindingList findings={expiredOptions} empty={t('ads.options.empty')} />
          </Panel>
          <Panel title={t('ads.panel.rulespack')}>
            <FindingList findings={rulesPackFindings} empty={t('ads.rulespack.attached')} />
            <Note>{t('ads.rulespack.note')}</Note>
          </Panel>
          <Panel title={t('ads.panel.intake')}>
            <FindingList
              findings={intakes.flatMap(i => i.findings)}
              empty={t('ads.intake.empty')}
              limit={8}
            />
            <Note>{t('ads.intake.note')}</Note>
          </Panel>
          <Panel title={t('ads.panel.spec')}>
            <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
              <SpecRow label={t('ads.spec.format')} value={DEMO_CREATIVE_SPEC.format} />
              <SpecRow label={t('ads.spec.resolution')} value={`${String(DEMO_CREATIVE_SPEC.min_resolution_dpi)} dpi`} />
              <SpecRow label={t('ads.spec.safezone')} value={`${String(DEMO_CREATIVE_SPEC.safe_zone_mm)} mm`} />
              <SpecRow label={t('ads.spec.profile')} value={DEMO_CREATIVE_SPEC.color_profile} />
              <SpecRow
                label={t('ads.spec.weight')}
                value={`${String(Math.round(DEMO_CREATIVE_SPEC.max_weight_bytes / 1_048_576))} Mo`}
              />
            </dl>
            <Note>{t('ads.spec.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('ads.note')}</Note>
    </div>
  );
}

const SANITATION_KEYS = {
  clean: 'ads.sanitation.clean',
  failed: 'ads.sanitation.failed',
  deferred: 'ads.sanitation.deferred',
} as const;

const VERDICT_KEYS = {
  approved: 'ads.verdict.approved',
  refused: 'ads.verdict.refused',
  human_review: 'ads.verdict.review',
} as const;

type SpecRowProps = {
  readonly label: string;
  readonly value: string;
};

function SpecRow({ label, value }: SpecRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</dd>
    </div>
  );
}

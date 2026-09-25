import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { receiveCreatives, type CreativeIntake } from '../domain/ad-creative-intake.js';
import {
  DEMO_CREATIVES, DEMO_CREATIVE_SPEC, type CreativeSubmission, type CreativeVerdict,
} from '../domain/demo/commerce.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE, TEXT,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';
const CONFORM = 'conform';
const REWORK = 'rework';
const REVIEW = 'review';
const MB = 1024 * 1024;

type CreativeRow = {
  readonly submission: CreativeSubmission;
  readonly intake: CreativeIntake;
  /** Écarts à la fiche technique, relevés par le garde (H4.6). */
  readonly mismatches: number;
};

const VERDICT_KEYS = {
  approved: 'ads.verdict.approved',
  refused: 'ads.verdict.refused',
  human_review: 'ads.verdict.review',
} as const satisfies Readonly<Record<CreativeVerdict, string>>;

const VERDICT_SEVERITY: Readonly<Record<CreativeVerdict, Severity>> = {
  approved: 'valid',
  refused: 'blocking',
  human_review: 'warning',
};

/**
 * Module 05 — la réception des visuels (H4.6), au gabarit « registre ».
 *
 * Chaque visuel passe par l'assainissement (M05.R5, partie N) puis par le garde de la
 * fiche technique : format, résolution, zone de sécurité, profil, poids. Le
 * contrôle porte sur la fabricabilité, jamais sur le contenu ; la décision
 * finale reste humaine. Jeu de démonstration, comme le reste du module.
 */
export function AdCreativesView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo<readonly CreativeRow[]>(() => {
    const intakes = receiveCreatives(DEMO_CREATIVES, DEMO_CREATIVE_SPEC);
    return DEMO_CREATIVES.map((submission, i) => {
      const intake = intakes[i] ?? {
        creative_id: submission.creative.id, sanitation: 'deferred', renderable: false, findings: [],
      };
      return {
        submission,
        intake,
        mismatches: intake.findings.filter(f => f.code === 'AD.CREATIVE_SPEC_MISMATCH').length,
      };
    }).sort((a, b) => a.submission.creative.id.localeCompare(b.submission.creative.id));
  }, []);

  const visible = rows.filter(r => {
    if (filter === CONFORM) return r.mismatches === 0;
    if (filter === REWORK) return r.mismatches > 0;
    if (filter === REVIEW) return r.submission.verdict === 'human_review';
    return true;
  });
  const selected = rows.find(r => r.submission.creative.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('adcreatives.filter.all') },
    { id: CONFORM, label: t('adcreatives.filter.conform') },
    { id: REWORK, label: t('adcreatives.filter.rework') },
    { id: REVIEW, label: t('adcreatives.filter.review') },
  ];

  const control = (r: CreativeRow): JSX.Element => (r.mismatches === 0
    ? <Tag label={t('adcreatives.control.ok')} severity="valid" />
    : <Tag label={t('adcreatives.control.mismatch', { count: r.mismatches })} severity="blocking" />);

  const columns: readonly Column<CreativeRow>[] = [
    { id: 'id', header: t('adcreatives.col.creative'), cell: r => r.submission.creative.id },
    { id: 'placement', header: t('ads.col.placement'), cell: r => r.submission.placement_id },
    { id: 'format', header: t('ads.spec.format'), cell: r => r.submission.creative.format },
    { id: 'dpi', header: t('adcreatives.col.dpi'), numeric: true, cell: r => String(r.submission.creative.resolution_dpi) },
    { id: 'weight', header: t('adcreatives.col.weight'), numeric: true, cell: r => formatNumber(r.submission.creative.weight_bytes / MB, lang, 1) },
    { id: 'control', header: t('adcreatives.col.control'), cell: control },
    { id: 'sanitation', header: t('adcreatives.col.sanitation'), cell: r => t(`ads.sanitation.${r.intake.sanitation}`) },
    {
      id: 'verdict',
      header: t('adcreatives.col.verdict'),
      cell: r => <Tag label={t(VERDICT_KEYS[r.submission.verdict])} severity={VERDICT_SEVERITY[r.submission.verdict]} />,
    },
  ];

  const spec = DEMO_CREATIVE_SPEC;
  const inspector = selected === null
    ? <InspectorEmpty text={t('adcreatives.inspector.empty')} />
    : (
      <Inspector
        title={selected.submission.creative.id}
        subtitle={t('adcreatives.inspector.subtitle', {
          placement: selected.submission.placement_id,
          verdict: t(VERDICT_KEYS[selected.submission.verdict]),
        })}
        sections={[
          {
            id: 'received',
            title: t('adcreatives.section.received'),
            rows: [
              { id: 'format', label: t('ads.spec.format'), value: selected.submission.creative.format },
              { id: 'dpi', label: t('adcreatives.field.resolution'), value: String(selected.submission.creative.resolution_dpi), unit: 'dpi' },
              { id: 'safe', label: t('ads.spec.safezone'), value: String(selected.submission.creative.safe_zone_mm), unit: 'mm' },
              { id: 'profile', label: t('ads.spec.profile'), value: selected.submission.creative.color_profile },
              { id: 'weight', label: t('adcreatives.field.weight'), value: formatNumber(selected.submission.creative.weight_bytes / MB, lang, 1), unit: 'Mo' },
            ],
          },
          {
            id: 'spec',
            title: t('adcreatives.section.spec'),
            note: t('ads.spec.note'),
            rows: [
              { id: 'format', label: t('ads.spec.format'), value: spec.format },
              { id: 'dpi', label: t('ads.spec.resolution'), value: String(spec.min_resolution_dpi), unit: 'dpi' },
              { id: 'safe', label: t('ads.spec.safezone'), value: String(spec.safe_zone_mm), unit: 'mm' },
              { id: 'profile', label: t('ads.spec.profile'), value: spec.color_profile },
              { id: 'weight', label: t('ads.spec.weight'), value: formatNumber(spec.max_weight_bytes / MB, lang, 1), unit: 'Mo' },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'mismatches', label: t('adcreatives.field.mismatches'), value: String(selected.mismatches), computed: true },
              { id: 'sanitation', label: t('adcreatives.col.sanitation'), value: t(`ads.sanitation.${selected.intake.sanitation}`), computed: true },
            ],
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          {selected.intake.renderable && selected.intake.clean_svg !== undefined && (
            <div
              className="az-svg-fit"
              role="img"
              aria-label={t('adcreatives.preview.aria', { creative: selected.submission.creative.id })}
              style={{ border: '1px solid var(--border-hairline)', borderRadius: 4, marginBottom: SPACE.sm, color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: selected.intake.clean_svg }}
            />
          )}
          <FindingList findings={selected.intake.findings} empty={t('adcreatives.findings.none')} />
          <p style={{ margin: `${String(SPACE.sm)}px 0 0`, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
            {t('adcreatives.inspector.note')}
          </p>
        </section>
      </Inspector>
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('adcreatives.title')}
        summary={t('adcreatives.summary', { count: rows.length, rework: rows.filter(r => r.mismatches > 0).length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('adcreatives.shown', { count: visible.length })}
        inspector={inspector}
        note={t('adcreatives.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.submission.creative.id}
          empty={t('adcreatives.empty')}
          onSelect={r => { setSelectedId(r.submission.creative.id); }}
          selectedKey={selected?.submission.creative.id}
        />
      </RegisterLayout>
    </div>
  );
}

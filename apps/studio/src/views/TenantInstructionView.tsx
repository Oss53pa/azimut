import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { DEMO_SIGN_DOSSIERS, DEMO_SIGN_REGULATION } from '../domain/demo/commerce.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner, SelectField, SPACE, TEXT,
  type Metric, type Column,
} from '../components/ui/index.js';
import { instructDossier, requested, type ArticleCheck } from './tenant/articles.js';
import { AXIS_KEYS } from './tenant/labels.js';
import { formatDay, formatNumber } from './register/format.js';

const PART_KEYS: Readonly<Record<string, UiMessageKey>> = {
  elevation: 'tenant.part.elevation',
  section: 'tenant.part.section',
  material_samples: 'tenant.part.samples',
};

/**
 * Module 06 — l'instruction d'un dossier d'enseigne (H5.2), article par
 * article. Chaque résultat vient du garde `guardSignProject` ; la lecture en
 * bas de page ne fait que résumer ses écarts et les pièces manquantes. La
 * décision reste humaine : aucun accord ni refus ne se prononce ici.
 */
export function TenantInstructionView(): JSX.Element {
  const { t, lang } = useI18n();
  const [dossierId, setDossierId] = useState(DEMO_SIGN_DOSSIERS[0]?.id ?? '');
  const dossier = DEMO_SIGN_DOSSIERS.find(d => d.id === dossierId) ?? DEMO_SIGN_DOSSIERS[0];
  const instruction = useMemo(
    () => (dossier === undefined ? null : instructDossier(dossier, DEMO_SIGN_REGULATION)),
    [dossier],
  );

  const banner = <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />;
  if (dossier === undefined || instruction === null) {
    return <div>{banner}<Note>{t('tenant.empty')}</Note></div>;
  }

  const gaps = instruction.checks.filter(c => c.findings.length > 0);
  const partLabel = (key: string): string => {
    const k = PART_KEYS[key];
    return k === undefined ? key : t(k);
  };
  const mm = (v: number): string => `${formatNumber(v, lang, 0)} mm`;
  const requirement = (c: ArticleCheck): string => {
    const a = c.article;
    if (a.limitMm !== null) return t('tenantrules.requirement.max', { value: formatNumber(a.limitMm, lang, 0) });
    if (a.axis === 'forbidden_feature') return t('tenantrules.requirement.forbidden', { values: a.values.join(', ') });
    return t('tenantrules.requirement.allowed', { values: a.values.join(', ') });
  };
  const asked = (c: ArticleCheck): string => {
    const r = requested(dossier.project, c.article.axis);
    if (r.mm !== null) return mm(r.mm);
    return r.values.length === 0 ? t('tenant.axis.none') : r.values.join(', ');
  };

  const metrics: readonly Metric[] = [
    { id: 'articles', label: t('instruction.metric.articles'), value: String(instruction.checks.length) },
    { id: 'conform', label: t('instruction.metric.conform'), value: String(instruction.checks.length - gaps.length), severity: 'valid' },
    { id: 'gaps', label: t('instruction.metric.gaps'), value: String(gaps.length), severity: gaps.length > 0 ? 'blocking' : 'valid' },
    {
      id: 'parts', label: t('tenant.metric.missingparts'), value: String(instruction.missingParts.length),
      severity: instruction.missingParts.length > 0 ? 'warning' : 'valid',
    },
  ];

  const columns: readonly Column<ArticleCheck>[] = [
    { id: 'code', header: t('tenantrules.col.article'), cell: c => c.article.code },
    { id: 'axis', header: t('tenantrules.col.object'), cell: c => t(AXIS_KEYS[c.article.axis]) },
    { id: 'requirement', header: t('tenantrules.col.requirement'), cell: requirement },
    { id: 'asked', header: t('instruction.col.asked'), cell: asked },
    {
      id: 'result',
      header: t('instruction.col.result'),
      cell: c => (c.findings.length === 0
        ? <Tag label={t('instruction.result.ok')} severity="valid" />
        : <Tag label={t('instruction.result.gap')} severity="blocking" />),
    },
  ];

  const reading = instruction.missingParts.length > 0
    ? t('instruction.reading.parts', { count: instruction.missingParts.length })
    : gaps.length > 0
      ? t('instruction.reading.gaps', { count: gaps.length, articles: gaps.map(g => g.article.code).join(', ') })
      : t('instruction.reading.clear');

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>{banner}</div>
      <ScreenHeader title={t('instruction.title', { dossier: dossier.id })} subtitle={t('instruction.subtitle', { tenant: dossier.tenant, cell: dossier.cell_code })}>
        <div style={{ width: 280 }}>
          <SelectField
            label={t('instruction.dossier')}
            value={dossier.id}
            options={DEMO_SIGN_DOSSIERS.map(d => ({ value: d.id, label: `${d.id} · ${d.tenant}` }))}
            onChange={setDossierId}
          />
        </div>
      </ScreenHeader>
      <MetricRow metrics={metrics} />
      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={320}>
          <Panel title={t('instruction.panel.request')}>
            <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
              {([
                [t('tenant.col.tenant'), dossier.tenant],
                [t('tenant.col.cell'), dossier.cell_code],
                [t('tenant.col.state'), t(`tenant.state.${dossier.state}`)],
                [t('tenant.col.submitted'), formatDay(dossier.submitted_on, lang) ?? dossier.submitted_on],
                [t('tenant.axis.height'), mm(dossier.project.height_mm)],
                [t('tenant.axis.overhang'), mm(dossier.project.overhang_mm)],
                [t('tenant.axis.material'), dossier.project.material],
                [t('tenant.axis.lighting'), dossier.project.lighting],
              ] as const).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: SPACE.md }}>
                  <dt style={{ flex: 1, color: 'var(--text-secondary)' }}>{label}</dt>
                  <dd style={{ margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={t('tenant.panel.parts')} note={String(dossier.parts.length)}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: SPACE.xs }}>
              {dossier.parts.map(p => (
                <li key={p.key} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, fontSize: TEXT.small }}>
                  <span style={{ flex: 1 }}>{partLabel(p.key)}</span>
                  <Tag
                    label={p.provided ? t('tenant.part.provided') : t('tenant.part.missing')}
                    severity={p.provided ? 'valid' : 'warning'}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </PanelGrid>
      </div>
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('instruction.panel.articles')} note={String(instruction.checks.length)} padded={false}>
          <DataTable columns={columns} rows={instruction.checks} rowKey={c => c.article.code} empty={t('tenant.empty')} />
        </Panel>
      </div>
      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('instruction.panel.reading')}>
          <p style={{ margin: 0, fontSize: TEXT.body }}>{reading}</p>
        </Panel>
      </div>
      <Note>{t('instruction.note')}</Note>
    </div>
  );
}

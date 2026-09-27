import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_TENANT_REGISTRY } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { loadTenant, useRegistry } from '../data/index.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner, SelectField, SPACE, TEXT,
  type Metric, type Column,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { instructDossier, requested, type ArticleCheck } from './tenant/articles.js';
import { signDossiers } from './tenant/dossiers.js';
import { AXIS_KEYS, partKey } from './tenant/labels.js';
import { formatDay, formatNumber } from './register/format.js';

/**
 * Module 06 — l'instruction d'un dossier d'enseigne (H5.2), article par
 * article. Chaque résultat vient du garde `guardSignProject` ; la lecture en
 * bas de page ne fait que résumer ses écarts et les pièces manquantes. La
 * décision reste humaine : aucun accord ni refus ne se prononce ici. Le
 * dossier s'instruit contre la version du règlement en vigueur à son dépôt.
 */
type TenantInstructionViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function TenantInstructionView({ siteKey }: TenantInstructionViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadTenant, EMPTY_TENANT_REGISTRY, siteKey);
  const dossiers = useMemo(() => signDossiers(site, state.registry), [site, state.registry]);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const dossier = dossiers.find(d => d.id === dossierId) ?? dossiers[0];
  const instruction = useMemo(
    () => (dossier === undefined || dossier.regulation === null ? null : instructDossier(dossier, dossier.regulation)),
    [dossier],
  );

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  const banner = <RegistryStatus state={state} />;
  if (dossier === undefined) {
    return <div>{banner}<Note>{t('tenant.empty')}</Note></div>;
  }
  const tenant = dossier.tenant ?? t('tenant.destination.missing');
  const cell = dossier.cell_code ?? '—';
  if (instruction === null) {
    return (
      <div>
        {banner}
        <StateBanner severity="warning" message={t('tenant.regulation.none')} hint={t('tenant.regulation.none.hint')} />
      </div>
    );
  }

  const gaps = instruction.checks.filter(c => c.findings.length > 0);
  const partLabel = (key: string): string => {
    const k = partKey(key);
    return k === null ? key : t(k);
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
      {banner}
      <ScreenHeader title={t('instruction.title', { dossier: dossier.id })} subtitle={t('instruction.subtitle', { tenant, cell })}>
        <div style={{ width: 280 }}>
          <SelectField
            label={t('instruction.dossier')}
            value={dossier.id}
            options={dossiers.map(d => ({ value: d.id, label: `${d.id} · ${d.tenant ?? t('tenant.destination.missing')}` }))}
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
                [t('tenant.col.tenant'), tenant],
                [t('tenant.col.cell'), cell],
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

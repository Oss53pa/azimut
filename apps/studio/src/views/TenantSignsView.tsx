import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { Finding } from '@azimut/core-model';
import { EMPTY_TENANT_REGISTRY, regulationInForce } from '@azimut/core-model';
import { guardSignProject } from '../domain/tenant-regulation.js';
import { useSiteData } from '../context/useSiteData.js';
import { loadTenant, useRegistry } from '../data/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { signDossiers, type SignDossier } from './tenant/dossiers.js';
import { partKey } from './tenant/labels.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

const DOSSIER_STATE_KEYS = {
  submitted: 'tenant.state.submitted',
  instructing: 'tenant.state.instructing',
  approved: 'tenant.state.approved',
  refused: 'tenant.state.refused',
} as const;

/**
 * Module 06 — les enseignes locataires. Une enseigne appartient au locataire :
 * elle est instruite et suivie, jamais conçue ici. Les axes mesurables du
 * règlement sont contrôlés automatiquement ; le reste reste un avis humain.
 * Chaque dossier s'instruit contre la version du règlement en vigueur à son
 * dépôt. Lu en base (0046), ou dans le jeu de démonstration du dépôt de
 * référence.
 */
type TenantSignsViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function TenantSignsView({ siteKey }: TenantSignsViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const state = useRegistry(loadTenant, EMPTY_TENANT_REGISTRY, siteKey);
  const dossiers = useMemo(() => signDossiers(site, state.registry), [site, state.registry]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const selected = selectedId ?? dossiers[0]?.id ?? '';

  const violationsByDossier = useMemo(() => {
    const map = new Map<string, readonly Finding[]>();
    for (const dossier of dossiers) {
      // Sans règlement en vigueur au dépôt, il n'y a rien à enfreindre.
      const result = dossier.regulation === null ? null : guardSignProject(dossier.project, dossier.regulation);
      map.set(dossier.id, result === null || result.ok ? [] : result.findings);
    }
    return map;
  }, [dossiers]);

  const header = <ScreenHeader eyebrow={t('tenant.eyebrow')} title={t('tenant.title')} subtitle={t('tenant.subtitle')} />;
  if (state.status !== 'ready') return <div>{header}<RegistryStatus state={state} /></div>;

  const totalViolations = [...violationsByDossier.values()].reduce((n, f) => n + f.length, 0);
  const missingParts = dossiers.reduce(
    (n, d) => n + d.parts.filter(p => !p.provided).length, 0,
  );

  const metrics: readonly Metric[] = [
    { id: 'dossiers', label: t('tenant.metric.dossiers'), value: String(dossiers.length) },
    {
      id: 'violations',
      label: t('tenant.metric.violations'),
      value: String(totalViolations),
      severity: totalViolations > 0 ? 'blocking' : 'valid',
    },
    {
      id: 'parts',
      label: t('tenant.metric.missingparts'),
      value: String(missingParts),
      severity: missingParts > 0 ? 'warning' : 'valid',
    },
    {
      id: 'pending',
      label: t('tenant.metric.pending'),
      value: String(dossiers.filter(d => d.state !== 'approved').length),
    },
  ];

  const columns: readonly Column<SignDossier>[] = [
    { id: 'id', header: t('tenant.col.dossier'), cell: d => d.id },
    { id: 'cell', header: t('tenant.col.cell'), cell: d => d.cell_code ?? '—' },
    { id: 'tenant', header: t('tenant.col.tenant'), cell: d => d.tenant ?? t('tenant.destination.missing') },
    { id: 'submitted', header: t('tenant.col.submitted'), cell: d => d.submitted_on },
    {
      id: 'state',
      header: t('tenant.col.state'),
      cell: d => <Tag label={t(DOSSIER_STATE_KEYS[d.state])} severity={d.state === 'approved' ? 'valid' : 'warning'} />,
    },
    {
      id: 'violations',
      header: t('tenant.col.violations'),
      numeric: true,
      cell: d => {
        const count = (violationsByDossier.get(d.id) ?? []).length;
        return <Tag label={String(count)} severity={count > 0 ? 'blocking' : 'valid'} />;
      },
    },
  ];

  const partLabel = (key: string): string => { const k = partKey(key); return k === null ? key : t(k); };
  const dossier = dossiers.find(d => d.id === selected);
  // Le règlement montré est celui du dossier choisi ; sans dossier, celui
  // d'aujourd'hui.
  const regulation = dossier?.regulation
    ?? regulationInForce(state.registry.regulations, new Date().toISOString().slice(0, 10));

  return (
    <div>
      {header}
      <RegistryStatus state={state} />

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('tenant.panel.dossiers')} padded={false}>
          <DataTable
            columns={columns}
            rows={dossiers}
            rowKey={d => d.id}
            selectedKey={selected}
            onSelect={d => { setSelected(d.id); }}
            empty={t('tenant.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('tenant.panel.regulation')} note={t('tenant.panel.regulation.note')}>
            {regulation === null ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('tenant.regulation.none')}</p>
            ) : (
              <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
                <RuleRow
                  label={t('tenant.axis.height')}
                  value={regulation.max_height_mm === null
                    ? t('tenant.axis.unrestricted')
                    : `${String(regulation.max_height_mm)} mm`}
                  project={dossier === undefined ? null : `${String(dossier.project.height_mm)} mm`}
                />
                <RuleRow
                  label={t('tenant.axis.overhang')}
                  value={regulation.max_overhang_mm === null
                    ? t('tenant.axis.unrestricted')
                    : `${String(regulation.max_overhang_mm)} mm`}
                  project={dossier === undefined ? null : `${String(dossier.project.overhang_mm)} mm`}
                />
                <RuleRow
                  label={t('tenant.axis.material')}
                  value={regulation.allowed_materials.join(', ')}
                  project={dossier?.project.material ?? null}
                />
                <RuleRow
                  label={t('tenant.axis.lighting')}
                  value={regulation.allowed_lighting.join(', ')}
                  project={dossier?.project.lighting ?? null}
                />
                <RuleRow
                  label={t('tenant.axis.forbidden')}
                  value={regulation.forbidden_features.join(', ')}
                  project={dossier === undefined
                    ? null
                    : (dossier.project.features.length === 0 ? t('tenant.axis.none') : dossier.project.features.join(', '))}
                />
              </dl>
            )}
            <Note>{t('tenant.regulation.note')}</Note>
          </Panel>

          <Panel title={t('tenant.panel.violations')} note={dossier?.id ?? ''}>
            <FindingList
              findings={dossier === undefined ? [] : (violationsByDossier.get(dossier.id) ?? [])}
              empty={t('tenant.violations.empty')}
            />
          </Panel>

          <Panel title={t('tenant.panel.parts')}>
            {dossier === undefined ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('tenant.parts.none')}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
                {dossier.parts.map(part => (
                  <li
                    key={part.key}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{partLabel(part.key)}</span>
                    <Tag
                      label={part.provided ? t('tenant.part.provided') : t('tenant.part.missing')}
                      severity={part.provided ? 'valid' : 'warning'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('tenant.note')}</Note>
    </div>
  );
}

type RuleRowProps = {
  readonly label: string;
  readonly value: string;
  readonly project: string | null;
};

function RuleRow({ label, value, project }: RuleRowProps): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
        <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
        <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>
          {value}
        </dd>
      </div>
      {project !== null && (
        <div style={{
          fontSize: TEXT.micro,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'right',
        }}>
          {project}
        </div>
      )}
    </div>
  );
}

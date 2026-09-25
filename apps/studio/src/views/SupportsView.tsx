import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { validateSupports, computeQuantities } from '@azimut/engine-graph';
import type { Finding, SupportType } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { placedSupports } from '../domain/trial-placement.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { UntypedSupportsBanner } from './signage/UntypedSupportsBanner.js';

type SupportsViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type TypeRow = {
  readonly type: SupportType;
  readonly templates: number;
  readonly declaredFaces: number;
  readonly findings: readonly Finding[];
};

/**
 * Module 01 — les typologies de support.
 *
 * Une typologie déclare ses faces et leurs dimensions par défaut ; un gabarit
 * s'y rattache par côté. Les écarts entre les deux — face_count qui ne
 * correspond pas, gabarit rattaché à une typologie inconnue, côté absent —
 * sont ceux que `validateSupports` relève.
 */
export function SupportsView({ onNavigate }: SupportsViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const findings = useMemo<readonly Finding[]>(() => {
    const result = validateSupports(site);
    return result.ok ? result.warnings : result.findings;
  }, [site]);

  const quantities = useMemo(() => {
    const firstKey = site.support_types[0]?.key ?? '';
    const result = computeQuantities(site, placedSupports(site, firstKey));
    return result.ok ? result.value : null;
  }, [site]);

  const rows = useMemo<readonly TypeRow[]>(() =>
    [...site.support_types]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((type): TypeRow => ({
        type,
        templates: site.face_templates.filter(tpl => tpl.support_type_key === type.key).length,
        declaredFaces: type.faces.length,
        findings: findings.filter(f => f.entity?.id === type.id || f.entity?.id === type.key),
      })), [site, findings]);

  const mismatched = rows.filter(r => r.declaredFaces !== r.type.face_count).length;
  const withoutTemplate = rows.filter(r => r.templates === 0).length;

  const metrics: readonly Metric[] = [
    { id: 'types', label: t('supports.metric.types'), value: String(rows.length) },
    {
      id: 'faces',
      label: t('supports.metric.faces'),
      value: String(rows.reduce((n, r) => n + r.declaredFaces, 0)),
    },
    { id: 'templates', label: t('supports.metric.templates'), value: String(site.face_templates.length) },
    {
      id: 'notemplate',
      label: t('supports.metric.notemplate'),
      value: String(withoutTemplate),
      severity: withoutTemplate > 0 ? 'warning' : 'valid',
    },
    {
      id: 'mismatch',
      label: t('supports.metric.mismatch'),
      value: String(mismatched),
      severity: mismatched > 0 ? 'blocking' : 'valid',
    },
  ];

  const columns: readonly Column<TypeRow>[] = [
    { id: 'key', header: t('supports.col.key'), cell: r => r.type.key },
    { id: 'name', header: t('supports.col.name'), cell: r => r.type.name },
    {
      id: 'faces',
      header: t('supports.col.faces'),
      numeric: true,
      cell: r => (
        r.declaredFaces === r.type.face_count
          ? String(r.type.face_count)
          : <Tag label={`${String(r.declaredFaces)} / ${String(r.type.face_count)}`} severity="blocking" />
      ),
    },
    {
      id: 'dims',
      header: t('supports.col.defaultdims'),
      cell: r => r.type.faces
        .map(f => `${f.side} ${String(f.default_width_mm)}×${String(f.default_height_mm)}`)
        .join(' · '),
    },
    {
      id: 'templates',
      header: t('supports.col.templates'),
      numeric: true,
      cell: r => (
        <Tag
          label={String(r.templates)}
          severity={r.templates === 0 ? 'warning' : 'valid'}
        />
      ),
    },
  ];

  const selectedRow = rows.find(r => r.type.key === selected);

  return (
    <div>
      <ScreenHeader
        eyebrow={t('supports.eyebrow')}
        title={t('supports.title')}
        subtitle={t('supports.subtitle')}
        actions={[
          { id: 'signage', label: t('supports.action.signage'), onSelect: () => { onNavigate('signage'); } },
        ]}
      />

      <UntypedSupportsBanner assumedTypeKey={site.support_types[0]?.key ?? ''} />
      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('supports.panel.types')} note={t('supports.panel.types.note')} padded={false}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={r => r.type.key}
            selectedKey={selected}
            onSelect={r => { setSelected(r.type.key); }}
            empty={t('supports.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('supports.panel.faces')} note={selectedRow?.type.key ?? ''}>
            {selectedRow === undefined ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('supports.faces.none')}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
                {selectedRow.type.faces.map(face => (
                  <li
                    key={face.side}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{face.side}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {`${String(face.default_width_mm)} × ${String(face.default_height_mm)} mm`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Note>{t('supports.faces.note')}</Note>
          </Panel>

          <Panel title={t('supports.panel.quantities')} note={t('supports.panel.quantities.note')}>
            {quantities === null ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('supports.quantities.unavailable')}
              </p>
            ) : (
              <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
                <QuantityRow label={t('supports.quantities.supports')} value={String(quantities.total_supports)} />
                <QuantityRow label={t('supports.quantities.faces')} value={String(quantities.total_faces)} />
                <QuantityRow
                  label={t('supports.quantities.crosscheck')}
                  value={quantities.cross_check_ok ? t('supports.quantities.ok') : t('supports.quantities.failed')}
                />
              </dl>
            )}
            <Note>{t('supports.quantities.note')}</Note>
          </Panel>

          <Panel title={t('supports.panel.findings')} note={String(findings.length)}>
            <FindingList findings={findings} empty={t('supports.findings.empty')} limit={10} />
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('supports.note')}</Note>
    </div>
  );
}

type QuantityRowProps = {
  readonly label: string;
  readonly value: string;
};

function QuantityRow({ label, value }: QuantityRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</dd>
    </div>
  );
}

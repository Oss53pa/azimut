import { type JSX, useMemo } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { MESSAGES_FR, MESSAGES_EN } from '../i18n/messages.js';
import { ERROR_CATALOG } from '@azimut/core-model';
import { isModuleNavigable, isModuleExportReadable } from '../domain/module-entitlement.js';
import type { ModuleEntitlement } from '../domain/module-entitlement.js';
import { PRODUCT_MODULES, type ProductModule } from '../product-map.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';

/**
 * Abonnements de démonstration : les douze modules actifs, sauf le portefeuille
 * suspendu et les parcours clients à l'essai, pour que les deux règles de I5.2
 * — absent de la navigation, mais lisible en export — soient observables.
 */
const DEMO_ENTITLEMENTS: readonly ModuleEntitlement[] = PRODUCT_MODULES.map(
  (module): ModuleEntitlement => ({
    module_key: module.number,
    state: module.number === '10' ? 'suspended' : module.number === '03' ? 'trial' : 'active',
    from_date: '2026-01-01',
    to_date: null,
  }),
);

type ModuleRight = {
  readonly module: ProductModule;
  readonly navigable: boolean;
  readonly exportable: boolean;
};

/** Ce qui manque encore au module 11, énoncé plutôt que simulé. */
const MISSING_BRICKS = [
  'crosscutting.missing.notifications',
  'crosscutting.missing.search',
  'crosscutting.missing.attachments',
  'crosscutting.missing.tasks',
] as const;

/**
 * Module 11 — les fonctions transverses. Deux briques existent et sont
 * mesurables ici : l'internationalisation et les droits par module. Les quatre
 * autres n'existent pas, et l'écran le dit au lieu de les mimer.
 */
export function CrossCuttingView(): JSX.Element {
  const { t, lang, setLang } = useI18n();
  const today = new Date().toISOString().slice(0, 10);

  const rights = useMemo<readonly ModuleRight[]>(() =>
    PRODUCT_MODULES.map((module): ModuleRight => ({
      module,
      navigable: isModuleNavigable(DEMO_ENTITLEMENTS, module.number, today),
      exportable: isModuleExportReadable(DEMO_ENTITLEMENTS, module.number, today),
    })), [today]);

  const keyCount = Object.keys(MESSAGES_FR).length;
  const translated = Object.keys(MESSAGES_EN).filter(
    key => (MESSAGES_EN as Record<string, string>)[key] !== undefined,
  ).length;
  const errorCodes = Object.keys(ERROR_CATALOG).length;

  const metrics: readonly Metric[] = [
    { id: 'keys', label: t('crosscutting.metric.keys'), value: String(keyCount) },
    {
      id: 'coverage',
      label: t('crosscutting.metric.coverage'),
      value: `${String(Math.round((translated / Math.max(keyCount, 1)) * 100))} %`,
      severity: translated === keyCount ? 'valid' : 'warning',
    },
    { id: 'codes', label: t('crosscutting.metric.codes'), value: String(errorCodes) },
    {
      id: 'navigable',
      label: t('crosscutting.metric.navigable'),
      value: String(rights.filter(r => r.navigable).length),
    },
    {
      id: 'missing',
      label: t('crosscutting.metric.missing'),
      value: String(MISSING_BRICKS.length),
      severity: 'warning',
    },
  ];

  const columns: readonly Column<ModuleRight>[] = [
    { id: 'number', header: t('crosscutting.col.module'), cell: r => r.module.number },
    { id: 'name', header: t('crosscutting.col.name'), cell: r => t(r.module.nameKey) },
    {
      id: 'state',
      header: t('crosscutting.col.subscription'),
      cell: r => {
        const entitlement = DEMO_ENTITLEMENTS.find(e => e.module_key === r.module.number);
        const state = entitlement?.state ?? 'expired';
        return <Tag label={t(STATE_KEYS[state])} severity={state === 'active' ? 'valid' : 'warning'} />;
      },
    },
    {
      id: 'navigable',
      header: t('crosscutting.col.navigable'),
      cell: r => (
        <Tag
          label={r.navigable ? t('crosscutting.yes') : t('crosscutting.no')}
          severity={r.navigable ? 'valid' : 'warning'}
        />
      ),
    },
    {
      id: 'export',
      header: t('crosscutting.col.export'),
      cell: r => (
        <Tag
          label={r.exportable ? t('crosscutting.yes') : t('crosscutting.no')}
          severity={r.exportable ? 'valid' : 'blocking'}
        />
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('crosscutting.eyebrow')}
        title={t('crosscutting.title')}
        subtitle={t('crosscutting.subtitle')}
      />

      <div style={{ marginBottom: SPACE.md }}>
        <StateBanner
          severity="info"
          message={t('crosscutting.entitlements.message')}
          hint={t('crosscutting.entitlements.hint')}
        />
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('crosscutting.panel.language')}>
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              {(['fr', 'en'] as const).map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setLang(code); }}
                  style={{
                    border: `1px solid ${lang === code ? 'var(--accent)' : 'var(--border-interactive)'}`,
                    background: lang === code ? 'var(--accent-soft)' : 'var(--surface-panel)',
                    color: lang === code ? 'var(--accent)' : 'var(--text-primary)',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: TEXT.small,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {code}
                </button>
              ))}
            </div>
            <Note>{t('crosscutting.language.note')}</Note>
          </Panel>

          <Panel title={t('crosscutting.panel.missing')} note={String(MISSING_BRICKS.length)}>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
              {MISSING_BRICKS.map(key => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <Note>{t('crosscutting.missing.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('crosscutting.panel.rights')} note={t('crosscutting.panel.rights.note')} padded={false}>
          <DataTable columns={columns} rows={rights} rowKey={r => r.module.number} empty={t('crosscutting.rights.empty')} />
        </Panel>
      </div>

      <Note>{t('crosscutting.note')}</Note>
    </div>
  );
}

const STATE_KEYS = {
  active: 'crosscutting.state.active',
  trial: 'crosscutting.state.trial',
  suspended: 'crosscutting.state.suspended',
  expired: 'crosscutting.state.expired',
} as const;

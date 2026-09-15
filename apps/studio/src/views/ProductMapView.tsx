import { type JSX } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { ViewId } from '../views.js';
import {
  MODULE_FAMILIES,
  FAMILY_LABEL_KEYS,
  ENGINE_LABEL_KEYS,
  PRODUCT_MODULES,
  modulesOfFamily,
  type ProductModule,
  type EngineState,
} from '../product-map.js';
import {
  ScreenHeader, MetricRow, Note, Tag, SPACE, TEXT, LABEL_STYLE,
  type Metric, type Severity,
} from '../components/ui/index.js';

type ProductMapViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

/** L'état du moteur est une sévérité : complet vaut valide, absent vaut bloquant. */
function engineSeverity(engine: EngineState): Severity {
  switch (engine) {
    case 'complete': return 'valid';
    case 'partial': return 'warning';
    case 'absent': return 'blocking';
  }
}

function countEngines(state: EngineState): number {
  return PRODUCT_MODULES.filter(m => m.engine === state).length;
}

/** Un module porte son écran d'entrée plus ses écrans secondaires. */
function screenCount(module: ProductModule): number {
  return 1 + module.screens.length;
}

export function ProductMapView({ onNavigate }: ProductMapViewProps): JSX.Element {
  const { t } = useI18n();

  const metrics: readonly Metric[] = [
    { id: 'modules', label: t('productmap.stat.modules'), value: String(PRODUCT_MODULES.length) },
    {
      id: 'screens',
      label: t('productmap.stat.screens'),
      value: String(PRODUCT_MODULES.reduce((n, m) => n + screenCount(m), 0)),
    },
    {
      id: 'complete',
      label: t('productmap.stat.engines.complete'),
      value: String(countEngines('complete')),
      severity: 'valid',
    },
    {
      id: 'partial',
      label: t('productmap.stat.engines.partial'),
      value: String(countEngines('partial')),
      severity: 'warning',
    },
    {
      id: 'absent',
      label: t('productmap.stat.engines.absent'),
      value: String(countEngines('absent')),
      severity: 'blocking',
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('productmap.eyebrow')}
        title={t('productmap.title')}
        subtitle={t('productmap.subtitle')}
      />
      <MetricRow metrics={metrics} />

      {MODULE_FAMILIES.map(family => (
        <section key={family} style={{ marginTop: SPACE.xl }}>
          <h2 style={{ ...LABEL_STYLE, margin: `0 0 ${String(SPACE.sm)}px` }}>
            {t(FAMILY_LABEL_KEYS[family])}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: SPACE.md,
          }}>
            {modulesOfFamily(family).map(module => (
              <ModuleCard
                key={module.number}
                module={module}
                onOpen={() => { onNavigate(module.entry); }}
              />
            ))}
          </div>
        </section>
      ))}

      <Note>{t('productmap.note')}</Note>
    </div>
  );
}

type ModuleCardProps = {
  readonly module: ProductModule;
  readonly onOpen: () => void;
};

function ModuleCard({ module, onOpen }: ModuleCardProps): JSX.Element {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        padding: SPACE.md,
        border: '1px solid var(--border-hairline)',
        borderRadius: 6,
        background: 'var(--surface-panel)',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.xs }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: TEXT.small, color: 'var(--text-muted)' }}>
          {module.number}
        </span>
        <span style={{ fontSize: TEXT.lead, fontWeight: 500, color: 'var(--text-primary)' }}>
          {t(module.nameKey)}
        </span>
      </div>
      <p style={{
        margin: `0 0 ${String(SPACE.sm)}px`,
        fontSize: TEXT.small,
        lineHeight: 1.45,
        color: 'var(--text-secondary)',
      }}>
        {t(module.summaryKey)}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.xs, alignItems: 'center' }}>
        <Tag label={t(ENGINE_LABEL_KEYS[module.engine])} severity={engineSeverity(module.engine)} />
        <Tag label={t('productmap.screens.count', { count: screenCount(module) })} muted />
      </div>
      <div style={{
        marginTop: SPACE.sm,
        fontFamily: 'var(--font-mono)',
        fontSize: TEXT.micro,
        color: 'var(--text-muted)',
        overflowWrap: 'anywhere',
      }}>
        {module.source}
      </div>
    </button>
  );
}

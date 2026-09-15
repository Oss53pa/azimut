import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  MODULE_FAMILIES,
  FAMILY_LABEL_KEYS,
  modulesOfFamily,
  moduleOfView,
  type ProductModule,
} from '../product-map.js';
import { SPACE, TEXT, LABEL_STYLE } from './ui/index.js';

type SidebarProps = {
  readonly currentView: ViewId;
  readonly onNavigate: (view: ViewId) => void;
};

const NAV_STYLE: React.CSSProperties = {
  width: 216,
  borderRight: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

function itemStyle(active: boolean, hovered: boolean, depth: number): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: SPACE.sm,
    width: 'calc(100% - 12px)',
    textAlign: 'left',
    padding: `4px 12px 4px ${String(12 + depth * 16)}px`,
    border: 'none',
    background: active || hovered ? 'var(--surface-sunken)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    fontSize: depth === 0 ? TEXT.body : TEXT.small,
    cursor: 'pointer',
    borderRadius: 4,
    margin: '2px 6px',
    boxSizing: 'border-box',
  };
}

const NUMBER_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: TEXT.micro,
  color: 'var(--text-muted)',
  flexShrink: 0,
};

/**
 * Partie H — la navigation EST la carte du produit : quatre familles, douze
 * modules numérotés. Les écrans d'un module ne se déplient que lorsqu'il est
 * actif, pour qu'une liste de vingt-quatre entrées ne remplace pas une carte.
 */
export function Sidebar({ currentView, onNavigate }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const [hovered, setHovered] = useState<ViewId | null>(null);
  const activeModule = moduleOfView(currentView);

  function entry(view: ViewId, labelKey: UiMessageKey, depth: number, number?: string): JSX.Element {
    const active = currentView === view;
    return (
      <button
        key={view}
        type="button"
        onMouseEnter={() => { setHovered(view); }}
        onMouseLeave={() => { setHovered(null); }}
        onClick={() => { onNavigate(view); }}
        style={itemStyle(active, hovered === view, depth)}
        aria-current={active ? 'page' : undefined}
      >
        {number !== undefined && <span style={NUMBER_STYLE}>{number}</span>}
        <span>{t(labelKey)}</span>
      </button>
    );
  }

  function moduleEntry(module: ProductModule): JSX.Element {
    const isActive = activeModule?.number === module.number;
    return (
      <div key={module.number}>
        {entry(module.entry, module.nameKey, 0, module.number)}
        {isActive && module.screens.map(s => entry(s.view, s.labelKey, 1))}
      </div>
    );
  }

  return (
    <nav style={NAV_STYLE} aria-label={t('nav.aria.main')}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-hairline)',
        fontSize: TEXT.lead,
        fontWeight: 500,
      }}>
        {t('nav.title')}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `${String(SPACE.xs)}px 0 ${String(SPACE.md)}px` }}>
        {entry('dashboard', 'nav.item.dashboard', 0)}
        {entry('product-map', 'nav.item.productmap', 0)}
        {MODULE_FAMILIES.map(family => (
          <div key={family}>
            <div style={{ ...LABEL_STYLE, padding: '12px 12px 4px' }}>
              {t(FAMILY_LABEL_KEYS[family])}
            </div>
            {modulesOfFamily(family).map(moduleEntry)}
          </div>
        ))}
      </div>
    </nav>
  );
}

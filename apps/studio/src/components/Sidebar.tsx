import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  SIDEBAR_FAMILIES,
  FAMILY_LABEL_KEYS,
  modulesOfFamily,
  moduleOfView,
  type ProductModule,
} from '../product-map.js';
import { Icon, MODULE_ICONS, type IconName } from './Icon.js';
import { SPACE, TEXT, LABEL_STYLE } from './ui/index.js';

type SidebarProps = {
  readonly currentView: ViewId;
  readonly onNavigate: (view: ViewId) => void;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
};

const WIDTH_OPEN = 240;
const WIDTH_COLLAPSED = 64;

function navStyle(collapsed: boolean): React.CSSProperties {
  return {
    width: collapsed ? WIDTH_COLLAPSED : WIDTH_OPEN,
    borderRight: '1px solid var(--border-hairline)',
    background: 'var(--surface-panel)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width var(--duration-panel) ease-out',
  };
}

function rowStyle(active: boolean, depth: number, collapsed: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: SPACE.md,
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    padding: depth === 0 ? '8px 12px' : '6px 12px 6px 48px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    border: 'none',
    borderRadius: 4,
    // M7.10 (partie M) : l'accent ne dit que ce qui est calculé. L'entrée
    // active se marque au fond et au poids, pas à l'accent.
    background: active ? 'var(--surface-sunken)' : 'transparent',
    color: active || depth === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    fontSize: depth === 0 ? TEXT.lead : TEXT.body,
    cursor: 'pointer',
  };
}

const CHEVRON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
};

/**
 * Partie H — la navigation est la carte du produit, rangée comme la maquette :
 * l'accueil, puis quatre familles et leurs modules. Un module se déplie quand
 * il est actif, ou quand on ouvre son chevron ; replié, le menu ne garde que
 * les icônes, et chaque icône garde son nom en info-bulle.
 */
export function Sidebar(
  { currentView, onNavigate, collapsed, onToggleCollapsed }: SidebarProps,
): JSX.Element {
  const { t } = useI18n();
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const activeModule = moduleOfView(currentView);

  function toggle(number: string): void {
    setOpened(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }

  function row(view: ViewId, labelKey: UiMessageKey, icon: IconName | null, active: boolean): JSX.Element {
    const label = t(labelKey);
    return (
      <button
        type="button"
        onClick={() => { onNavigate(view); }}
        style={rowStyle(active, icon === null ? 1 : 0, collapsed)}
        aria-current={currentView === view ? 'page' : undefined}
        title={collapsed ? label : undefined}
      >
        {icon !== null && (
          <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            <Icon name={icon} size={20} />
          </span>
        )}
        {collapsed
          ? <span className="az-visually-hidden">{label}</span>
          : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
      </button>
    );
  }

  function moduleEntry(module: ProductModule): JSX.Element {
    const active = activeModule?.number === module.number;
    const expanded = !collapsed && module.screens.length > 0
      && (active || opened.has(module.number));
    return (
      <li key={module.number}>
        <div style={{ display: 'flex', margin: '2px 8px' }}>
          {row(module.entry, module.nameKey, MODULE_ICONS[module.number] ?? 'file', active && !expanded)}
          {!collapsed && module.screens.length > 0 && (
            <button
              type="button"
              style={CHEVRON_STYLE}
              aria-expanded={expanded}
              aria-label={t('shell.nav.screens', { module: t(module.nameKey) })}
              onClick={() => { toggle(module.number); }}
            >
              <Icon name={expanded ? 'chevD' : 'chev'} size={16} />
            </button>
          )}
        </div>
        {expanded && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li style={{ display: 'flex', margin: '2px 8px' }}>
              {row(module.entry, module.entryLabelKey ?? 'shell.nav.overview', null, currentView === module.entry)}
            </li>
            {module.screens.map(s => (
              <li key={s.view} style={{ display: 'flex', margin: '2px 8px' }}>
                {row(s.view, s.labelKey, null, currentView === s.view)}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <nav style={navStyle(collapsed)} aria-label={t('nav.aria.main')}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: `${String(SPACE.md)}px 0` }}>
        <div style={{ display: 'flex', margin: '0 8px' }}>
          {row('dashboard', 'shell.nav.home', 'home', currentView === 'dashboard')}
        </div>
        {SIDEBAR_FAMILIES.map(family => (
          <section key={family} aria-label={t(FAMILY_LABEL_KEYS[family])}>
            {collapsed
              ? <div style={{ height: 1, margin: '12px 16px', background: 'var(--border-hairline)' }} />
              : (
                <div style={{ ...LABEL_STYLE, padding: '16px 20px 6px' }}>
                  {t(FAMILY_LABEL_KEYS[family])}
                </div>
              )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {modulesOfFamily(family).map(moduleEntry)}
            </ul>
          </section>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border-hairline)', padding: SPACE.sm }}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? t('shell.nav.expand') : undefined}
          style={{
            ...rowStyle(false, 0, collapsed),
            width: '100%',
            fontSize: TEXT.small,
            color: 'var(--text-secondary)',
          }}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={18} />
          {collapsed
            ? <span className="az-visually-hidden">{t('shell.nav.expand')}</span>
            : <span>{t('shell.nav.collapse')}</span>}
        </button>
      </div>
    </nav>
  );
}

import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';

type SidebarProps = {
  readonly currentView: ViewId;
  readonly onNavigate: (view: ViewId) => void;
};

type NavItem = {
  readonly id: ViewId;
  readonly labelKey: UiMessageKey;
  readonly sectionKey: UiMessageKey;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.item.dashboard', sectionKey: 'nav.section.general' },
  { id: 'editor', labelKey: 'nav.item.editor', sectionKey: 'nav.section.general' },
  { id: 'graph', labelKey: 'nav.item.graph', sectionKey: 'nav.section.data' },
  { id: 'destinations', labelKey: 'nav.item.destinations', sectionKey: 'nav.section.data' },
  { id: 'supports', labelKey: 'nav.item.supports', sectionKey: 'nav.section.data' },
  { id: 'templates', labelKey: 'nav.item.templates', sectionKey: 'nav.section.data' },
  { id: 'floor-plans', labelKey: 'nav.item.floorplans', sectionKey: 'nav.section.renders' },
  { id: 'faces', labelKey: 'nav.item.faces', sectionKey: 'nav.section.renders' },
  { id: 'checks', labelKey: 'nav.item.checks', sectionKey: 'nav.section.quality' },
  { id: 'proofs', labelKey: 'nav.item.proofs', sectionKey: 'nav.section.quality' },
];

const NAV_STYLE: React.CSSProperties = {
  width: 200,
  borderRight: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const SECTION_STYLE: React.CSSProperties = {
  padding: '12px 12px 4px',
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
};

function itemStyle(active: boolean, hovered: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    width: 'calc(100% - 12px)',
    textAlign: 'left',
    padding: '5px 10px',
    border: 'none',
    background: active
      ? 'var(--surface-sunken)'
      : hovered
        ? 'var(--surface-sunken)'
        : 'transparent',
    color: active
      ? 'var(--accent)'
      : 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 4,
    margin: '1px 6px',
    boxSizing: 'border-box',
    transition: 'background 120ms',
  };
}

export function Sidebar({ currentView, onNavigate }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const [hoveredItem, setHoveredItem] = useState<ViewId | null>(null);
  let lastSection = '';

  return (
    <nav style={NAV_STYLE} aria-label={t('nav.aria.main')}>
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-hairline)',
        fontSize: 15,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 36,
      }}>
        <span>{t('nav.title')}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {NAV_ITEMS.map((item) => {
          const showSection = item.sectionKey !== lastSection;
          lastSection = item.sectionKey;
          const isActive = currentView === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <div key={item.id}>
              {showSection && (
                <div style={SECTION_STYLE}>
                  {t(item.sectionKey)}
                </div>
              )}
              <button
                type="button"
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => onNavigate(item.id)}
                style={itemStyle(isActive, isHovered)}
                aria-current={isActive ? 'page' : undefined}
              >
                {t(item.labelKey)}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

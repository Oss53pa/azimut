import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';

type SidebarProps = {
  readonly currentView: ViewId;
  readonly onNavigate: (view: ViewId) => void;
};

type NavItem = {
  readonly id: ViewId;
  readonly label: string;
  readonly section: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', section: 'Général' },
  { id: 'editor', label: 'Tracé', section: 'Général' },
  { id: 'graph', label: 'Graphe', section: 'Données' },
  { id: 'destinations', label: 'Destinations', section: 'Données' },
  { id: 'supports', label: 'Supports', section: 'Données' },
  { id: 'templates', label: 'Gabarits', section: 'Données' },
  { id: 'floor-plans', label: 'Plans de niveaux', section: 'Rendus' },
  { id: 'faces', label: 'Faces', section: 'Rendus' },
  { id: 'checks', label: 'Contrôles', section: 'Qualité' },
  { id: 'proofs', label: 'BAT', section: 'Qualité' },
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
  const [hoveredItem, setHoveredItem] = useState<ViewId | null>(null);
  let lastSection = '';

  return (
    <nav style={NAV_STYLE} aria-label="Navigation principale">
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
        <span>Navigation</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {NAV_ITEMS.map((item) => {
          const showSection = item.section !== lastSection;
          lastSection = item.section;
          const isActive = currentView === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <div key={item.id}>
              {showSection && (
                <div style={SECTION_STYLE}>
                  {item.section}
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
                {item.label}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

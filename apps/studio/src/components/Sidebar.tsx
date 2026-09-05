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
  readonly icon: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', section: 'Général', icon: '📊' },
  { id: 'graph', label: 'Graphe', section: 'Données', icon: '🔗' },
  { id: 'destinations', label: 'Destinations', section: 'Données', icon: '📍' },
  { id: 'supports', label: 'Supports', section: 'Données', icon: '🪧' },
  { id: 'templates', label: 'Gabarits', section: 'Données', icon: '📐' },
  { id: 'floor-plans', label: 'Plans de niveaux', section: 'Rendus', icon: '🗺️' },
  { id: 'faces', label: 'Faces', section: 'Rendus', icon: '🖼️' },
  { id: 'checks', label: 'Contrôles', section: 'Qualité', icon: '✅' },
  { id: 'proofs', label: 'BAT', section: 'Qualité', icon: '📄' },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps): JSX.Element {
  const [hoveredItem, setHoveredItem] = useState<ViewId | null>(null);
  let lastSection = '';

  return (
    <nav style={{
      width: 240,
      minHeight: '100vh',
      borderRight: '1px solid var(--az-border)',
      background: 'var(--az-sidebar-bg)',
      padding: '20px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      <div style={{
        padding: '0 20px 20px',
        borderBottom: '1px solid var(--az-border)',
        marginBottom: 8,
      }}>
        <div style={{
          fontFamily: 'var(--az-font-title)',
          fontSize: 28,
          color: 'var(--az-sidebar-brand)',
          lineHeight: 1.2,
        }}>
          Azimut
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--az-text-secondary)',
          marginTop: 2,
        }}>
          Studio
        </div>
      </div>
      {NAV_ITEMS.map((item) => {
        const showSection = item.section !== lastSection;
        lastSection = item.section;
        const isActive = currentView === item.id;
        const isHovered = hoveredItem === item.id;
        return (
          <div key={item.id}>
            {showSection && (
              <div style={{
                padding: '14px 20px 6px',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--az-text-secondary)',
              }}>
                {item.section}
              </div>
            )}
            <button
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: 'calc(100% - 16px)',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                background: isActive
                  ? 'var(--az-active-bg)'
                  : isHovered
                    ? 'var(--az-hover-bg)'
                    : 'transparent',
                color: isActive
                  ? 'var(--az-active-text)'
                  : 'var(--az-text-primary)',
                fontFamily: 'var(--az-font-body)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5,
                cursor: 'pointer',
                borderRadius: 8,
                margin: '1px 8px',
                boxSizing: 'border-box',
                transition: 'background 0.15s, color 0.15s',
                borderLeft: isActive
                  ? '3px solid var(--az-accent)'
                  : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

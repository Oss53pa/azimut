import { type JSX } from 'react';
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
  { id: 'graph', label: 'Graphe', section: 'Données' },
  { id: 'destinations', label: 'Destinations', section: 'Données' },
  { id: 'supports', label: 'Supports', section: 'Données' },
  { id: 'templates', label: 'Gabarits', section: 'Données' },
  { id: 'floor-plans', label: 'Plans de niveaux', section: 'Rendus' },
  { id: 'faces', label: 'Faces', section: 'Rendus' },
  { id: 'checks', label: 'Contrôles', section: 'Qualité' },
  { id: 'proofs', label: 'BAT', section: 'Qualité' },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps): JSX.Element {
  let lastSection = '';

  return (
    <nav style={{
      width: 220,
      minHeight: '100vh',
      borderRight: '1px solid var(--az-border)',
      background: 'var(--az-sidebar-bg)',
      padding: '16px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div style={{
        padding: '0 16px 12px',
        fontWeight: 700,
        fontSize: 16,
        color: 'var(--az-text-primary)',
      }}>
        Azimut Studio
      </div>
      {NAV_ITEMS.map((item) => {
        const showSection = item.section !== lastSection;
        lastSection = item.section;
        return (
          <div key={item.id}>
            {showSection && (
              <div style={{
                padding: '12px 16px 4px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--az-text-secondary)',
              }}>
                {item.section}
              </div>
            )}
            <button
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 16px',
                border: 'none',
                background: currentView === item.id
                  ? 'var(--az-active-bg)'
                  : 'transparent',
                color: currentView === item.id
                  ? 'var(--az-active-text)'
                  : 'var(--az-text-primary)',
                fontWeight: currentView === item.id ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 4,
                margin: '0 8px',
                boxSizing: 'border-box',
              }}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

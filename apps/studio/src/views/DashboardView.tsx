import { type JSX } from 'react';

export function DashboardView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Tableau de bord
      </h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        <StatCard label="Niveaux" value="—" />
        <StatCard label="Noeuds" value="—" />
        <StatCard label="Destinations" value="—" />
        <StatCard label="Supports" value="—" />
        <StatCard label="BAT en attente" value="—" />
        <StatCard label="Controles" value="—" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{
      padding: 16,
      borderRadius: 8,
      border: '1px solid var(--az-border)',
      background: 'var(--az-card-bg)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--az-text-secondary)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--az-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

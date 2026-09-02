import { type JSX } from 'react';

export function FloorPlansView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Plans de niveaux
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 14 }}>
        Plans simplifies, plans muraux orientes et plans d'evacuation par niveau.
      </p>
      <div style={{
        marginTop: 16,
        padding: 32,
        borderRadius: 8,
        border: '2px dashed var(--az-border)',
        textAlign: 'center',
        color: 'var(--az-text-secondary)',
        fontSize: 14,
      }}>
        Connecter une source de donnees pour generer les plans.
      </div>
    </div>
  );
}

import { type JSX } from 'react';

export function SupportsView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Carnet de supports
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 14 }}>
        Types de supports, faces et dimensionnement.
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
        Connecter une source de donnees pour afficher les supports.
      </div>
    </div>
  );
}

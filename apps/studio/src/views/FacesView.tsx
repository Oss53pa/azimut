import { type JSX } from 'react';

export function FacesView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Rendus de faces
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 14 }}>
        Apercu SVG des faces resolues pour chaque support et gabarit.
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
        Connecter une source de donnees pour afficher les rendus.
      </div>
    </div>
  );
}

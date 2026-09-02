import { type JSX } from 'react';

export function GraphView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Graphe de circulation
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 14 }}>
        Visualisation du graphe de circulation : noeuds, aretes, liens verticaux.
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
        Connecter une source de donnees pour afficher le graphe.
      </div>
    </div>
  );
}

import { type JSX } from 'react';

export function ProofsView(): JSX.Element {
  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Bons a tirer
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 14 }}>
        Gestion des versions de BAT, approbations et rejets.
      </p>
      <table style={{
        width: '100%',
        marginTop: 16,
        borderCollapse: 'collapse',
        fontSize: 13,
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--az-border)' }}>
            <Th>Face</Th>
            <Th>Version</Th>
            <Th>Statut</Th>
            <Th>Soumis le</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--az-text-secondary)',
            }}>
              Aucune donnee chargee.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: string }): JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      fontWeight: 600,
      color: 'var(--az-text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}

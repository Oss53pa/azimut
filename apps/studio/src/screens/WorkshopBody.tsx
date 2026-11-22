import type { JSX, ReactNode } from 'react';

/**
 * F5.1 et F5.2 — un écran d'atelier de forme formulaire : son contenu défile,
 * sa barre d'état reste au bas de la zone, en vue quelle que soit la longueur
 * du contenu.
 */
export function WorkshopBody({ gap, children, statusBar }: {
  readonly gap: number;
  readonly children: ReactNode;
  readonly statusBar: ReactNode;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {children}
      </div>
      {statusBar}
    </div>
  );
}

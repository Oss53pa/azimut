import { type JSX, type ReactNode, useEffect, useRef } from 'react';
import { SPACE, TEXT } from './tokens.js';

/**
 * F6, famille « Superposition » — boîte de dialogue.
 *
 * E6.2 et M7.2 (partie M) veulent que tout soit atteignable au clavier. Une
 * boîte de dialogue qui laisse le focus derrière elle, ou qui ne se ferme pas
 * à l'échappement, rend l'écran inutilisable au clavier seul — et M8 critère 2
 * exige que le parcours entier s'y fasse.
 *
 * Trois obligations, donc : le focus entre à l'ouverture, il ne sort pas tant
 * que la boîte est là, et il revient d'où il venait à la fermeture.
 */
export type DialogProps = {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Les actions, rendues en pied. */
  readonly actions: ReactNode;
};

export function Dialog({ title, onClose, children, actions }: DialogProps): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      // Le focus revient d'où il venait : sans cela, il retombe sur le corps
      // du document et la navigation au clavier repart de zéro.
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Aucun voile : la partie F n'en donne pas de jeton, et écrire une
        // couleur hors du fichier de jetons est interdit (A2.4). Elle
        // n'accorde aux éléments flottants qu'« une élévation minimale », que
        // la bordure du panneau porte. Le conteneur reste transparent et
        // intercepte les clics ; `aria-modal` fait le reste pour les
        // technologies d'assistance.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACE.xl,
        zIndex: 10,
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          background: 'var(--surface-panel)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.lg,
          padding: SPACE.lg,
        }}
      >
        <h2 style={{ margin: 0, fontSize: TEXT.section, fontWeight: 500 }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: SPACE.sm, justifyContent: 'flex-end' }}>
          {actions}
        </div>
      </div>
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

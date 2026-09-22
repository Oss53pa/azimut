import { type JSX, type ReactNode } from 'react';
import { StateBanner } from './StateBanner.js';
import { Button } from './Button.js';
import { SPACE, TEXT } from './tokens.js';

/**
 * F7 — les six états obligatoires d'un écran.
 *
 * « Tout écran affichant des données traite les six états suivants. Un écran
 * qui n'en traite que le cas nominal est incomplet et refusé en revue. »
 *
 * M7.1 (partie M) le reprend pour tout écran construit après la tranche M.
 * Cette enveloppe existe pour que l'oubli devienne difficile : un écran passe
 * son état, et les six traitements sont ici, au même endroit, décrits une fois.
 */
export type ScreenState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loading' }
  /** F7 : « Ce qui est disponible s'affiche, ce qui manque est nommé. » */
  | { readonly kind: 'partial'; readonly missing: string }
  | { readonly kind: 'error'; readonly cause: string; readonly recovery: string }
  | { readonly kind: 'offline'; readonly stillPossible: string }
  | { readonly kind: 'permission_denied'; readonly whatAndWho: string }
  | { readonly kind: 'ready' };

export type EmptyInvitation = {
  /** F7 : « Invitation à agir, avec l'action en évidence. » */
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
};

export type ScreenStatesProps = {
  readonly state: ScreenState;
  /** L'invitation de l'état vide. Sans elle, l'état vide est un simple constat. */
  readonly invitation?: EmptyInvitation | undefined;
  /** La structure d'attente, calquée sur la forme du contenu (F7). */
  readonly skeleton?: ReactNode;
  /**
   * L'état vide laisse voir le contenu, l'invitation venant par-dessus.
   *
   * M3 (partie M) le demande explicitement : « Vide | Plan calé visible,
   * invitation à tracer la première cellule, outil cellule déjà actif. » Un
   * écran d'atelier dont la zone de travail disparaît quand il n'y a encore
   * rien à montrer cache justement ce sur quoi l'opérateur va travailler.
   *
   * Faux par défaut : un registre vide n'a rien à laisser voir.
   */
  readonly emptyKeepsContent?: boolean | undefined;
  /** Le contenu, rendu dans les états `ready`, `partial` et `offline`. */
  readonly children: ReactNode;
};

/**
 * Rend l'écran selon son état.
 *
 * Trois états laissent voir le contenu : `ready`, `partial` — « ce qui est
 * disponible s'affiche » — et `offline`, où le travail continue. Les trois
 * autres le remplacent, parce qu'il n'y a rien de fiable à montrer.
 */
export function ScreenStates({
  state, invitation, skeleton, children, emptyKeepsContent = false,
}: ScreenStatesProps): JSX.Element {
  if (state.kind === 'empty' && emptyKeepsContent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {invitation !== undefined && (
          <StateBanner severity="info" message={invitation.message}>
            <Button rank="primary" onClick={invitation.onAction}>
              {invitation.actionLabel}
            </Button>
          </StateBanner>
        )}
        {children}
      </div>
    );
  }

  if (state.kind === 'empty') {
    return invitation === undefined
      ? <StateBanner severity="info" message="" />
      : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: SPACE.md, padding: SPACE.xl,
        }}>
          <p style={{ margin: 0, fontSize: TEXT.lead, color: 'var(--text-secondary)' }}>
            {invitation.message}
          </p>
          {/* F7 : l'action est en évidence, jamais un simple constat d'absence. */}
          <Button rank="primary" onClick={invitation.onAction}>
            {invitation.actionLabel}
          </Button>
        </div>
      );
  }

  if (state.kind === 'loading') {
    // F7 : « Structure d'attente calquée sur la forme du contenu. Jamais un
    // tourniquet centré. » Faute de structure fournie, on le dit en mots.
    return <div aria-busy="true">{skeleton}</div>;
  }

  if (state.kind === 'error') {
    return (
      <StateBanner severity="blocking" message={state.cause} hint={state.recovery} />
    );
  }

  if (state.kind === 'permission_denied') {
    return <StateBanner severity="warning" message={state.whatAndWho} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {state.kind === 'offline' && (
        // F7 : « Bandeau permanent, indication de ce qui reste possible. »
        <StateBanner severity="warning" message={state.stillPossible} />
      )}
      {state.kind === 'partial' && (
        <StateBanner severity="info" message={state.missing} />
      )}
      {children}
    </div>
  );
}

/** Les six états de F7, pour le contrôle : aucun écran n'en oublie un. */
export const F7_STATES = [
  'empty', 'loading', 'partial', 'error', 'offline', 'permission_denied',
] as const;

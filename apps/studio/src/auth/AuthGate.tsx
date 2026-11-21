/**
 * AUTH.3 — la porte du poste : sans session, l'écran de connexion ; avec,
 * l'application et la manière d'en sortir.
 *
 * Sans service d'authentification configuré, la porte est ouverte : c'est le
 * mode local de M8 (partie M) critère 3, sans base, que les essais de bout en bout
 * parcourent. Avec un service, aucun écran ne s'affiche avant la session, car
 * aucun ne lirait rien : la base ne répond qu'à une identité.
 */
import { type JSX, type ReactNode, useMemo } from 'react';
import type { GoTrueClient } from '@supabase/auth-js';
import { Button, StateBanner, SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthSession } from './use-auth-session.js';
import { LoginScreen } from './LoginScreen.js';
import { IdentityGate } from './IdentityGate.js';
import { appPostgrestConfig } from '../data/config.js';

export function AuthGate({ client, children }: {
  readonly client: GoTrueClient | null;
  readonly children: ReactNode;
}): JSX.Element {
  if (client === null) return <>{children}</>;
  return <SignedInOnly client={client}>{children}</SignedInOnly>;
}

function SignedInOnly({ client, children }: {
  readonly client: GoTrueClient;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const session = useAuthSession(client);
  const { state } = session;
  // Construite une fois : un objet neuf à chaque rendu relancerait la lecture
  // des rattachements.
  const config = useMemo(() => appPostgrestConfig(), []);
  const bar = useMemo(() => ({
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: SPACE.sm,
    padding: `${String(SPACE.xs)}px ${String(SPACE.md)}px`, fontSize: TEXT.small,
    borderBottom: '1px solid var(--border-hairline)', background: 'var(--surface-page)',
  }), []);

  if (state.status === 'loading') {
    return <p role="status" style={{ padding: SPACE.lg, fontSize: TEXT.small }}>{t('auth.loading')}</p>;
  }
  if (state.status === 'signed-out') return <LoginScreen onSignIn={session.signIn} />;

  return (
    <>
      <div style={bar}>
        <span>{t('auth.signed_in_as', { email: state.email })}</span>
        <Button rank="secondary" onClick={() => { void session.signOut(); }}>{t('auth.sign_out')}</Button>
      </div>
      {config === null
        ? <StateBanner severity="blocking" message={t('auth.identity.failed')} />
        : <IdentityGate client={client} config={config} userId={state.userId}>{children}</IdentityGate>}
    </>
  );
}

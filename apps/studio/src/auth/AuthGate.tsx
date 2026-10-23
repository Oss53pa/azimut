import { type JSX, type ReactNode, useEffect, useMemo, useState } from 'react';
import { StateBanner, Button, SPACE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { appAuth } from './app-auth.js';
import type { AuthApi } from './auth-api.js';
import type { AuthSession, Session } from './auth-session.js';
import { readMemberships } from './memberships.js';
import { gateView } from './gate-view.js';
import type { Loaded } from './gate-view.js';
import { SignInPanel } from './SignInPanel.js';
import { SecondFactorPanel } from './SecondFactorPanel.js';
import { setSessionMembership } from '../app/session-identity.js';
import { appPostgrestConfig } from '../data/config.js';

/**
 * A6.3 et O3 : rien de l'atelier ne s'affiche avant une session ouverte et,
 * pour `admin` et `owner_rep`, un second facteur vérifié.
 *
 * Sans service configuré, le studio sert les sites de référence et la garde
 * s'efface. L'API déclarée sans service d'authentification est une
 * configuration incomplète : elle est dite, et rien n'est lu.
 */
export function AuthGate({ children }: { readonly children: ReactNode }): JSX.Element {
  const { t } = useI18n();
  const mode = useMemo(() => appAuth(), []);
  if (mode.kind === 'reference') return <>{children}</>;
  if (mode.kind === 'incomplete') {
    return <Centered><StateBanner severity="blocking" message={t('auth.state.incomplete')} /></Centered>;
  }
  return <RemoteGate api={mode.api} session={mode.session}>{children}</RemoteGate>;
}

function Centered({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', padding: SPACE.xl }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {children}
      </div>
    </main>
  );
}

function RemoteGate({ api, session, children }: {
  readonly api: AuthApi;
  readonly session: AuthSession;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const [current, setCurrent] = useState<Session | null>(() => session.current());
  const [restoring, setRestoring] = useState(true);
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'pending' });

  useEffect(() => {
    const stop = session.subscribe(setCurrent);
    void session.restore().finally(() => { setRestoring(false); });
    return stop;
  }, [session]);

  // Les facteurs et les inscriptions se relisent à chaque nouveau jeton : la
  // vérification du second facteur en délivre un, sous lequel l'organisation
  // devient visible.
  const token = current?.accessToken;
  const userId = current?.userId;
  useEffect(() => {
    if (token === undefined || userId === undefined) return;
    let live = true;
    setLoaded({ kind: 'pending' });
    const config = appPostgrestConfig();
    void (async () => {
      const user = await api.user(token);
      if (!user.ok || config === null) {
        if (live) setLoaded({ kind: 'failed' });
        return;
      }
      try {
        const memberships = await readMemberships(config, userId);
        if (live) setLoaded({ kind: 'done', factors: user.value.factors, memberships });
      } catch {
        if (live) setLoaded({ kind: 'failed' });
      }
    })();
    return () => { live = false; };
  }, [api, token, userId]);

  const view = gateView(restoring, current, loaded);
  // Posée pendant le rendu, avant celui de l'atelier : un effet la poserait
  // après, et le premier rendu des écrans verrait l'organisation de référence.
  // L'affectation est idempotente et ne dépend que de la vue.
  setSessionMembership(view.kind === 'ready' ? view.membership : null);

  const signOut = (scope: 'local' | 'global'): void => { void session.signOut(scope); };

  switch (view.kind) {
    case 'ready':
      return <>{children}</>;
    case 'loading':
      return <Centered><StateBanner severity="info" message={t('auth.state.loading')} /></Centered>;
    case 'signed_out':
      return <Centered><SignInPanel api={api} session={session} /></Centered>;
    case 'second_factor':
      return (
        <Centered>
          <SecondFactorPanel api={api} session={session} mode={view.mode} factorId={view.factorId} onSignOut={signOut} />
        </Centered>
      );
    case 'no_org':
    case 'read_failed':
      return (
        <Centered>
          <StateBanner
            severity="blocking"
            message={view.kind === 'no_org' ? t('auth.state.no_org') : t('auth.state.read_failed')}
          />
          <div><Button rank="secondary" onClick={() => { signOut('local'); }}>{t('auth.signout.local')}</Button></div>
        </Centered>
      );
  }
}

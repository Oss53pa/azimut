/**
 * AUTH.4 — choisir l'organisation sous laquelle travailler, puis la poser
 * pour tous les écrans.
 *
 * T-0.5 : « un utilisateur sans organisation ne voit rien. » Sans
 * rattachement, l'écran le dit au lieu d'ouvrir un atelier vide. Avec un
 * seul, il est retenu d'office ; avec plusieurs, l'utilisateur choisit, et
 * peut revenir sur son choix.
 */
import { type JSX, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, StateBanner, SPACE, TEXT, LABEL_STYLE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { PostgrestConfig } from '../data/postgrest-http.js';
import { SessionIdentityContext, identityOf } from './identity.js';
import type { Membership } from './identity.js';
import { loadMemberships } from './load-memberships.js';

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly memberships: readonly Membership[] };

export function IdentityGate({ config, userId, children }: {
  readonly config: PostgrestConfig;
  readonly userId: string;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoad({ status: 'loading' });
    void loadMemberships(config, userId).then(memberships => {
      if (!live) return;
      setLoad(memberships === null ? { status: 'failed' } : { status: 'ready', memberships });
    });
    return () => { live = false; };
  }, [config, userId]);

  const memberships = load.status === 'ready' ? load.memberships : [];
  const only = memberships.length === 1 ? memberships[0] : undefined;
  const current = only ?? memberships.find(m => m.orgId === chosen);
  const identity = useMemo(
    () => (current === undefined ? null : identityOf(userId, current)),
    [current, userId],
  );

  if (load.status === 'loading') {
    return <p role="status" style={{ padding: SPACE.lg, fontSize: TEXT.small }}>{t('auth.identity.loading')}</p>;
  }
  if (load.status === 'failed') {
    return <div style={{ padding: SPACE.lg }}><StateBanner severity="blocking" message={t('auth.identity.failed')} /></div>;
  }
  if (memberships.length === 0) {
    return <div style={{ padding: SPACE.lg }}><StateBanner severity="warning" message={t('auth.identity.none')} /></div>;
  }

  if (identity === null) {
    return (
      <section aria-label={t('auth.identity.choose')} style={{ display: 'grid', gap: SPACE.sm, padding: SPACE.lg, maxWidth: 480 }}>
        <h1 style={{ ...LABEL_STYLE, margin: 0 }}>{t('auth.identity.choose')}</h1>
        {memberships.map(m => (
          <Button key={m.orgId} rank="secondary" onClick={() => { setChosen(m.orgId); }}>
            {t('auth.identity.option', { org: m.orgName, role: t(`auth.role.${m.role}`) })}
          </Button>
        ))}
      </section>
    );
  }

  return (
    <SessionIdentityContext.Provider value={identity}>
      {memberships.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 ${String(SPACE.md)}px` }}>
          <Button rank="secondary" onClick={() => { setChosen(null); }}>{t('auth.identity.switch')}</Button>
        </div>
      )}
      {children}
    </SessionIdentityContext.Provider>
  );
}

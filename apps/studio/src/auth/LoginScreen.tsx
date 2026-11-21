/**
 * AUTH.3 — l'écran de connexion.
 *
 * La saisie est bornée avant l'envoi (`sign-in-input.ts`) ; le refus du
 * service se dit d'un seul message, et la saisie reste en place pour être
 * corrigée.
 */
import { type FormEvent, type JSX, useState } from 'react';
import { Button, StateBanner, TextField, SPACE, TEXT, LABEL_STYLE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH, signInInput } from './sign-in-input.js';
import type { AuthSession } from './use-auth-session.js';

export function LoginScreen({ onSignIn }: {
  readonly onSignIn: AuthSession['signIn'];
}): JSX.Element {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessageKey | null>(null);

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const input = signInInput(email, password);
    if (!input.ok) { setMessage(`auth.refusal.${input.refusal}`); return; }
    setBusy(true);
    setMessage(null);
    const failure = await onSignIn(input.value);
    setBusy(false);
    if (failure !== null) {
      setPassword('');
      setMessage(failure === 'failed' ? 'auth.failed' : 'auth.unavailable');
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--surface-page)' }}>
      <form
        aria-label={t('auth.title')}
        onSubmit={e => { void submit(e); }}
        style={{ display: 'grid', gap: SPACE.md, width: 'min(360px, 100%)', padding: SPACE.lg }}
      >
        <h1 style={{ ...LABEL_STYLE, margin: 0 }}>{t('auth.title')}</h1>
        <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('auth.intro')}</p>
        {message !== null && <StateBanner severity="blocking" message={t(message)} />}
        <TextField
          label={t('auth.email')} value={email} onChange={setEmail}
          inputType="email" autoComplete="username" maxLength={MAX_EMAIL_LENGTH}
          disabled={busy} autoFocus
        />
        <TextField
          label={t('auth.password')} value={password} onChange={setPassword}
          inputType="password" autoComplete="current-password" maxLength={MAX_PASSWORD_LENGTH}
          disabled={busy}
        />
        <Button type="submit" onClick={() => undefined} disabled={busy}>
          {busy ? t('auth.submitting') : t('auth.submit')}
        </Button>
      </form>
    </main>
  );
}

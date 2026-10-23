import { type JSX, type FormEvent, useState } from 'react';
import { Panel, TextField, Button, StateBanner, SPACE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { AuthApi, AuthFailure } from './auth-api.js';
import type { AuthSession } from './auth-session.js';

/**
 * A6.3 : la connexion par adresse et mot de passe.
 *
 * Le mot de passe n'est gardé que le temps de l'envoi ; il est effacé dès la
 * réponse, réussie ou non. Le refus ne dit pas lequel des deux est faux.
 */
export function SignInPanel({ api, session }: {
  readonly api: AuthApi;
  readonly session: AuthSession;
}): JSX.Element {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (busy || email.trim() === '' || password === '') return;
    setBusy(true);
    const out = await api.signIn(email.trim(), password);
    setPassword('');
    setBusy(false);
    if (!out.ok) {
      setFailure(out.reason);
      return;
    }
    setFailure(session.accept(out.value) ? null : 'malformed');
  }

  return (
    <Panel title={t('auth.signin.title')}>
      <form
        onSubmit={e => { void submit(e); }}
        style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
      >
        <TextField
          label={t('auth.signin.email')}
          value={email}
          onChange={setEmail}
          inputType="email"
          autoComplete="username"
          autoFocus
          disabled={busy}
        />
        <TextField
          label={t('auth.signin.password')}
          value={password}
          onChange={setPassword}
          inputType="password"
          autoComplete="current-password"
          disabled={busy}
        />
        {failure !== null && <StateBanner severity="blocking" message={t(`auth.failure.${failure}`)} />}
        {/* L'envoi part du formulaire, au clic comme à la touche Entrée : un
            second déclencheur sur le bouton enverrait deux fois. */}
        <Button rank="primary" type="submit" disabled={busy} onClick={() => undefined}>
          {t('auth.signin.submit')}
        </Button>
      </form>
    </Panel>
  );
}

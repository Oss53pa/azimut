import { type JSX, type FormEvent, useState } from 'react';
import { Panel, TextField, Button, StateBanner, SPACE, TEXT, NUMERIC_STYLE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { AuthApi, AuthFailure, TotpEnrollment } from './auth-api.js';
import type { AuthSession } from './auth-session.js';

const SIX_DIGITS = /^\d{6}$/;

/**
 * A6.3 et O3 : enrôler ou vérifier le second facteur (TOTP).
 *
 * L'image du code à scanner n'est affichée que si le service la rend comme une
 * image intégrée (`data:image/…`) ; toute autre adresse est ignorée, et la clé
 * à saisir reste disponible. Un code qui n'a pas six chiffres n'est pas envoyé.
 */
export function SecondFactorPanel({ api, session, mode, factorId, onSignOut }: {
  readonly api: AuthApi;
  readonly session: AuthSession;
  readonly mode: 'enroll' | 'verify';
  /** Le facteur vérifié à présenter, en vérification. */
  readonly factorId: string | null;
  readonly onSignOut: (scope: 'local' | 'global') => void;
}): JSX.Element {
  const { t } = useI18n();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const target = mode === 'enroll' ? enrollment?.id ?? null : factorId;

  async function start(): Promise<void> {
    const token = session.accessToken();
    if (token === undefined || busy) return;
    setBusy(true);
    const out = await api.enrollTotp(token);
    setBusy(false);
    if (out.ok) setEnrollment(out.value);
    setFailure(out.ok ? null : out.reason);
  }

  async function verify(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const token = session.accessToken();
    if (token === undefined || target === null || busy) return;
    if (!SIX_DIGITS.test(code)) {
      setFailure('invalid_code');
      return;
    }
    setBusy(true);
    const out = await api.verifyTotp(token, target, code);
    setCode('');
    setBusy(false);
    if (!out.ok) {
      setFailure(out.reason);
      return;
    }
    setFailure(session.accept(out.value) ? null : 'malformed');
  }

  const title = mode === 'enroll' ? t('auth.mfa.enroll.title') : t('auth.mfa.verify.title');
  const qr = enrollment?.totp.qr_code ?? '';
  return (
    <Panel title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <p style={{ margin: 0, fontSize: TEXT.body }}>
          {mode === 'enroll' ? t('auth.mfa.enroll.body') : t('auth.mfa.verify.body')}
        </p>
        {mode === 'enroll' && enrollment === null && (
          <Button rank="primary" disabled={busy} onClick={() => { void start(); }}>
            {t('auth.mfa.enroll.start')}
          </Button>
        )}
        {enrollment !== null && qr.startsWith('data:image/') && (
          <img src={qr} alt={t('auth.mfa.enroll.qr')} style={{ alignSelf: 'flex-start' }} />
        )}
        {enrollment !== null && (
          <p style={{ margin: 0, fontSize: TEXT.small }}>
            {t('auth.mfa.enroll.secret')} <span style={NUMERIC_STYLE}>{enrollment.totp.secret}</span>
          </p>
        )}
        {target !== null && (
          <form
            onSubmit={e => { void verify(e); }}
            style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
          >
            <TextField
              label={t('auth.mfa.code')}
              value={code}
              onChange={value => { setCode(value.replace(/\s/g, '')); }}
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              disabled={busy}
            />
            <Button rank="primary" type="submit" disabled={busy} onClick={() => undefined}>
              {t('auth.mfa.submit')}
            </Button>
          </form>
        )}
        {failure !== null && <StateBanner severity="blocking" message={t(`auth.failure.${failure}`)} />}
        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <Button rank="quiet" onClick={() => { onSignOut('local'); }}>{t('auth.signout.local')}</Button>
          <Button rank="quiet" onClick={() => { onSignOut('global'); }}>{t('auth.signout.global')}</Button>
        </div>
      </div>
    </Panel>
  );
}

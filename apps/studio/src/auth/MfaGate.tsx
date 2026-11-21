/**
 * AUTH.6 — l'écran du second facteur, entre l'identité et l'atelier.
 *
 * O3 : « Un compte de ces rôles sans double authentification enrôlée ne peut
 * rien faire d'autre que l'enrôler. » C'est ce que cet écran laisse faire, et
 * rien d'autre : enrôler un facteur, ou saisir le code du facteur existant.
 * La base, elle, refuse tout le reste en `aal1` (0080).
 */
import { type FormEvent, type JSX, type ReactNode, useState } from 'react';
import type { GoTrueClient } from '@supabase/auth-js';
import { Button, StateBanner, TextField, SPACE, TEXT, LABEL_STYLE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { useSessionIdentity } from './identity.js';
import { useMfa } from './use-mfa.js';
import type { Enrolment } from './use-mfa.js';
import { qrImageSource, totpCode } from './mfa-step.js';

export function MfaGate({ client, children }: {
  readonly client: GoTrueClient;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  const { actor } = useSessionIdentity();
  const mfa = useMfa(client, actor);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessageKey | null>(null);

  if (mfa.state.status === 'loading') {
    return <p role="status" style={{ padding: SPACE.lg, fontSize: TEXT.small }}>{t('auth.mfa.loading')}</p>;
  }
  if (mfa.state.status === 'failed') {
    return <div style={{ padding: SPACE.lg }}><StateBanner severity="blocking" message={t('auth.mfa.unavailable')} /></div>;
  }
  if (mfa.state.step === 'none') return <>{children}</>;

  const enrolling = mfa.state.step === 'enroll';
  const factorId = enrolling ? enrolment?.factorId ?? null : mfa.state.factorId;
  const qr = enrolment === null ? null : qrImageSource(enrolment.qrCode);

  async function start(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const started = await mfa.enrol();
    setBusy(false);
    if (started === null) setMessage('auth.mfa.unavailable');
    else setEnrolment(started);
  }

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (factorId === null) return;
    const valid = totpCode(code);
    if (valid === null) { setMessage('auth.mfa.refusal.code'); return; }
    setBusy(true);
    setMessage(null);
    const failure = await mfa.verify(factorId, valid);
    setBusy(false);
    setCode('');
    if (failure !== null) setMessage(failure === 'code_refused' ? 'auth.mfa.failed' : 'auth.mfa.unavailable');
  }

  return (
    <section aria-label={t('auth.mfa.title')} style={{ display: 'grid', gap: SPACE.md, padding: SPACE.lg, maxWidth: 480 }}>
      <h1 style={{ ...LABEL_STYLE, margin: 0 }}>{t('auth.mfa.title')}</h1>
      <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
        {t(enrolling ? 'auth.mfa.intro_enroll' : 'auth.mfa.intro_verify')}
      </p>
      {message !== null && <StateBanner severity="blocking" message={t(message)} />}

      {enrolling && enrolment === null && (
        <Button onClick={() => { void start(); }} disabled={busy}>{t('auth.mfa.start')}</Button>
      )}

      {enrolling && enrolment !== null && (
        <div style={{ display: 'grid', gap: SPACE.sm }}>
          {qr !== null && <img src={qr} alt={t('auth.mfa.qr_alt')} width={200} height={200} />}
          <p style={{ margin: 0, fontSize: TEXT.small }}>{t('auth.mfa.secret')}</p>
          <code style={{ fontSize: TEXT.small, wordBreak: 'break-all' }}>{enrolment.secret}</code>
        </div>
      )}

      {factorId !== null && (
        <form onSubmit={e => { void submit(e); }} style={{ display: 'grid', gap: SPACE.sm }}>
          <TextField
            label={t('auth.mfa.code')} value={code} onChange={setCode}
            autoComplete="one-time-code" maxLength={8} disabled={busy} autoFocus
          />
          <Button type="submit" onClick={() => undefined} disabled={busy}>
            {busy ? t('auth.mfa.submitting') : t('auth.mfa.submit')}
          </Button>
        </form>
      )}
    </section>
  );
}

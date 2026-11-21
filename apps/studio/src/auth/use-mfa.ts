/**
 * AUTH.6 — le second facteur auprès du service d'authentification.
 *
 * Le facteur retenu est le TOTP, celui d'une application d'authentification :
 * il ne demande ni téléphone ni service tiers, et il est disponible dans
 * l'installation autonome (AUTH.2 et AUTH.5 l'ont éprouvé).
 *
 * Une vérification réussie fait délivrer par le service un jeton `aal2` ; la
 * session le reçoit par `onAuthStateChange` et le pose comme jeton de toutes
 * les requêtes (`use-auth-session.ts`). Rien ici ne le transporte.
 */
import { useCallback, useEffect, useState } from 'react';
import type { GoTrueClient } from '@supabase/auth-js';
import type { ScheduleActor } from '../state/message-schedule-permissions.js';
import { mfaStep } from './mfa-step.js';
import type { MfaStep } from './mfa-step.js';

export type Enrolment = {
  readonly factorId: string;
  /** L'image du code QR, telle que le service la rend. */
  readonly qrCode: string;
  /** Le secret, pour une saisie à la main dans l'application. */
  readonly secret: string;
};

export type MfaState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly step: MfaStep; readonly factorId: string | null };

export type MfaFailure = 'code_refused' | 'unavailable';

export function useMfa(client: GoTrueClient, actor: ScheduleActor): {
  readonly state: MfaState;
  readonly enrol: () => Promise<Enrolment | null>;
  readonly verify: (factorId: string, code: string) => Promise<MfaFailure | null>;
} {
  const [state, setState] = useState<MfaState>({ status: 'loading' });

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [level, factors] = await Promise.all([
        client.mfa.getAuthenticatorAssuranceLevel(),
        client.mfa.listFactors(),
      ]);
      if (level.error !== null || factors.error !== null) { setState({ status: 'failed' }); return; }
      const verified = factors.data.totp;
      setState({
        status: 'ready',
        step: mfaStep({ actor, currentLevel: level.data.currentLevel, verifiedFactors: verified.length }),
        factorId: verified[0]?.id ?? null,
      });
    } catch {
      setState({ status: 'failed' });
    }
  }, [client, actor]);

  useEffect(() => { void refresh(); }, [refresh]);

  const enrol = useCallback(async (): Promise<Enrolment | null> => {
    try {
      // Un enrôlement abandonné laisse un facteur non vérifié ; le service en
      // limite le nombre. Il est retiré avant d'en commencer un autre.
      const listed = await client.mfa.listFactors();
      for (const factor of listed.data?.all ?? []) {
        if (factor.status === 'unverified') await client.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await client.mfa.enroll({ factorType: 'totp' });
      if (error !== null) return null;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    } catch {
      return null;
    }
  }, [client]);

  const verify = useCallback(async (factorId: string, code: string): Promise<MfaFailure | null> => {
    try {
      const { error } = await client.mfa.challengeAndVerify({ factorId, code });
      if (error !== null) {
        return error.status === undefined || error.status === 0 || error.status >= 500
          ? 'unavailable' : 'code_refused';
      }
      await refresh();
      return null;
    } catch {
      return 'unavailable';
    }
  }, [client, refresh]);

  return { state, enrol, verify };
}

import type { JSX } from 'react';
import type { Finding } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { causesOf } from '../state/propagation-findings.js';
import { StateBanner } from './ui/index.js';

/**
 * S6.5, S-21 — les anomalies bloquantes du graphe introduites par des
 * commandes reçues d'autres postes, et ces commandes par leur numéro au
 * journal. Rien quand il n'y en a pas.
 */
export function PropagationBanner({ findings }: { readonly findings: readonly Finding[] }): JSX.Element | null {
  const { t } = useI18n();
  if (findings.length === 0) return null;
  return (
    <StateBanner
      severity="blocking"
      message={t('propagation.blocking', { count: findings.length, commands: causesOf(findings) })}
      hint={t('propagation.blocking.hint')}
    />
  );
}

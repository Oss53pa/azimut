import { type JSX } from 'react';
import type { Finding } from '@azimut/core-model';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';
import { SPACE, TEXT, NUMERIC_STYLE, severityColor } from '../../components/ui/index.js';

type FindingListProps = {
  readonly findings: readonly Finding[];
  /** Phrase affichée quand la liste est vide. Déjà traduite. */
  readonly empty: string;
  readonly limit?: number | undefined;
};

/**
 * D2 — une anomalie s'affiche avec son code et son message catalogué. Le code
 * est une donnée, il n'est pas traduit ; le message l'est.
 */
export function FindingList({ findings, empty, limit }: FindingListProps): JSX.Element {
  const { lang } = useI18n();

  if (findings.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{empty}</p>
    );
  }

  const shown = limit === undefined ? findings : findings.slice(0, limit);

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.sm }}>
      {shown.map((finding, index) => (
        <li
          key={`${finding.code}-${finding.entity?.id ?? String(index)}-${String(index)}`}
          style={{ borderLeft: `2px solid ${severityColor(finding.severity)}`, paddingLeft: SPACE.sm }}
        >
          <div style={{ ...NUMERIC_STYLE, fontSize: TEXT.micro, color: severityColor(finding.severity) }}>
            {finding.code}
          </div>
          <div style={{ fontSize: TEXT.small, color: 'var(--text-primary)' }}>
            {getErrorMessage(finding.code as ErrorCode, lang) ?? finding.code}
          </div>
          {finding.entity !== null && (
            <div style={{ ...NUMERIC_STYLE, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
              {`${finding.entity.kind}:${finding.entity.id}`}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

import { type JSX } from 'react';
import type { FormNotice } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';
import { SPACE, TEXT, severityColor } from '../../components/ui/index.js';

type NoticeListProps = {
  readonly notices: readonly FormNotice[];
};

/**
 * D2.2 — un refus de saisie sans code au catalogue. Il se dit par son message
 * seul : il n'a pas de code à montrer, et n'en invente pas.
 */
export function NoticeList({ notices }: NoticeListProps): JSX.Element | null {
  const { t } = useI18n();
  if (notices.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.sm }}>
      {notices.map((n, index) => (
        <li
          key={`${n.key}-${String(index)}`}
          role={n.severity === 'blocking' ? 'alert' : 'status'}
          style={{ borderLeft: `2px solid ${severityColor(n.severity)}`, paddingLeft: SPACE.sm, fontSize: TEXT.small }}
        >
          {t(n.key)}
        </li>
      ))}
    </ul>
  );
}

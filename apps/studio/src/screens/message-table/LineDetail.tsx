import { type JSX } from 'react';
import { Panel, StateBanner, Note, SPACE, TEXT, NUMERIC_STYLE } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/index.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode } from '@azimut/core-model';
import type { ScheduleRow } from '../../state/message-schedule-rows.js';

/**
 * R7 (partie R) — le panneau de détail.
 *
 * « Il répond à la seule question que la maîtrise d'ouvrage se pose devant une
 * ligne : pourquoi cette ligne existe-t-elle ? »
 *
 * Quatre sections, dans l'ordre de R7 : justification, continuité, sources,
 * annotations. La continuité (R7.2) et les annotations (R7.4) demandent des
 * données que cette session ne charge pas — la séquence du plan de jalonnement
 * et les annotations de la partie J. Elles sont nommées comme absentes plutôt
 * qu'affichées vides : une continuité muette se lirait comme une continuité
 * vérifiée.
 */
export type LineDetailProps = {
  readonly row: ScheduleRow | null;
  /** R7.1 — les profils de parcours qui passent par le point de décision. */
  readonly profilesAtDecisionPoint: readonly string[];
  /** R7.3 — chaque source mène à l'écran où elle se corrige. */
  readonly onOpenSource: (source: SourceKey) => void;
  readonly lang: string;
};

/** R7.3 — les cinq sources dont une ligne dérive, et leur écran de correction. */
export const SOURCE_KEYS = [
  'directory', 'zoning', 'placement', 'wayfinding', 'pictogram',
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

const SOURCE_LABELS: Readonly<Record<SourceKey, UiMessageKey>> = {
  directory: 'msgtable.source.directory',
  zoning: 'msgtable.source.zoning',
  placement: 'msgtable.source.placement',
  wayfinding: 'msgtable.source.wayfinding',
  pictogram: 'msgtable.source.pictogram',
};

export function LineDetail(props: LineDetailProps): JSX.Element {
  const { t, lang } = useI18n();
  const { row } = props;

  return (
    <Panel title={t('msgtable.detail')}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: SPACE.lg,
        padding: SPACE.md, minWidth: 260, maxWidth: 360,
      }}>
        {row === null ? (
          <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
            {t('msgtable.detail.none')}
          </p>
        ) : (
          <>
            <Section title={t('msgtable.detail.justification')}>
              {/* M02.W4 : une ligne sans point de décision ne peut pas exister,
                  l'écran n'a donc jamais à afficher une justification vide. */}
              <Row label={t('msgtable.detail.decision_point')} value={row.line.decision_point_id} numeric />
              <Row
                label={t('msgtable.detail.profiles')}
                value={props.profilesAtDecisionPoint.join(', ')}
              />
              <Row
                label={t('msgtable.detail.destination')}
                value={destinationsOf(row)}
              />
            </Section>

            <Section title={t('msgtable.detail.continuity')}>
              <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                {t('msgtable.detail.continuity.unavailable')}
              </p>
              {row.findings
                .filter(f => f.code === 'WAYFIND.CONTINUITY_BROKEN')
                .map(f => (
                  <StateBanner
                    key={f.code}
                    severity="blocking"
                    code={f.code}
                    message={getErrorMessage(f.code as ErrorCode, lang) ?? f.code}
                  />
                ))}
            </Section>

            {row.exclusion !== null && (
              <Section title={t('msgtable.detail.exclusion')}>
                <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>
                  {t('msgtable.detail.exclusion.body', {
                    cap: row.exclusion.cap,
                    rule: row.exclusion.ruleRef,
                    excluded: row.exclusion.excludedPriority,
                    kept: row.exclusion.lastKeptPriority,
                  })}
                </p>
              </Section>
            )}

            <Section title={t('msgtable.detail.sources')}>
              {SOURCE_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { props.onOpenSource(key); }}
                  style={linkStyle}
                >
                  {t(SOURCE_LABELS[key])}
                </button>
              ))}
              <Note>{t('msgtable.detail.sources.note')}</Note>
            </Section>

            <Section title={t('msgtable.detail.annotations')}>
              <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                {t('msgtable.detail.annotations.none')}
              </p>
            </Section>
          </>
        )}
      </div>
    </Panel>
  );
}

function destinationsOf(row: ScheduleRow): string {
  const ids = row.line.entries
    .map(entry => entry.destination_id)
    .filter((id): id is string => id !== null);
  return ids.join(', ');
}

function Section({ title, children }: {
  readonly title: string;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <h3 style={{
        margin: 0, fontSize: TEXT.micro, textTransform: 'uppercase',
        letterSpacing: '0.04em', color: 'var(--text-secondary)',
      }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, numeric = false }: {
  readonly label: string;
  readonly value: string;
  readonly numeric?: boolean;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm }}>
      <span style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        ...(numeric ? NUMERIC_STYLE : {}),
        fontSize: TEXT.micro, color: 'var(--text-primary)', textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  textAlign: 'left',
  fontSize: TEXT.micro,
  color: 'var(--text-link)',
  textDecoration: 'underline',
  cursor: 'pointer',
};

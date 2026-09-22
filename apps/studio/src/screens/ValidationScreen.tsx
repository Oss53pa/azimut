import { type JSX } from 'react';
import {
  Panel, ScreenStates, Button, StateBanner, Tag, SPACE, TEXT,
} from '../components/ui/index.js';
import type { ScreenState } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';
import {
  present, countsBySeverity, coverageDisplay, toLine, SEVERITY_ORDER,
} from '../state/validation-report.js';
import type { ValidationState, EntityGroup, Severity } from '../state/validation-report.js';

/**
 * M5 (partie M) — écran de validation de complétude.
 *
 * « Un écran vide qui ressemble à une réussite alors que rien n'a été calculé
 * est le pire des états possibles. » L'écran distingue donc trois vides :
 * jamais lancé, en cours, et sans anomalie — et n'en présente qu'un comme un
 * succès.
 */
export type ValidationScreenProps = {
  readonly state: ScreenState;
  readonly validation: ValidationState;
  /** Le taux de couverture calculé, quand il l'est. */
  readonly coverageRatePct: number | null;
  readonly rulesPack: { readonly key: string; readonly version: string } | null;
  readonly onRun: () => void;
  readonly onOpen: (entity: { readonly kind: string; readonly id: string }) => void;
  readonly onExport: () => void;
};

export function ValidationScreen(props: ValidationScreenProps): JSX.Element {
  const { t, lang } = useI18n();
  const presentation = present(props.validation);
  const counts = props.validation.kind === 'ran'
    ? countsBySeverity(props.validation.findings)
    : null;
  const coverage = coverageDisplay(props.validation, props.coverageRatePct);

  return (
    <ScreenStates
      state={props.state}
      skeleton={<StateBanner severity="info" message={t('valid.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
        <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button rank="primary" onClick={props.onRun}>
            {presentation.kind === 'invite' ? t('valid.action.run') : t('valid.action.rerun')}
          </Button>
          <Button
            rank="secondary"
            onClick={props.onExport}
            // Exporter ce qui n'a pas été calculé produirait un document qui ment.
            disabled={props.validation.kind !== 'ran'}
          >
            {t('valid.action.export')}
          </Button>
          {props.validation.kind === 'ran' && (
            <span style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
              {t('valid.duration', { ms: String(props.validation.durationMs) })}
            </span>
          )}
        </div>

        {counts !== null && <Counts counts={counts} />}
        <Coverage display={coverage} />

        {/* M7.11 (partie M) : jamais lancé n'est pas un succès. */}
        {presentation.kind === 'invite' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, padding: SPACE.xl }}>
            <p style={{ margin: 0, fontSize: TEXT.lead, color: 'var(--text-secondary)' }}>
              {t('valid.never_run')}
            </p>
            <Button rank="primary" onClick={props.onRun}>{t('valid.action.run')}</Button>
          </div>
        )}

        {presentation.kind === 'progress' && (
          <StateBanner severity="info" message={t('valid.running')} />
        )}

        {presentation.kind === 'clean' && (
          <StateBanner
            severity="valid"
            message={t('valid.clean')}
            // M5 (partie M) : « la complétude n'est pas la justesse ».
            hint={t('valid.clean.hint')}
          />
        )}

        {presentation.kind === 'findings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            {presentation.groups.map(group => (
              <Group key={groupKey(group)} group={group} lang={lang} onOpen={props.onOpen} />
            ))}
          </div>
        )}

        {props.rulesPack !== null && (
          <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
            {t('valid.rulespack', { key: props.rulesPack.key, version: props.rulesPack.version })}
          </p>
        )}
      </div>
    </ScreenStates>
  );
}

/** Le bandeau de comptes, par gravité décroissante. */
function Counts({ counts }: { readonly counts: Readonly<Record<Severity, number>> }): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', gap: SPACE.lg }}>
      {SEVERITY_ORDER.map(severity => (
        <span key={severity} style={{ display: 'inline-flex', gap: SPACE.xs, fontSize: TEXT.small }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            {counts[severity]}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{t(severityKey(severity))}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * W10 (partie N) et M5 (partie M) : le compteur dit que le calcul est
 * conditionné, « il n'affiche jamais zéro ni un tiret ».
 */
function Coverage({ display }: {
  readonly display: ReturnType<typeof coverageDisplay>;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'baseline', fontSize: TEXT.small }}>
      <span style={{ color: 'var(--text-secondary)' }}>{t('valid.coverage')}</span>
      {display.kind === 'value'
        ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display.ratePct} %</span>
        : (
          <Tag
            label={display.on === 'never_run'
              ? t('valid.coverage.awaiting_run')
              : t('valid.coverage.awaiting_clean')}
            muted
          />
        )}
    </div>
  );
}

function Group({ group, lang, onOpen }: {
  readonly group: EntityGroup;
  readonly lang: string;
  readonly onOpen: (entity: { readonly kind: string; readonly id: string }) => void;
}): JSX.Element {
  const { t } = useI18n();
  const title = group.entity === null
    ? t('valid.group.site')
    : `${group.entity.kind} ${group.entity.id}`;

  return (
    <Panel title={title}>
      <ul style={{ listStyle: 'none', margin: 0, padding: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {group.findings.map(finding => (
          <Line key={finding.code} finding={finding} lang={lang} onOpen={onOpen} t={t} />
        ))}
      </ul>
    </Panel>
  );
}

function Line({ finding, lang, onOpen, t }: {
  readonly finding: Finding;
  readonly lang: string;
  readonly onOpen: (entity: { readonly kind: string; readonly id: string }) => void;
  readonly t: (key: 'valid.action.open') => string;
}): JSX.Element {
  const line = toLine(finding);
  return (
    <li style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, flexWrap: 'wrap' }}>
      {/* La gravité se lit au mot, jamais à la seule teinte (M7.7, partie M). */}
      <Tag label={line.severity} severity={line.severity === 'blocking' ? 'blocking' : line.severity === 'warning' ? 'warning' : undefined} />
      <span style={{ fontSize: TEXT.body }}>
        {getErrorMessage(finding.code as ErrorCode, lang === 'en' ? 'en' : 'fr') ?? finding.code}
      </span>
      {/* M5 (partie M) : une normative sans référence visible est un défaut. */}
      {line.ruleRef !== null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {line.ruleRef}
        </span>
      )}
      {line.openable && line.entity !== null && (
        <Button rank="quiet" onClick={() => { onOpen(line.entity as { kind: string; id: string }); }}>
          {t('valid.action.open')}
        </Button>
      )}
    </li>
  );
}

function groupKey(group: EntityGroup): string {
  return group.entity === null ? 'site' : `${group.entity.kind}:${group.entity.id}`;
}

function severityKey(severity: Severity): 'valid.severity.blocking' | 'valid.severity.warning' | 'valid.severity.info' {
  return severity === 'blocking' ? 'valid.severity.blocking'
    : severity === 'warning' ? 'valid.severity.warning'
      : 'valid.severity.info';
}

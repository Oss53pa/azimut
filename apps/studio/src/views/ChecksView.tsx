import { type JSX, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteVocabulary } from '../context/useSiteVocabulary.js';
import { useI18n } from '../i18n/useI18n.js';
import { runChecks, validateGraph, validateGeometry, validateDirectory, validateSupports } from '@azimut/engine-graph';
import type { Finding, SiteData, SiteVocabulary } from '@azimut/core-model';
import { downloadText } from '../components/download.js';
import {
  ScreenHeader, MetricRow, Panel, StateBanner, Note,
  SPACE, TEXT, type Metric, type ScreenAction,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type ValidationRun = {
  readonly findings: readonly Finding[];
  readonly checksRun: readonly string[];
  readonly checksSkipped: readonly string[];
  readonly checksUndeclared: readonly string[];
  /** Horodatage du calcul, fourni par l'écran — jamais lu dans un moteur. */
  readonly ranAt: string;
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

function validate(site: SiteData, vocabulary: SiteVocabulary, ranAt: string): ValidationRun {
  const checks = runChecks(site, vocabulary);
  return {
    findings: [
      ...(checks.ok ? checks.value.findings : checks.findings),
      ...findingsOf(validateGraph(site)),
      ...findingsOf(validateGeometry(site)),
      ...findingsOf(validateDirectory(site)),
      ...findingsOf(validateSupports(site)),
    ],
    checksRun: checks.ok ? checks.value.checks_run : [],
    checksSkipped: checks.ok ? checks.value.checks_skipped : [],
    checksUndeclared: checks.ok ? checks.value.checks_undeclared : [],
    ranAt,
  };
}

/** Une ligne d'export : code, sévérité, entité. Le reste se relit au catalogue. */
function toCsv(run: ValidationRun, site: SiteData): string {
  const rows = [
    ['site', 'ran_at', 'severity', 'code', 'entity_kind', 'entity_id', 'rule_ref'].join(';'),
    ...run.findings.map(f => [
      site.site.id,
      run.ranAt,
      f.severity,
      f.code,
      f.entity?.kind ?? '',
      f.entity?.id ?? '',
      f.ruleRef ?? '',
    ].join(';')),
  ];
  return rows.join('\n');
}

/**
 * Tranche M · écran M5 — la validation.
 *
 * Elle ne se lance pas toute seule : un écran vide qui ressemble à une réussite
 * alors que rien n'a été calculé serait le pire des états. Tant que la
 * validation n'a pas tourné, l'écran le dit et n'affiche aucun compteur.
 */
export function ChecksView(): JSX.Element {
  const site = useSiteData();
  const vocabulary = useSiteVocabulary();
  const { t } = useI18n();
  const [run, setRun] = useState<ValidationRun | null>(null);

  function launch(): void {
    setRun(validate(site, vocabulary, new Date().toISOString()));
  }

  const actions: readonly ScreenAction[] = [
    {
      id: 'export',
      label: t('validation.action.export'),
      disabled: run === null,
      onSelect: () => {
        if (run === null) return;
        downloadText(`validation-${site.site.id}.csv`, 'text/csv', toCsv(run, site));
      },
    },
    {
      id: 'run',
      label: run === null ? t('validation.action.run') : t('validation.action.rerun'),
      primary: true,
      onSelect: launch,
    },
  ];

  if (run === null) {
    return (
      <div>
        <ScreenHeader
          eyebrow={t('validation.eyebrow')}
          title={t('validation.title')}
          subtitle={t('validation.subtitle')}
          actions={actions}
        />
        <StateBanner
          severity="info"
          message={t('validation.neverrun.message')}
          hint={t('validation.neverrun.hint')}
        />
        <Note>{t('validation.note')}</Note>
      </div>
    );
  }

  const blocking = run.findings.filter(f => f.severity === 'blocking');
  const warnings = run.findings.filter(f => f.severity === 'warning');
  const info = run.findings.filter(f => f.severity === 'info');

  const metrics: readonly Metric[] = [
    {
      id: 'blocking',
      label: t('severity.blocking'),
      value: String(blocking.length),
      severity: blocking.length > 0 ? 'blocking' : 'valid',
    },
    { id: 'warnings', label: t('severity.warning'), value: String(warnings.length), severity: 'warning' },
    { id: 'info', label: t('severity.info'), value: String(info.length), severity: 'info' },
    { id: 'run', label: t('validation.metric.run'), value: String(run.checksRun.length) },
    {
      id: 'skipped',
      label: t('validation.metric.skipped'),
      value: String(run.checksSkipped.length),
      note: t('validation.metric.skipped.note'),
      severity: run.checksSkipped.length > 0 ? 'warning' : 'valid',
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('validation.eyebrow')}
        title={t('validation.title')}
        subtitle={t('validation.subtitle')}
        actions={actions}
      >
        <span style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
          {t('validation.ranat', {
            site: site.site.name,
            pack: site.site.rules_pack_id ?? t('validation.nopack'),
          })}
        </span>
      </ScreenHeader>

      <MetricRow metrics={metrics} />

      {run.findings.length === 0 && (
        <div style={{ marginTop: SPACE.lg }}>
          <StateBanner
            severity="valid"
            message={t('validation.clean.message', { count: run.checksRun.length })}
            hint={
              run.checksUndeclared.length > 0
                ? t('validation.clean.hint.partial', { count: run.checksUndeclared.length })
                : t('validation.clean.hint')
            }
          />
        </div>
      )}

      {run.checksSkipped.length > 0 && (
        <div style={{ marginTop: SPACE.md }}>
          <StateBanner
            severity="warning"
            code="RULES.PACK_NOT_BOUND"
            message={t('validation.skipped.message', { list: run.checksSkipped.join(', ') })}
            hint={t('validation.skipped.hint')}
          />
        </div>
      )}

      {run.checksUndeclared.length > 0 && (
        <div style={{ marginTop: SPACE.md }}>
          <StateBanner
            severity="warning"
            message={t('validation.undeclared.message', { list: run.checksUndeclared.join(', ') })}
            hint={t('validation.undeclared.hint')}
          />
        </div>
      )}

      <div style={{ display: 'grid', gap: SPACE.lg, marginTop: SPACE.lg }}>
        {([
          ['blocking', blocking, 'validation.panel.blocking'],
          ['warning', warnings, 'validation.panel.warnings'],
          ['info', info, 'validation.panel.info'],
        ] as const).map(([id, list, titleKey]) => (
          list.length === 0 ? null : (
            <Panel key={id} title={t(titleKey)} note={String(list.length)}>
              <FindingList findings={list} empty={t('validation.group.empty')} />
            </Panel>
          )
        ))}
      </div>

      <Note>{t('validation.note')}</Note>
    </div>
  );
}

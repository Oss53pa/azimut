import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { messageScheduleToCsv, messageScheduleToMarkdown } from '@azimut/engine-graph';
import type { InformationLevel, TypologyInformationLevels } from '@azimut/engine-graph';
import { downloadText } from '../components/download.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, StateBanner, Note, Tag,
  SPACE, TEXT, LABEL_STYLE,
  type Metric, type ScreenAction,
} from '../components/ui/index.js';
import { ScheduleTable } from './message-schedule/ScheduleTable.js';
import { FindingList } from './message-schedule/FindingList.js';
import { buildScheduleModel, declaredInformationLevels } from './message-schedule/schedule-model.js';
import { InformationLevelDeclaration } from './message-schedule/InformationLevelDeclaration.js';

const LEVEL_FILTERS = [0, 1, 2, 3, 4] as const;

/**
 * Module 02 — H2.5. Le tableau des messages s'intercale entre le graphe et la
 * composition : c'est lui que la maîtrise d'ouvrage valide, et c'est lui que le
 * moteur de composition consomme. L'écran ne saisit aucun contenu de face, il
 * affiche ce que le moteur résout.
 */
export function MessageScheduleView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();

  const firstType = site.support_types[0]?.key ?? '';
  const [supportTypeKey, setSupportTypeKey] = useState(firstType);
  const [levelFilter, setLevelFilter] = useState<number>(0);
  const [staleOnly, setStaleOnly] = useState(false);
  const [declarations, setDeclarations] = useState<readonly TypologyInformationLevels[]>(
    () => declaredInformationLevels(site),
  );
  const [maxDestinations, setMaxDestinations] = useState<number | null>(null);

  const profile = site.travel_profiles[0];

  const model = useMemo(() => {
    if (profile === undefined) return null;
    return buildScheduleModel(site, profile, {
      supportTypeKey,
      version: 1,
      rules: { max_destinations_per_face: maxDestinations },
      informationLevels: declarations,
      lang,
    });
  }, [site, profile, supportTypeKey, declarations, maxDestinations, lang]);

  if (profile === undefined || model === null) {
    return (
      <div>
        <ScreenHeader eyebrow={t('schedule.eyebrow')} title={t('schedule.title')} subtitle={t('schedule.subtitle')} />
        <StateBanner
          severity="blocking"
          code="GRAPH.PROFILE_NOT_ACCESSIBLE"
          message={t('schedule.noprofile')}
        />
      </div>
    );
  }

  const schedule = model.schedule;

  const visibleLines = (schedule?.lines ?? []).filter(line => {
    if (staleOnly && !line.stale) return false;
    if (levelFilter !== 0 && line.information_level !== levelFilter) return false;
    return true;
  });

  const metrics: readonly Metric[] = [
    { id: 'version', label: t('schedule.metric.version'), value: schedule === null ? '—' : `v${String(schedule.version)}` },
    { id: 'state', label: t('schedule.metric.state'), value: schedule?.state ?? '—' },
    { id: 'hash', label: t('schedule.metric.hash'), value: model.inputsHash.slice(0, 8) },
    { id: 'lines', label: t('schedule.metric.lines'), value: String(schedule?.lines.length ?? 0) },
    {
      id: 'stale',
      label: t('schedule.metric.stale'),
      value: String(model.staleCount),
      severity: model.staleCount > 0 ? 'warning' : 'valid',
    },
    { id: 'supports', label: t('schedule.metric.supports'), value: String(model.supports.length) },
  ];

  const actions: readonly ScreenAction[] = [
    {
      id: 'csv',
      label: t('schedule.action.csv'),
      disabled: schedule === null,
      onSelect: () => {
        if (schedule === null) return;
        downloadText(
          `tableau-messages-v${String(schedule.version)}.csv`,
          'text/csv',
          messageScheduleToCsv(schedule, lang === 'en' ? 'en' : 'fr'),
        );
      },
    },
    {
      id: 'markdown',
      label: t('schedule.action.document'),
      disabled: schedule === null,
      onSelect: () => {
        if (schedule === null) return;
        downloadText(
          `tableau-messages-v${String(schedule.version)}.md`,
          'text/markdown',
          messageScheduleToMarkdown(schedule, lang === 'en' ? 'en' : 'fr'),
        );
      },
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('schedule.eyebrow')}
        title={t('schedule.title')}
        subtitle={t('schedule.subtitle')}
        actions={actions}
      />

      <MetricRow metrics={metrics} />

      <div style={{ display: 'grid', gap: SPACE.md, marginTop: SPACE.lg }}>
        {model.source === 'trial' && (
          <StateBanner
            severity="info"
            message={t('schedule.trial.message', { count: model.supports.length })}
            hint={t('schedule.trial.hint')}
          />
        )}
        {model.staleCount > 0 && (
          <StateBanner
            severity="warning"
            code="WAYFIND.SCHEDULE_STALE"
            message={t('schedule.stale.message', { count: model.staleCount })}
          />
        )}
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: SPACE.md,
        alignItems: 'center',
        margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px`,
      }}>
        <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          {t('schedule.filter.typology')}
          <select
            value={supportTypeKey}
            onChange={(e) => { setSupportTypeKey(e.target.value); }}
            style={SELECT_STYLE}
          >
            {site.support_types.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </select>
        </label>
        <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          {t('schedule.filter.level')}
          <select
            value={String(levelFilter)}
            onChange={(e) => { setLevelFilter(Number(e.target.value)); }}
            style={SELECT_STYLE}
          >
            {LEVEL_FILTERS.map(level => (
              <option key={level} value={String(level)}>
                {level === 0 ? t('schedule.filter.level.all') : String(level)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => { setStaleOnly(e.target.checked); }}
          />
          {t('schedule.filter.staleonly')}
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {t('schedule.filter.shown', { shown: visibleLines.length, total: schedule?.lines.length ?? 0 })}
        </span>
      </div>

      <Panel title={t('schedule.panel.lines')} note={t('schedule.panel.lines.note')} padded={false}>
        <ScheduleTable lines={visibleLines} />
      </Panel>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('schedule.panel.generation')}>
            <FindingList findings={model.findings} empty={t('schedule.panel.generation.empty')} limit={12} />
          </Panel>
          <Panel title={t('schedule.panel.continuity')}>
            <FindingList findings={model.continuity} empty={t('schedule.panel.continuity.empty')} limit={8} />
          </Panel>
          <Panel title={t('schedule.panel.naming')}>
            <FindingList findings={model.naming} empty={t('schedule.panel.naming.empty')} limit={8} />
          </Panel>
          <Panel title={t('schedule.panel.rules')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, fontSize: TEXT.small }}>
              {t('schedule.rules.maxdestinations')}
              <input
                type="number"
                min={1}
                value={maxDestinations === null ? '' : String(maxDestinations)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMaxDestinations(raw === '' ? null : Number(raw));
                }}
                style={{ ...SELECT_STYLE, width: 72 }}
              />
            </label>
            <div style={{ marginTop: SPACE.sm }}>
              <Tag
                label={maxDestinations === null ? t('schedule.rules.unchecked') : t('schedule.rules.checked')}
                muted={maxDestinations === null}
                severity={maxDestinations === null ? undefined : 'valid'}
              />
            </div>
            <Note>{t('schedule.rules.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <InformationLevelDeclaration
          declarations={declarations}
          onChange={setDeclarations}
        />
      </div>

      <Note>{t('schedule.note')}</Note>
    </div>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-interactive)',
  background: 'var(--surface-panel)',
  color: 'var(--text-primary)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: TEXT.small,
  fontFamily: 'inherit',
  textTransform: 'none',
  letterSpacing: 0,
};

export type { InformationLevel };

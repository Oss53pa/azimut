import { type JSX } from 'react';
import {
  Panel, ScreenStates, Toolbar, StatusBar, TextField, SelectField,
  NumericField, Button, StateBanner, SPACE, TEXT,
} from '../components/ui/index.js';
import type { ScreenState, ToolbarItem, StatusItem } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding, Point } from '@azimut/core-model';
import { FOOTPRINT_TOOLS, FOOTPRINT_SHORTCUTS } from '../state/footprint-shortcuts.js';
import type { FootprintTool } from '../state/footprint-shortcuts.js';
import { FOOTPRINT_KINDS, UNIT_CODE_MAX } from '../state/footprint-input.js';
import type { FootprintKind } from '../state/footprint-input.js';

/**
 * M3 (partie M) — écran de tracé des empreintes.
 *
 * Trois colonnes, comme la structure du document : les calques et les outils à
 * gauche, la zone de travail au centre, les propriétés à droite, une barre
 * d'état en bas.
 *
 * « La saisie numérique des sommets est le moyen le plus précis et le seul
 * accessible au clavier. Elle figure dans le panneau, pas dans un menu
 * secondaire. » Les sommets sont donc éditables un par un, à droite, sans
 * qu'aucun geste soit nécessaire.
 */
export type FootprintsScreenProps = {
  readonly state: ScreenState;
  readonly tool: FootprintTool;
  readonly onTool: (tool: FootprintTool) => void;
  /** Le contour en cours de tracé, quantifié. */
  readonly vertices: readonly Point[];
  readonly onVertex: (index: number, axis: 'x_m' | 'y_m', value: number | null) => void;
  readonly unitCode: string;
  readonly onUnitCode: (value: string) => void;
  readonly kind: FootprintKind;
  readonly onKind: (kind: FootprintKind) => void;
  /** Calculée, en lecture seule (M3, partie M). */
  readonly areaM2: number | null;
  readonly findings: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly footprintCount: number;
  readonly onClose: () => void;
  readonly onAbandon: () => void;
  readonly children?: JSX.Element;
};

export function FootprintsScreen(props: FootprintsScreenProps): JSX.Element {
  const { t, lang } = useI18n();
  const { vertices, findings } = props;

  function messageFor(...codes: readonly string[]): string | undefined {
    const found = findings.find(f => codes.includes(f.code));
    return found === undefined
      ? undefined
      : getErrorMessage(found.code as ErrorCode, lang) ?? found.code;
  }

  const tools: readonly ToolbarItem[] = FOOTPRINT_TOOLS.map(item => ({
    id: item.tool,
    label: t(item.labelKey),
    key: item.key,
  }));

  const status: readonly StatusItem[] = [
    { id: 'count', label: t('fp.status.count'), value: String(props.footprintCount) },
    { id: 'vertices', label: t('fp.status.vertices'), value: String(vertices.length) },
    {
      id: 'anomalies',
      label: t('fp.status.anomalies'),
      value: String(findings.length),
    },
  ];

  return (
    <ScreenStates
      state={props.state}
      invitation={{
        message: t('fp.empty.message'),
        actionLabel: t('fp.empty.action'),
        onAction: () => { props.onTool('cell'); },
      }}
      skeleton={<StateBanner severity="info" message={t('fp.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'stretch', minHeight: 0 }}>
          <Toolbar
            label={t('fp.toolbar')}
            items={tools}
            active={props.tool}
            onSelect={id => { props.onTool(id as FootprintTool); }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {props.children}
          </div>

          <Panel title={t('fp.properties')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, padding: SPACE.md, minWidth: 260 }}>
              <TextField
                label={t('fp.field.code')}
                value={props.unitCode}
                onChange={props.onUnitCode}
                maxLength={UNIT_CODE_MAX}
                error={messageFor('DATA.UNIT_CODE_REQUIRED', 'DATA.CODE_DUPLICATE')}
              />

              <SelectField
                label={t('fp.field.kind')}
                value={props.kind}
                options={FOOTPRINT_KINDS.map(kind => ({
                  value: kind,
                  label: t(kindKey(kind)),
                }))}
                onChange={value => { props.onKind(value as FootprintKind); }}
              />

              {/* M7.3 (partie M) : calculée, lecture seule, et dite telle. */}
              <NumericField
                label={t('fp.field.area')}
                unit={t('unit.square_metre')}
                value={props.areaM2}
                onChange={() => { /* lecture seule */ }}
                computed
              />

              <VertexTable vertices={vertices} onVertex={props.onVertex} />
            </div>
          </Panel>
        </div>

        <Anomalies findings={findings} lang={lang} severity="blocking" />
        <Anomalies findings={props.warnings} lang={lang} severity="warning" />

        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <Button rank="secondary" onClick={props.onAbandon} disabled={vertices.length === 0}>
            {t('fp.action.abandon')}
          </Button>
          <Button rank="primary" onClick={props.onClose} disabled={vertices.length < 3}>
            {t('fp.action.close')}
          </Button>
        </div>

        <StatusBar items={status}>
          <span style={{ color: 'var(--text-muted)' }}>
            {FOOTPRINT_SHORTCUTS.map(s =>
              `${s.ctrl ? 'Ctrl+' : ''}${s.key} ${t(s.labelKey)}`).join(' · ')}
          </span>
        </StatusBar>
      </div>
    </ScreenStates>
  );
}

/**
 * M3 (partie M) : « Coordonnées des sommets | numérique | saisissables
 * individuellement, mètres, 3 décimales ».
 *
 * C'est le moyen le plus précis, et le seul accessible au clavier : il est
 * donc dans le panneau, pas dans un menu.
 */
function VertexTable({ vertices, onVertex }: {
  readonly vertices: readonly Point[];
  readonly onVertex: (index: number, axis: 'x_m' | 'y_m', value: number | null) => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <legend style={{ fontSize: TEXT.micro, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
        {t('fp.field.vertices')}
      </legend>
      {vertices.map((vertex, index) => (
        <div key={index} style={{ display: 'flex', gap: SPACE.sm }}>
          <NumericField
            label={t('fp.field.vertex_x', { n: String(index + 1) })}
            unit={t('unit.metre')}
            value={vertex.x_m}
            step={0.001}
            onChange={value => { onVertex(index, 'x_m', value); }}
          />
          <NumericField
            label={t('fp.field.vertex_y', { n: String(index + 1) })}
            unit={t('unit.metre')}
            value={vertex.y_m}
            step={0.001}
            onChange={value => { onVertex(index, 'y_m', value); }}
          />
        </div>
      ))}
    </fieldset>
  );
}

function Anomalies({ findings, lang, severity }: {
  readonly findings: readonly Finding[];
  readonly lang: string;
  readonly severity: 'blocking' | 'warning';
}): JSX.Element | null {
  if (findings.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      {findings.map(finding => (
        <StateBanner
          key={finding.code}
          severity={severity}
          message={getErrorMessage(finding.code as ErrorCode, lang === 'en' ? 'en' : 'fr') ?? finding.code}
        />
      ))}
    </div>
  );
}

function kindKey(kind: FootprintKind):
'fp.kind.cell' | 'fp.kind.circulation' | 'fp.kind.technical' | 'fp.kind.vertical_core' {
  return kind === 'cell' ? 'fp.kind.cell'
    : kind === 'circulation' ? 'fp.kind.circulation'
      : kind === 'technical' ? 'fp.kind.technical'
        : 'fp.kind.vertical_core';
}

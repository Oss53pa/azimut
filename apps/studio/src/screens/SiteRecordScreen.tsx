import { type JSX } from 'react';
import {
  Panel, ScreenStates, StatusBar, TextField, NumericField, Toggle, Button,
  StateBanner, DIMENSIONLESS, SPACE, TEXT,
} from '../components/ui/index.js';
import type { ScreenState, StatusItem } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';

/**
 * M1bis (partie M) — fiche de site, bâtiments et niveaux.
 *
 * Famille registre. C'est l'écran qui manquait : sans lui, un site reste au
 * bâtiment et au niveau que le formulaire de M1 crée, et la tâche T-1.5 est
 * impossible faute d'un second niveau.
 *
 * Deux refus par prévention plutôt que par anomalie. L'action de création
 * reste inactive tant que les champs requis ne sont pas saisis — M1bis donne
 * un code au nom en double et au rang en double, aucun à l'absence de rang ou
 * d'altitude. Et la suppression d'un niveau demande une confirmation qui nomme
 * la conséquence (M7, règle 9).
 */

export type LevelRow = {
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly elevationM: number;
  /** Ce que le niveau porte, et qui interdit sa suppression. */
  readonly footprints: number;
  readonly nodes: number;
};

export type BuildingRow = {
  readonly id: string;
  readonly name: string;
  readonly independentAccess: boolean;
  readonly defaultEdgeWidthM: number | null;
  readonly levels: readonly LevelRow[];
};

/** Le brouillon d'un niveau, ouvert sous le bâtiment qui l'accueillera. */
export type LevelForm = {
  readonly buildingId: string;
  readonly name: string;
  readonly ordinal: number | null;
  readonly elevationM: number | null;
};

export type BuildingForm = {
  readonly name: string;
  readonly independentAccess: boolean;
  readonly defaultEdgeWidthM: number | null;
};

export type SiteRecordScreenProps = {
  readonly state: ScreenState;
  readonly siteName: string;
  readonly buildings: readonly BuildingRow[];
  readonly findings: readonly Finding[];

  readonly buildingForm: BuildingForm | null;
  readonly onOpenBuildingForm: () => void;
  readonly onBuildingField: (form: BuildingForm) => void;
  readonly onCreateBuilding: () => void;

  readonly levelForm: LevelForm | null;
  readonly onOpenLevelForm: (buildingId: string) => void;
  readonly onLevelField: (form: LevelForm) => void;
  readonly onCreateLevel: () => void;
  readonly levelFormComplete: boolean;

  readonly onCloseForms: () => void;
  readonly onRename: (table: 'building' | 'level', id: string, name: string) => void;

  /** Le niveau dont la suppression est demandée, en attente de confirmation. */
  readonly pendingDeletion: LevelRow | null;
  readonly onAskDeleteLevel: (level: LevelRow) => void;
  readonly onConfirmDeleteLevel: () => void;
  readonly onCancelDeleteLevel: () => void;
};

export function SiteRecordScreen(props: SiteRecordScreenProps): JSX.Element {
  const { t, lang } = useI18n();

  const levelCount = props.buildings.reduce((n, b) => n + b.levels.length, 0);
  const status: readonly StatusItem[] = [
    { id: 'buildings', label: t('record.status.buildings'), value: String(props.buildings.length) },
    { id: 'levels', label: t('record.status.levels'), value: String(levelCount) },
  ];

  return (
    <ScreenStates
      state={props.state}
      // L'état vide laisse voir le contenu : l'invitation ouvre le formulaire
      // de création, et un état vide qui remplacerait le contenu masquerait le
      // formulaire qu'il vient d'ouvrir. Même raison que pour M3 (partie M).
      emptyKeepsContent
      invitation={{
        message: t('record.empty.message'),
        actionLabel: t('record.action.new_building'),
        onAction: props.onOpenBuildingForm,
      }}
      skeleton={<StateBanner severity="info" message={t('record.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.md }}>
          <h1 style={{ margin: 0, fontSize: TEXT.section, fontWeight: 500 }}>
            {props.siteName}
          </h1>
          <Button rank="primary" onClick={props.onOpenBuildingForm}>
            {t('record.action.new_building')}
          </Button>
        </div>

        {props.findings.map(finding => (
          <StateBanner
            key={finding.code}
            severity="blocking"
            message={getErrorMessage(finding.code as ErrorCode, lang === 'en' ? 'en' : 'fr')
              ?? finding.code}
          />
        ))}

        {props.buildingForm !== null && (
          <BuildingFields
            form={props.buildingForm}
            onField={props.onBuildingField}
            onCreate={props.onCreateBuilding}
            onCancel={props.onCloseForms}
          />
        )}

        {props.buildings.map(building => (
          <Panel key={building.id} title={building.name}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, padding: SPACE.md }}>
              <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <TextField
                  label={t('record.building.name')}
                  value={building.name}
                  onChange={name => { props.onRename('building', building.id, name); }}
                />
                <Toggle
                  label={t('record.building.independent_access')}
                  checked={building.independentAccess}
                  onChange={() => { /* lecture : la bascule s'écrit au formulaire */ }}
                  disabled
                />
                <Button rank="secondary" onClick={() => { props.onOpenLevelForm(building.id); }}>
                  {t('record.action.new_level')}
                </Button>
              </div>

              {building.levels.length === 0 && (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('record.building.no_level')}</p>
              )}

              {building.levels.map(level => (
                <div
                  key={level.id}
                  style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                  <TextField
                    label={t('record.level.name')}
                    value={level.name}
                    onChange={name => { props.onRename('level', level.id, name); }}
                  />
                  <NumericField
                    label={t('record.level.ordinal')}
                    unit={DIMENSIONLESS}
                    value={level.ordinal}
                    step={1}
                    onChange={() => { /* lecture */ }}
                    computed
                  />
                  <NumericField
                    label={t('record.level.elevation')}
                    unit={t('unit.metre')}
                    value={level.elevationM}
                    step={0.001}
                    onChange={() => { /* lecture */ }}
                    computed
                  />
                  <Button
                    rank="quiet"
                    onClick={() => { props.onAskDeleteLevel(level); }}
                    // M1bis : refusé s'il porte des empreintes ou des nœuds.
                    // Le bouton dit pourquoi au lieu de laisser presser puis
                    // refuser.
                    disabled={level.footprints > 0 || level.nodes > 0}
                  >
                    {t('record.action.delete_level')}
                  </Button>
                  {(level.footprints > 0 || level.nodes > 0) && (
                    <span style={{ fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                      {t('record.level.not_empty', {
                        footprints: String(level.footprints), nodes: String(level.nodes),
                      })}
                    </span>
                  )}
                </div>
              ))}

              {props.levelForm !== null && props.levelForm.buildingId === building.id && (
                <LevelFields
                  form={props.levelForm}
                  complete={props.levelFormComplete}
                  onField={props.onLevelField}
                  onCreate={props.onCreateLevel}
                  onCancel={props.onCloseForms}
                />
              )}
            </div>
          </Panel>
        ))}

        {props.pendingDeletion !== null && (
          <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <StateBanner
              severity="warning"
              message={t('record.delete.confirm', { level: props.pendingDeletion.name })}
            />
            <Button rank="primary" onClick={props.onConfirmDeleteLevel}>
              {t('record.delete.action')}
            </Button>
            <Button rank="secondary" onClick={props.onCancelDeleteLevel}>
              {t('record.delete.cancel')}
            </Button>
          </div>
        )}

        <StatusBar items={status} />
      </div>
    </ScreenStates>
  );
}

function BuildingFields({ form, onField, onCreate, onCancel }: {
  readonly form: BuildingForm;
  readonly onField: (form: BuildingForm) => void;
  readonly onCreate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <Panel title={t('record.building.new')}>
      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end', flexWrap: 'wrap', padding: SPACE.md }}>
        <TextField
          label={t('record.building.name')}
          value={form.name}
          onChange={name => { onField({ ...form, name }); }}
        />
        <Toggle
          label={t('record.building.independent_access')}
          checked={form.independentAccess}
          onChange={independentAccess => { onField({ ...form, independentAccess }); }}
        />
        <NumericField
          label={t('record.building.default_edge_width')}
          unit={t('unit.metre')}
          value={form.defaultEdgeWidthM}
          step={0.01}
          min={0.01}
          onChange={defaultEdgeWidthM => { onField({ ...form, defaultEdgeWidthM }); }}
          hint={t('record.building.default_edge_width.hint')}
        />
        <Button rank="primary" onClick={onCreate} disabled={form.name.trim().length === 0}>
          {t('record.building.create')}
        </Button>
        <Button rank="secondary" onClick={onCancel}>{t('record.cancel')}</Button>
      </div>
    </Panel>
  );
}

function LevelFields({ form, complete, onField, onCreate, onCancel }: {
  readonly form: LevelForm;
  readonly complete: boolean;
  readonly onField: (form: LevelForm) => void;
  readonly onCreate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <TextField
        label={t('record.level.new_name')}
        value={form.name}
        onChange={name => { onField({ ...form, name }); }}
      />
      <NumericField
        label={t('record.level.new_ordinal')}
        unit={DIMENSIONLESS}
        value={form.ordinal}
        step={1}
        onChange={ordinal => { onField({ ...form, ordinal }); }}
        hint={t('record.level.new_ordinal.hint')}
      />
      <NumericField
        label={t('record.level.new_elevation')}
        unit={t('unit.metre')}
        value={form.elevationM}
        step={0.001}
        onChange={elevationM => { onField({ ...form, elevationM }); }}
        hint={t('record.level.new_elevation.hint')}
      />
      <Button rank="primary" onClick={onCreate} disabled={!complete}>
        {t('record.level.create')}
      </Button>
      <Button rank="secondary" onClick={onCancel}>{t('record.cancel')}</Button>
    </div>
  );
}

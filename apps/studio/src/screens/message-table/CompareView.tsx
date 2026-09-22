import { type JSX } from 'react';
import {
  SelectField, Toggle, Button, StateBanner, Tag,
  SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE,
} from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/index.js';
import { visibleDiffLines } from '@azimut/engine-graph';
import type { LineChange, LineDiff, ScheduleDiff } from '@azimut/engine-graph';
import { stableLineId } from '../../state/message-schedule-rows.js';

/**
 * R11 (partie R) — comparaison de versions.
 *
 * « Choix de deux versions. Affichage en un seul tableau, chaque ligne
 * marquée. » Un seul tableau, donc : pas deux colonnes de versions côte à
 * côte, mais une ligne par identifiant stable, et la valeur ancienne et la
 * nouvelle côte à côte pour chaque attribut qui diffère.
 *
 * « Les marques combinent symbole et libellé, jamais la couleur seule. » Le
 * symbole est un contenu, il se lit en niveaux de gris et s'annonce aux
 * technologies d'assistance par le libellé qui l'accompagne.
 */
export type CompareViewProps = {
  readonly versions: readonly number[];
  readonly referenceVersion: number;
  readonly comparedVersion: number;
  readonly onReference: (version: number) => void;
  readonly onCompared: (version: number) => void;
  /** `null` quand les deux versions choisies sont la même. */
  readonly diff: ScheduleDiff | null;
  readonly showUnchanged: boolean;
  readonly onShowUnchanged: (show: boolean) => void;
  /** Code lisible de chaque support (A5.6), pour l'identifiant de R5 (partie R). */
  readonly supportCodes: ReadonlyMap<string, string>;
  readonly langs: readonly string[];
  readonly onClose: () => void;
};

const CHANGE_LABELS: Readonly<Record<LineChange, UiMessageKey>> = {
  added: 'msgtable.change.added',
  removed: 'msgtable.change.removed',
  modified: 'msgtable.change.modified',
  unchanged: 'msgtable.change.unchanged',
};

const CHANGE_SYMBOLS: Readonly<Record<LineChange, UiMessageKey>> = {
  added: 'msgtable.change.symbol.added',
  removed: 'msgtable.change.symbol.removed',
  modified: 'msgtable.change.symbol.modified',
  unchanged: 'msgtable.change.symbol.unchanged',
};

/**
 * Les valeurs énumérées se lisent par leur libellé, comme dans les colonnes de
 * R5 (partie R) : la direction « par un symbole et un libellé », le niveau
 * d'information par son nom. Opposer `left` à `right` obligerait la maîtrise
 * d'ouvrage à traduire le modèle pour lire un écart.
 */
const VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, UiMessageKey>>>> = {
  direction: {
    left: 'msgtable.direction.left',
    right: 'msgtable.direction.right',
    ahead: 'msgtable.direction.ahead',
    up: 'msgtable.direction.up',
    down: 'msgtable.direction.down',
    back: 'msgtable.direction.back',
  },
  information_level: {
    '1': 'msgtable.level.1',
    '2': 'msgtable.level.2',
    '3': 'msgtable.level.3',
    '4': 'msgtable.level.4',
  },
};

const FIELD_LABELS: Readonly<Record<string, UiMessageKey>> = {
  destinations: 'msgtable.field.destinations',
  block_kind: 'msgtable.field.block_kind',
  pictogram_id: 'msgtable.field.pictogram_id',
  direction: 'msgtable.field.direction',
  information_level: 'msgtable.field.information_level',
  decision_point_id: 'msgtable.field.decision_point_id',
};

export function CompareView(props: CompareViewProps): JSX.Element {
  const { t } = useI18n();
  const options = props.versions.map(version => ({
    value: String(version),
    label: String(version),
  }));

  return (
    <section
      aria-label={t('msgtable.compare.title')}
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, minWidth: 0 }}
    >
      <div style={{ display: 'flex', gap: SPACE.lg, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <SelectField
          label={t('msgtable.compare.reference')}
          value={String(props.referenceVersion)}
          options={options}
          onChange={value => { props.onReference(Number(value)); }}
        />
        <SelectField
          label={t('msgtable.compare.compared')}
          value={String(props.comparedVersion)}
          options={options}
          onChange={value => { props.onCompared(Number(value)); }}
        />
        <Toggle
          label={t('msgtable.compare.show_unchanged')}
          checked={props.showUnchanged}
          onChange={props.onShowUnchanged}
        />
        <Button rank="secondary" onClick={props.onClose}>
          {t('msgtable.compare.close')}
        </Button>
      </div>

      {props.diff === null ? (
        <StateBanner severity="info" message={t('msgtable.compare.same_version')} />
      ) : (
        <DiffTable
          diff={props.diff}
          showUnchanged={props.showUnchanged}
          supportCodes={props.supportCodes}
          langs={props.langs}
        />
      )}
    </section>
  );
}

function DiffTable({ diff, showUnchanged, supportCodes, langs }: {
  readonly diff: ScheduleDiff;
  readonly showUnchanged: boolean;
  readonly supportCodes: ReadonlyMap<string, string>;
  readonly langs: readonly string[];
}): JSX.Element {
  const { t } = useI18n();
  const lines = visibleDiffLines(diff, showUnchanged);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, minWidth: 0 }}>
      <p role="status" style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>
        {t('msgtable.compare.summary', diff.counts)}
      </p>

      {lines.length === 0 ? (
        <p style={{ margin: 0, padding: SPACE.md, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
          {t('msgtable.compare.empty')}
        </p>
      ) : (
        <div style={{ overflowX: 'auto', minWidth: 0 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
            <caption style={{ ...LABEL_STYLE, textAlign: 'left', padding: '0 12px 6px' }}>
              {t('msgtable.compare.caption')}
            </caption>
            <thead>
              <tr>
                {[
                  t('msgtable.compare.column.mark'),
                  t('msgtable.column.stable_id'),
                  t('msgtable.compare.column.field'),
                  t('msgtable.compare.column.before'),
                  t('msgtable.compare.column.after'),
                ].map(header => (
                  <th key={header} scope="col" style={headerStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <DiffRows
                  key={line.id}
                  line={line}
                  supportCodes={supportCodes}
                  langs={langs}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Une ligne par attribut qui diffère, et une seule ligne pour un ajout, une
 * suppression ou une ligne inchangée, qui n'ont pas d'attribut à opposer.
 */
function DiffRows({ line, supportCodes, langs }: {
  readonly line: LineDiff;
  readonly supportCodes: ReadonlyMap<string, string>;
  readonly langs: readonly string[];
}): JSX.Element {
  const { t } = useI18n();
  const source = line.compared ?? line.reference;
  const identifier = source === null ? line.id : (stableLineId(
    supportCodes.get(source.support_id) ?? null,
    source.face_index,
    source.block_index,
  ) ?? line.id);

  if (line.changes.length === 0) {
    return (
      <tr>
        <td style={cellStyle}><Mark change={line.change} /></td>
        <td style={{ ...cellStyle, ...NUMERIC_STYLE }}>{identifier}</td>
        <td style={cellStyle} colSpan={3} />
      </tr>
    );
  }

  return (
    <>
      {line.changes.map((change, index) => (
        <tr key={change.field}>
          {index === 0 && (
            <>
              <td style={cellStyle} rowSpan={line.changes.length}>
                <Mark change={line.change} />
              </td>
              <td
                style={{ ...cellStyle, ...NUMERIC_STYLE }}
                rowSpan={line.changes.length}
              >
                {identifier}
              </td>
            </>
          )}
          <td style={cellStyle}>{fieldLabel(change.field, langs, t)}</td>
          <td style={cellStyle}><Value field={change.field} text={change.before} /></td>
          <td style={cellStyle}><Value field={change.field} text={change.after} /></td>
        </tr>
      ))}
    </>
  );
}

/** R11 : symbole **et** libellé, jamais la couleur seule. */
function Mark({ change }: { readonly change: LineChange }): JSX.Element {
  const { t } = useI18n();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs }}>
      {/*
        Le symbole n'est pas caché aux technologies d'assistance. Le cacher
        en ferait une information réservée à la vue, ce que R11 (partie R)
        refuse en voulant les deux ; et un texte visible mais masqué au
        lecteur d'écran est justement ce qu'un contrôle de contraste ne peut
        pas trancher. Sa couleur est posée et non héritée, pour qu'elle reste
        calculable sur la rangée en `text-muted` d'une ligne écartée.
      */}
      <span style={{ ...NUMERIC_STYLE, fontSize: TEXT.small, color: 'var(--text-primary)' }}>
        {t(CHANGE_SYMBOLS[change])}
      </span>
      <Tag
        label={t(CHANGE_LABELS[change])}
        severity={change === 'removed' ? 'warning' : undefined}
        muted={change === 'unchanged'}
      />
    </span>
  );
}

/** Une valeur absente est dite, jamais rendue par une cellule muette (R5, partie R). */
function Value({ field, text }: {
  readonly field: string;
  readonly text: string;
}): JSX.Element {
  const { t } = useI18n();
  if (text === '') {
    return (
      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: TEXT.micro }}>
        {t('msgtable.value.none')}
      </span>
    );
  }
  const key = VALUE_LABELS[field]?.[text];
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {key === undefined ? text : t(key)}
    </span>
  );
}

function fieldLabel(
  field: string,
  langs: readonly string[],
  t: (key: UiMessageKey, params?: Readonly<Record<string, string | number>>) => string,
): string {
  for (const lang of langs) {
    if (field === `content.${lang}`) {
      return t('msgtable.field.content', { lang: lang.toUpperCase() });
    }
  }
  const key = FIELD_LABELS[field];
  return key === undefined ? field : t(key);
}

const headerStyle: React.CSSProperties = {
  ...LABEL_STYLE,
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-strong)',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-hairline)',
  fontSize: TEXT.small,
  verticalAlign: 'top',
};

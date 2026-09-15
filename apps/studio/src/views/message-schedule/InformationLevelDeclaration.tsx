import { type JSX } from 'react';
import { INFORMATION_LEVELS } from '@azimut/engine-graph';
import type { InformationLevel, TypologyInformationLevels } from '@azimut/engine-graph';
import { useI18n } from '../../i18n/useI18n.js';
import { Panel, Note, SPACE, TEXT, LABEL_STYLE } from '../../components/ui/index.js';

type DeclarationProps = {
  readonly declarations: readonly TypologyInformationLevels[];
  readonly onChange: (next: readonly TypologyInformationLevels[]) => void;
};

function toggle(
  levels: readonly InformationLevel[],
  level: InformationLevel,
): readonly InformationLevel[] {
  return levels.includes(level)
    ? levels.filter(l => l !== level)
    : [...levels, level].sort((a, b) => a - b);
}

/**
 * H2.3 — le rattachement d'une typologie à un ou plusieurs niveaux
 * d'information est déclaré, jamais déduit d'un nom de typologie.
 *
 * Aucune colonne du modèle A5 ne le porte aujourd'hui : la déclaration vit donc
 * dans l'écran, et une typologie sans déclaration n'obtient pas un niveau par
 * défaut — elle produit WAYFIND.NO_INFORMATION_LEVEL, ce qui est le
 * comportement attendu.
 */
export function InformationLevelDeclaration(
  { declarations, onChange }: DeclarationProps,
): JSX.Element {
  const { t } = useI18n();

  function setLevels(key: string, level: InformationLevel): void {
    onChange(declarations.map(d =>
      d.support_type_key === key ? { ...d, levels: toggle(d.levels, level) } : d,
    ));
  }

  return (
    <Panel title={t('schedule.levels.title')} note={t('schedule.levels.note')}>
      <div style={{ display: 'grid', gap: SPACE.sm }}>
        {declarations.map(declaration => (
          <div
            key={declaration.support_type_key}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md }}
          >
            <span style={{
              ...LABEL_STYLE,
              minWidth: 140,
              textTransform: 'none',
              letterSpacing: 0,
              fontFamily: 'var(--font-mono)',
            }}>
              {declaration.support_type_key}
            </span>
            {INFORMATION_LEVELS.map(level => (
              <label
                key={level}
                style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, fontSize: TEXT.small }}
              >
                <input
                  type="checkbox"
                  checked={declaration.levels.includes(level)}
                  onChange={() => { setLevels(declaration.support_type_key, level); }}
                />
                {t(LEVEL_KEYS[level])}
              </label>
            ))}
          </div>
        ))}
      </div>
      <Note>{t('schedule.levels.help')}</Note>
    </Panel>
  );
}

const LEVEL_KEYS = {
  1: 'schedule.level.1',
  2: 'schedule.level.2',
  3: 'schedule.level.3',
  4: 'schedule.level.4',
} as const;

import type { Translate } from '../../i18n/index.js';
import { Tag, type Column } from '../../components/ui/index.js';

/**
 * N1.4 — état de calage niveau par niveau, tel que l'écran M2 (partie M) le
 * montre.
 *
 * Sorti de `PlanCalibrationView`, qui franchissait les quatre cents lignes
 * (A2.4) après la fusion. Il rejoint les autres pièces de l'écran de calage,
 * sous `calibration/`.
 */
export type LevelCalibrationState = {
  readonly id: string;
  readonly name: string;
  readonly sourceCount: number;
  readonly calibrated: boolean;
};

/**
 * Trois états et non deux : le libellé dit s'il reste à importer un fond ou à
 * caler celui qui est là. Le code d'anomalie est le même, la conduite à tenir
 * ne l'est pas.
 */
export function LEVEL_COLUMNS(t: Translate): readonly Column<LevelCalibrationState>[] {
  return [
    { id: 'level', header: t('calibration.levels.col.level'), cell: (row) => row.name },
    {
      id: 'sources',
      header: t('calibration.levels.col.sources'),
      numeric: true,
      cell: (row) => row.sourceCount,
    },
    {
      id: 'state',
      header: t('calibration.levels.col.state'),
      cell: (row) => {
        if (row.calibrated) {
          return <Tag label={t('calibration.levels.state.calibrated')} severity="valid" />;
        }
        return (
          <Tag
            label={row.sourceCount === 0
              ? t('calibration.levels.state.nosource')
              : t('calibration.levels.state.uncalibrated')}
            severity="blocking"
          />
        );
      },
    },
  ];
}

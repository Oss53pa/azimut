import { type JSX } from 'react';
import { SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';

/**
 * T-1.5 — la barre de niveaux de l'atelier.
 *
 * Les quatre écrans d'atelier portent sur un niveau, que leur chemin nomme :
 * `/sites/:siteId/levels/:levelId/...`. La session, elle, charge le site
 * entier et porte donc tous ses niveaux — mais rien ne les montrait, et le
 * seul moyen de passer de l'un à l'autre était de réécrire l'adresse. Un
 * bâtiment à plusieurs étages était ainsi modélisable et non parcourable.
 *
 * La maquette de M2 (partie M) porte déjà ce fil d'Ariane en tête d'écran —
 * « Azimut | Site | Niveau R+1 ». Cette barre le rend, et le rend agissant.
 *
 * Elle ne crée aucun niveau. Les niveaux d'un site viennent du dépôt, et leur
 * gestion appartient à la fiche de site, que N1.5 range parmi les écrans qui
 * « restent à spécifier ». En inventer le formulaire ici placerait dans
 * l'atelier une structure que personne n'a spécifiée.
 */
export type LevelChoice = {
  readonly id: string;
  readonly name: string;
  /** Le bâtiment qui le porte, nommé quand le site en compte plusieurs. */
  readonly buildingName: string | null;
};

export type LevelBarProps = {
  readonly levels: readonly LevelChoice[];
  readonly currentId: string;
  readonly onSelect: (levelId: string) => void;
};

export function LevelBar(props: LevelBarProps): JSX.Element | null {
  const { t } = useI18n();

  // Un site dont la session ne porte aucun niveau — un site ouvert hors ligne,
  // par exemple — n'a rien à choisir. Une barre vide dirait qu'il y a quelque
  // chose et que le chargement traîne.
  if (props.levels.length === 0) return null;

  return (
    <nav
      aria-label={t('level.bar')}
      style={{
        display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
        gap: SPACE.sm, padding: `${SPACE.xs} ${SPACE.md}`,
        borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <span style={{ fontSize: TEXT.small, color: 'var(--text-muted)' }}>
        {t('level.bar')}
      </span>
      {props.levels.map(level => {
        const current = level.id === props.currentId;
        return (
          <button
            key={level.id}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => { props.onSelect(level.id); }}
            style={{
              font: 'inherit',
              fontSize: TEXT.small,
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              // Le niveau courant se lit au trait et à l'état ARIA, jamais à
              // la seule teinte (M7.7, partie M).
              border: `1px solid ${current ? 'var(--border-strong)' : 'transparent'}`,
              background: current ? 'var(--surface-sunken)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            {level.buildingName === null
              ? level.name
              : t('level.in_building', { level: level.name, building: level.buildingName })}
          </button>
        );
      })}
    </nav>
  );
}

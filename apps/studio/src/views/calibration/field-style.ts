import { TEXT } from '../../components/ui/index.js';

/**
 * Habillage des champs de l'écran de calage, partagé par le calage à deux
 * points et par le calage mesuré : deux sections du même écran ne se
 * saisissent pas dans deux habillages différents.
 */
export const FIELD_STYLE: React.CSSProperties = {
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

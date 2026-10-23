import { type JSX, type HTMLAttributes, useMemo } from 'react';
import { validateSvg } from '@azimut/core-model';
import type { SvgProfile } from '@azimut/core-model';

type SafeSvgProps = Omit<HTMLAttributes<HTMLDivElement>, 'dangerouslySetInnerHTML' | 'children'> & {
  /** Le SVG à afficher : sortie d'un moteur, ou actif déjà reçu. */
  readonly markup: string;
  /** `render` pour une sortie de moteur, `asset` pour un fichier reçu. */
  readonly profile: SvgProfile;
};

/**
 * Lot 6 de l'audit : le seul chemin par lequel un SVG entre dans la page.
 *
 * Le SVG passe par la liste blanche (`validateSvg`) et c'est sa forme
 * reconstruite qui est injectée, jamais la chaîne reçue. Un SVG refusé n'est
 * pas affiché : l'élément reste vide, et porte le motif du refus pour qui
 * l'inspecte. Aucun autre composant n'emploie `dangerouslySetInnerHTML`.
 */
export function SafeSvg({ markup, profile, ...rest }: SafeSvgProps): JSX.Element {
  const checked = useMemo(() => validateSvg(markup, profile), [markup, profile]);
  if (!checked.ok) return <div {...rest} data-svg-refused={checked.reason} />;
  return <div {...rest} dangerouslySetInnerHTML={{ __html: checked.svg }} />;
}

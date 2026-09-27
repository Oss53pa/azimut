import { type JSX } from 'react';
import { ICON_PATHS, type IconName } from './icon-paths.js';

export { MODULE_ICONS, type IconName } from './icon-paths.js';

type IconProps = {
  readonly name: IconName;
  readonly size?: number | undefined;
};

/** Une icône de la coquille ; les tracés sont dans `icon-paths.ts`. */
export function Icon({ name, size = 18 }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {ICON_PATHS[name].map(d => <path key={d} d={d} />)}
    </svg>
  );
}

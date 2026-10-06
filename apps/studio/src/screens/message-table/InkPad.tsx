import { type JSX } from 'react';
import { useStrokeCapture } from '../../editor/ink/use-stroke-capture.js';
import type { InkNote, InkPoint } from '../../state/review-annotation.js';

/**
 * J4 (partie J) — le cadre où l'on écrit une annotation au stylet.
 *
 * Le tracé est gardé tel quel, rapporté au cadre (0 à 1) avec sa pression : une
 * note manuscrite, que rien ne reconnaît ni ne redresse (décision de
 * l'utilisateur). Le doigt n'écrit pas (G3.1), la paume est ignorée (G3.4).
 */
export const PAD_WIDTH_PX = 280;
export const PAD_HEIGHT_PX = 110;

function pathOf(stroke: readonly InkPoint[], width: number, height: number): string {
  return stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(' ');
}

/** Un tracé déjà écrit, à la taille demandée. */
export function InkNoteView({ ink, width, height, label }: {
  readonly ink: InkNote; readonly width: number; readonly height: number; readonly label: string;
}): JSX.Element {
  return (
    <svg role="img" aria-label={label} width={width} height={height}
      style={{ display: 'block', background: 'var(--surface-sunken)', borderRadius: 4 }}>
      {ink.map((stroke, i) => (
        <path key={i} d={pathOf(stroke, width, height)} fill="none"
          stroke="var(--text-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function InkPad(props: {
  readonly label: string;
  readonly ink: InkNote;
  readonly onInk: (ink: InkNote) => void;
  readonly onTouchRefused: () => void;
}): JSX.Element {
  const { handlers, live } = useStrokeCapture({
    viewWidth_px: PAD_WIDTH_PX,
    scale_px_per_m: 1,
    // Le repère du cadre, ramené de 0 à 1 : la note ne dépend pas de la taille
    // à laquelle on la relira.
    toMetres: at => ({ x_m: at.x_px / PAD_WIDTH_PX, y_m: at.y_px / PAD_HEIGHT_PX }),
    onStroke: (points, _pointer, _scale, _origin, detail) => {
      const stroke = points.map((p, i) => ({ x: p.x_m, y: p.y_m, p: detail.pressures[i] ?? 0 }));
      if (stroke.length > 0) props.onInk([...props.ink, stroke]);
    },
    onTouchRefused: props.onTouchRefused,
  });
  return (
    <svg role="img" aria-label={props.label} width={PAD_WIDTH_PX} height={PAD_HEIGHT_PX} data-testid="review-ink-pad"
      style={{ display: 'block', background: 'var(--surface-sunken)', borderRadius: 4, touchAction: 'none', cursor: 'crosshair' }}
      {...handlers}>
      {props.ink.map((stroke, i) => (
        <path key={i} d={pathOf(stroke, PAD_WIDTH_PX, PAD_HEIGHT_PX)} fill="none"
          stroke="var(--text-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {live !== null && (
        <path d={pathOf(live.map(p => ({ x: p.x_m, y: p.y_m, p: 0 })), PAD_WIDTH_PX, PAD_HEIGHT_PX)} fill="none"
          stroke="var(--text-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

import { type JSX, useState } from 'react';
import { SPACE, TEXT } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/messages.js';
import { browserStore } from '../../viewport/view-memory.js';
import { STRICTNESS_LEVELS } from './recognition-thresholds.js';
import type { Strictness } from './recognition-thresholds.js';
import { recallStrictness, rememberStrictness } from './strictness-memory.js';

const LABEL: Readonly<Record<Strictness, UiMessageKey>> = {
  strict: 'ink.strictness.strict',
  normal: 'ink.strictness.normal',
  permissive: 'ink.strictness.permissive',
};

/**
 * J1.3 — le niveau de redressement, partagé par les ateliers et retrouvé à la
 * session suivante, avec son réglage au clavier comme au pointeur (E6.2).
 */
export function useStrictness(id: string): { readonly level: Strictness; readonly control: JSX.Element } {
  const { t } = useI18n();
  const [level, setLevel] = useState<Strictness>(() => recallStrictness(browserStore()));
  const control = (
    <span style={{ display: 'inline-flex', gap: SPACE.sm, alignItems: 'center', fontSize: TEXT.small }}>
      <label htmlFor={id}>{t('ink.strictness.label')}</label>
      <select id={id} value={level} onChange={event => {
        const next = STRICTNESS_LEVELS.find(s => s === event.target.value);
        if (next === undefined) return;
        setLevel(next);
        rememberStrictness(next, browserStore());
      }}>
        {STRICTNESS_LEVELS.map(s => <option key={s} value={s}>{t(LABEL[s])}</option>)}
      </select>
    </span>
  );
  return { level, control };
}

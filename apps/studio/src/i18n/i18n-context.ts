import { createContext } from 'react';
import { UI_MESSAGES, MESSAGES_FR, type UiMessageKey } from './messages.js';

export type Translate = (
  key: UiMessageKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

export type I18nValue = {
  readonly lang: string;
  readonly setLang: (lang: string) => void;
  readonly t: Translate;
};

/** Replace `{name}` placeholders with the matching param value. */
export function interpolate(
  template: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole: string, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Build a translator bound to a language, falling back to French. */
export function makeTranslate(lang: string): Translate {
  const dict = UI_MESSAGES[lang] ?? MESSAGES_FR;
  return (key, params) => interpolate(dict[key] ?? MESSAGES_FR[key], params);
}

export const I18nContext = createContext<I18nValue>({
  lang: 'fr',
  setLang: () => {},
  t: makeTranslate('fr'),
});

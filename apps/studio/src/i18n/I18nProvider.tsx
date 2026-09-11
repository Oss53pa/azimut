import { type JSX, type ReactNode, useMemo, useState } from 'react';
import { I18nContext, makeTranslate, type I18nValue } from './i18n-context.js';

type ProviderProps = {
  readonly defaultLang?: string;
  readonly children: ReactNode;
};

export function I18nProvider(
  { defaultLang = 'fr', children }: ProviderProps,
): JSX.Element {
  const [lang, setLang] = useState(defaultLang);
  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: makeTranslate(lang) }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

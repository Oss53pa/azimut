import { useContext } from 'react';
import { I18nContext, type I18nValue } from './i18n-context.js';

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

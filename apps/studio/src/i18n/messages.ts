/**
 * D12.1 — Studio UI message catalogue.
 *
 * No interface text is written inside a component: components reference keys
 * only. Key convention: `domain.screen.element`, lowercase segments separated
 * by dots. The active-language list is site data (D12.1); the two active
 * languages are `fr` and `en`.
 *
 * The catalogue is assembled from fragments under `messages/` so that no file
 * carries the whole dictionary. Each fragment types its English table against
 * its French one, so a missing translation fails to compile there; the parity
 * test then guards the assembled tables against empty strings.
 */
import { CHROME_FR, CHROME_EN } from './messages/chrome.js';
import { VIEWS_FR, VIEWS_EN } from './messages/views.js';
import { EDITOR_FR, EDITOR_EN } from './messages/editor.js';
import { MODULES_FR, MODULES_EN } from './messages/modules.js';
import { WAYFINDING_FR, WAYFINDING_EN } from './messages/wayfinding.js';
import { FOUNDATION_FR, FOUNDATION_EN } from './messages/foundation.js';
import { COMMERCE_FR, COMMERCE_EN } from './messages/commerce.js';
import { PRODUCTION_FR, PRODUCTION_EN } from './messages/production.js';
import { DIRECTION_FR, DIRECTION_EN } from './messages/direction.js';
import { SIGNAGE_FR, SIGNAGE_EN } from './messages/signage.js';
import { CATALOGUE_FR, CATALOGUE_EN } from './messages/catalogue.js';
import { DATA_SOURCE_FR, DATA_SOURCE_EN } from './messages/data-source.js';
import { SESSION_FR, SESSION_EN } from './messages/session.js';
import { MESSAGE_TABLE_FR, MESSAGE_TABLE_EN } from './messages/message-table.js';
import { SHELL_FR, SHELL_EN } from './messages/shell.js';
import { REGISTER_FR, REGISTER_EN } from './messages/register.js';
import { WAYFINDING_REGISTER_FR, WAYFINDING_REGISTER_EN } from './messages/wayfinding-register.js';
import { FLOWS_REGISTER_FR, FLOWS_REGISTER_EN } from './messages/flows-register.js';
import { SIGNAGE_REGISTER_FR, SIGNAGE_REGISTER_EN } from './messages/signage-register.js';
import { COMMERCE_REGISTER_FR, COMMERCE_REGISTER_EN } from './messages/commerce-register.js';
import { TENANT_REGISTER_FR, TENANT_REGISTER_EN } from './messages/tenant-register.js';
import { PRODUCTION_REGISTER_FR, PRODUCTION_REGISTER_EN } from './messages/production-register.js';
import { OPERATIONS_REGISTER_FR, OPERATIONS_REGISTER_EN } from './messages/operations-register.js';
import { BUDGET_REGISTER_FR, BUDGET_REGISTER_EN } from './messages/budget-register.js';

export const MESSAGES_FR = {
  ...CHROME_FR,
  ...VIEWS_FR,
  ...EDITOR_FR,
  ...MODULES_FR,
  ...WAYFINDING_FR,
  ...FOUNDATION_FR,
  ...COMMERCE_FR,
  ...PRODUCTION_FR,
  ...DIRECTION_FR,
  ...SIGNAGE_FR,
  ...CATALOGUE_FR,
  ...DATA_SOURCE_FR,
  ...SESSION_FR,
  ...MESSAGE_TABLE_FR,
  ...SHELL_FR,
  ...REGISTER_FR,
  ...WAYFINDING_REGISTER_FR,
  ...FLOWS_REGISTER_FR,
  ...SIGNAGE_REGISTER_FR,
  ...COMMERCE_REGISTER_FR,
  ...TENANT_REGISTER_FR,
  ...PRODUCTION_REGISTER_FR,
  ...OPERATIONS_REGISTER_FR,
  ...BUDGET_REGISTER_FR,
} as const;

export type UiMessageKey = keyof typeof MESSAGES_FR;

export const MESSAGES_EN: Readonly<Record<UiMessageKey, string>> = {
  ...CHROME_EN,
  ...VIEWS_EN,
  ...EDITOR_EN,
  ...MODULES_EN,
  ...WAYFINDING_EN,
  ...FOUNDATION_EN,
  ...COMMERCE_EN,
  ...PRODUCTION_EN,
  ...DIRECTION_EN,
  ...SIGNAGE_EN,
  ...CATALOGUE_EN,
  ...DATA_SOURCE_EN,
  ...SESSION_EN,
  ...MESSAGE_TABLE_EN,
  ...SHELL_EN,
  ...REGISTER_EN,
  ...WAYFINDING_REGISTER_EN,
  ...FLOWS_REGISTER_EN,
  ...SIGNAGE_REGISTER_EN,
  ...COMMERCE_REGISTER_EN,
  ...TENANT_REGISTER_EN,
  ...PRODUCTION_REGISTER_EN,
  ...OPERATIONS_REGISTER_EN,
  ...BUDGET_REGISTER_EN,
};

export const UI_MESSAGES: Readonly<Record<string, Readonly<Record<UiMessageKey, string>>>> = {
  fr: MESSAGES_FR,
  en: MESSAGES_EN,
};

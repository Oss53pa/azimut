/**
 * E1 — Editing context enforcement.
 *
 * Three editing contexts coexist with opposite rules.
 * Confusing them is the most costly mistake (E0.2).
 *
 * Context 1: Site geometry & decoration — full vector editing.
 * Context 2: Templates — visual editing that produces data, never drawings.
 * Context 3: Support faces — NO editing. View, control, validate.
 *
 * This module enforces the permission matrix from E1.4.
 * Every editing operation must pass through `checkPermission` before
 * executing. The check never throws — it returns a Finding.
 */

import type { Finding } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type EditingContext = 'site' | 'template' | 'face';

// ---------------------------------------------------------------------------
// Operations (E1.4 table)
// ---------------------------------------------------------------------------

export type EditOperation =
  | 'draw_shape'
  | 'move_object'
  | 'resize_object'
  | 'type_text'
  | 'choose_color'
  | 'add_image'
  | 'modify_resolved_content';

// ---------------------------------------------------------------------------
// Sub-context qualifiers
// ---------------------------------------------------------------------------

type OperationQualifier = {
  /** For template context: is the target a template block/zone? */
  readonly isTemplateBlock?: boolean | undefined;
  /** For face context: is the target a `free` block? */
  readonly isFreeBlock?: boolean | undefined;
  /** For color operations: is the target a charter role (vs direct color)? */
  readonly isCharterRole?: boolean | undefined;
};

// ---------------------------------------------------------------------------
// Permission matrix (E1.4)
// ---------------------------------------------------------------------------

type PermissionRule = (
  qualifier: OperationQualifier,
) => boolean;

const SITE_RULES: Record<EditOperation, PermissionRule> = {
  draw_shape:              () => true,
  move_object:             () => true,
  resize_object:           () => true,
  type_text:               () => true,
  choose_color:            (q) => q.isCharterRole === true,
  add_image:               () => true,
  modify_resolved_content: () => false, // sans objet
};

const TEMPLATE_RULES: Record<EditOperation, PermissionRule> = {
  draw_shape:              () => false,
  move_object:             (q) => q.isTemplateBlock === true,
  resize_object:           (q) => q.isTemplateBlock === true,
  type_text:               () => false,
  choose_color:            (q) => q.isCharterRole === true,
  add_image:               () => false,
  modify_resolved_content: () => false,
};

const FACE_RULES: Record<EditOperation, PermissionRule> = {
  draw_shape:              () => false,
  move_object:             () => false,
  resize_object:           () => false,
  type_text:               (q) => q.isFreeBlock === true,
  choose_color:            () => false,
  add_image:               () => false,
  modify_resolved_content: () => false,
};

const CONTEXT_RULES: Record<EditingContext, Record<EditOperation, PermissionRule>> = {
  site: SITE_RULES,
  template: TEMPLATE_RULES,
  face: FACE_RULES,
};

const CONTEXT_LABELS: Record<EditingContext, string> = {
  site: 'géométrie du site',
  template: 'gabarit',
  face: 'face de support',
};

const OPERATION_LABELS: Record<EditOperation, string> = {
  draw_shape: 'dessiner une forme',
  move_object: 'déplacer un objet',
  resize_object: 'redimensionner un objet',
  type_text: 'saisir du texte',
  choose_color: 'choisir une couleur',
  add_image: 'ajouter une image',
  modify_resolved_content: 'modifier le contenu résolu',
};

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

/**
 * Check whether an editing operation is allowed in the given context.
 * Returns null if allowed, or a Finding with code EDIT.CONTEXT_VIOLATION.
 */
export function checkPermission(
  context: EditingContext,
  operation: EditOperation,
  qualifier: OperationQualifier = {},
): Finding | null {
  const rules = CONTEXT_RULES[context];
  const rule = rules[operation];

  if (rule(qualifier)) {
    return null;
  }

  return {
    code: 'EDIT.CONTEXT_VIOLATION',
    severity: 'blocking',
    entity: null,
    params: {
      context,
      context_label: CONTEXT_LABELS[context],
      operation,
      operation_label: OPERATION_LABELS[operation],
    },
    ruleRef: 'E1.4',
  };
}

/**
 * Convenience: returns true if the operation is allowed.
 */
export function isAllowed(
  context: EditingContext,
  operation: EditOperation,
  qualifier: OperationQualifier = {},
): boolean {
  return checkPermission(context, operation, qualifier) === null;
}

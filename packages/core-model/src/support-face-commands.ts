/**
 * A5.6 — déclarer ou modifier une face de support (`support_face`).
 *
 * Une face s'identifie par son support et son indice ; elle porte un gabarit
 * (`template_key`) et ses langues (`langs`). Le nombre de faces d'un support
 * est celui de sa typologie, et la face 0 seule sans typologie.
 *
 * Aucune suppression d'ici : `proof.face_id` part en cascade avec la face, et
 * retirer une face emporterait ses épreuves.
 *
 * Commandes du module 04, propriétaire des faces (L3). Le fichier est pur :
 * identifiants et horodatage viennent de l'appelant.
 */
import type { SiteData } from './site.js';
import type { SupportFace } from './site-signage.js';
import { supportTypologyOf } from './site-signage.js';
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import { asFormOutcome, notice, refusedBy, type FormNotice, type FormOutcome } from './form-notice.js';

/** Ce que le formulaire soumet. `template_key` nul : le gabarit de la typologie. */
export type FaceDraft = {
  readonly template_key: string | null;
  /** Vide : aucune langue déclarée sur la face. */
  readonly langs: readonly string[];
};

export type FaceEnvironment = {
  /** Tire un identifiant. Injecté : une commande ne tire pas au sort. */
  readonly newId: () => string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

const MODULE = '04-signaletique';

/**
 * Le nombre de faces d'un support : celui de sa typologie. Sans typologie, le
 * support n'offre que sa face 0.
 */
export function supportFaceCount(site: SiteData, supportId: string): number {
  const support = site.supports.find(s => s.id === supportId);
  if (support === undefined) return 0;
  return supportTypologyOf(site.support_types, support)?.face_count ?? 1;
}

/** Les langues telles qu'elles s'écrivent : dans l'ordre du site, ou nul si aucune. */
function langsValue(site: SiteData, langs: readonly string[]): string | null {
  const ordered = site.site.active_langs.filter(l => langs.includes(l));
  return ordered.length === 0 ? null : JSON.stringify(ordered);
}

/**
 * Ce que le formulaire refuse. `current` : la face modifiée, s'il y en a une.
 * Refus de saisie sans code au catalogue (D2.2, décision du 28/09/2026).
 */
export function validateFaceDraft(
  site: SiteData,
  draft: FaceDraft,
  current: SupportFace | undefined,
): readonly FormNotice[] {
  const notices: FormNotice[] = [];
  const key = draft.template_key;
  // Une valeur déjà portée par la face reste permise : les gabarits ne sont pas
  // stockés en base, et leur absence au poste ne rend pas la face fausse.
  if (key !== null && key !== current?.template_key && !site.face_templates.some(t => t.id === key)) {
    notices.push(notice('form.face.template.unknown', 'blocking', { template_key: key }));
  }
  for (const lang of draft.langs) {
    if (!(site.site.active_langs as readonly string[]).includes(lang)) {
      notices.push(notice('form.face.lang.inactive', 'blocking', { lang }));
    }
  }
  return notices;
}

/** Déclare la face `faceIndex` du support : une commande, ou les refus. */
export function declareFaceCommand(
  site: SiteData,
  supportId: string,
  faceIndex: number,
  draft: FaceDraft,
  env: FaceEnvironment,
): FormOutcome<EntityCommand> {
  const support = site.supports.find(s => s.id === supportId);
  if (support === undefined) return refusedBy([notice('form.face.support.unknown')]);
  const faces = supportFaceCount(site, supportId);
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faces) {
    return refusedBy([notice('form.face.index.out_of_range', 'blocking', { face: faceIndex, faces })]);
  }
  if (site.support_faces.some(f => f.support_id === supportId && f.face_index === faceIndex)) {
    return refusedBy([notice('form.face.already_declared', 'blocking', { face: faceIndex })]);
  }
  const notices = validateFaceDraft(site, draft, undefined);
  if (notices.length > 0) return refusedBy(notices);

  const id = env.newId();
  return asFormOutcome(buildCommand({
    operation: 'create', module: MODULE, table: 'support_face', id, org_id: support.org_id,
    after: {
      id, org_id: support.org_id, support_id: supportId, face_index: faceIndex,
      template_key: draft.template_key, langs: langsValue(site, draft.langs),
    },
    timestamp: env.timestamp, groupKey: null,
  }));
}

/** Modifie le gabarit et les langues d'une face déclarée : une commande, ou les refus. */
export function updateFaceCommand(
  site: SiteData,
  face: SupportFace,
  draft: FaceDraft,
  timestamp: string,
): FormOutcome<EntityCommand> {
  const notices = validateFaceDraft(site, draft, face);
  if (notices.length > 0) return refusedBy(notices);
  const before: RowValues = {
    template_key: face.template_key ?? null,
    langs: face.langs === undefined || face.langs.length === 0 ? null : JSON.stringify(face.langs),
  };
  return asFormOutcome(buildCommand({
    operation: 'update', module: MODULE, table: 'support_face', id: face.id, org_id: face.org_id,
    before,
    after: { template_key: draft.template_key, langs: langsValue(site, draft.langs) },
    timestamp, groupKey: null,
  }));
}

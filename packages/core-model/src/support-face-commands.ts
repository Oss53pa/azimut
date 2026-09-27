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
import type { Finding, Outcome } from './outcome.js';

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

const RULE_REF = 'A5.6';
const MODULE = '04-signaletique';

function refusal(code: string, id: string, params: Record<string, string | number> = {}): Finding {
  return { code, severity: 'blocking', entity: { kind: 'support', id }, params, ruleRef: RULE_REF };
}

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

/** Ce que le formulaire refuse. `current` : la face modifiée, s'il y en a une. */
export function validateFaceDraft(
  site: SiteData,
  supportId: string,
  draft: FaceDraft,
  current: SupportFace | undefined,
): readonly Finding[] {
  const findings: Finding[] = [];
  const key = draft.template_key;
  // Une valeur déjà portée par la face reste permise : les gabarits ne sont pas
  // stockés en base, et leur absence au poste ne rend pas la face fausse.
  if (key !== null && key !== current?.template_key && !site.face_templates.some(t => t.id === key)) {
    findings.push(refusal('LAYOUT.FACE_TEMPLATE_UNKNOWN', supportId, { template_key: key }));
  }
  for (const lang of draft.langs) {
    if (!(site.site.active_langs as readonly string[]).includes(lang)) {
      findings.push(refusal('LAYOUT.FACE_LANG_INACTIVE', supportId, { lang }));
    }
  }
  return findings;
}

/** Déclare la face `faceIndex` du support : une commande, ou les refus. */
export function declareFaceCommand(
  site: SiteData,
  supportId: string,
  faceIndex: number,
  draft: FaceDraft,
  env: FaceEnvironment,
): Outcome<EntityCommand> {
  const support = site.supports.find(s => s.id === supportId);
  if (support === undefined) {
    return { ok: false, findings: [refusal('LAYOUT.FACE_SUPPORT_UNKNOWN', supportId)] };
  }
  const faces = supportFaceCount(site, supportId);
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faces) {
    return { ok: false, findings: [refusal('LAYOUT.FACE_INDEX_OUT_OF_RANGE', supportId, { face: faceIndex, faces })] };
  }
  if (site.support_faces.some(f => f.support_id === supportId && f.face_index === faceIndex)) {
    return { ok: false, findings: [refusal('LAYOUT.FACE_ALREADY_DECLARED', supportId, { face: faceIndex })] };
  }
  const findings = validateFaceDraft(site, supportId, draft, undefined);
  if (findings.length > 0) return { ok: false, findings: [...findings] };

  const id = env.newId();
  return buildCommand({
    operation: 'create', module: MODULE, table: 'support_face', id, org_id: support.org_id,
    after: {
      id, org_id: support.org_id, support_id: supportId, face_index: faceIndex,
      template_key: draft.template_key, langs: langsValue(site, draft.langs),
    },
    timestamp: env.timestamp, groupKey: null,
  });
}

/** Modifie le gabarit et les langues d'une face déclarée : une commande, ou les refus. */
export function updateFaceCommand(
  site: SiteData,
  face: SupportFace,
  draft: FaceDraft,
  timestamp: string,
): Outcome<EntityCommand> {
  const findings = validateFaceDraft(site, face.support_id, draft, face);
  if (findings.length > 0) return { ok: false, findings: [...findings] };
  const before: RowValues = {
    template_key: face.template_key ?? null,
    langs: face.langs === undefined || face.langs.length === 0 ? null : JSON.stringify(face.langs),
  };
  return buildCommand({
    operation: 'update', module: MODULE, table: 'support_face', id: face.id, org_id: face.org_id,
    before,
    after: { template_key: draft.template_key, langs: langsValue(site, draft.langs) },
    timestamp, groupKey: null,
  });
}

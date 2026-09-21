import type { Finding } from '@azimut/core-model';
import { guardCreativeAgainstSpec, type Creative, type CreativeSpec } from './ad-creative-control.js';
import { sanitizeSvg, DEFAULT_SANITIZE_CONFIG, type SanitizeConfig } from './asset-sanitizer.js';

/**
 * N5.2 — réception d'un visuel d'annonceur, règles R5 et R6.
 *
 * R5 : « Tout visuel reçu est assaini avant stockage, selon les règles d'import
 * d'actifs déjà posées. Un visuel non assaini n'est jamais rendu. »
 * R6 : les contrôles techniques sont automatiques.
 *
 * Les deux sont ici dans cet ordre, et l'ordre porte du sens : on assainit
 * avant de stocker, donc avant tout le reste. Un visuel dont l'assainissement
 * échoue ne reçoit pas de contrôle technique — le contrôler reviendrait à
 * traiter comme un document un fichier qu'on vient de déclarer dangereux.
 *
 * Deux axes, jamais confondus. L'assainissement dit si le visuel peut être
 * rendu ; la fiche technique dit s'il est conforme. Un visuel propre et non
 * conforme se regarde et se refuse ; un visuel non assaini ne se regarde pas.
 */

/** Ce qui a été reçu de l'annonceur. */
export type CreativePayload =
  /** Un SVG, dont la source est assainissable ici. */
  | { readonly kind: 'svg'; readonly source: string }
  /**
   * Un format binaire — PDF, PNG. L'assainissement fait autorité côté serveur,
   * en environnement isolé (E14.1) ; le navigateur ne peut pas le prononcer.
   */
  | { readonly kind: 'binary' };

export const SANITATION_STATES = [
  /** Assaini ici, et propre. */
  'clean',
  /** Assainissement refusé : le visuel ne sera jamais rendu. */
  'failed',
  /** Assainissement remis au serveur, qui seul fait autorité. */
  'deferred',
] as const;

export type SanitationState = (typeof SANITATION_STATES)[number];

export type CreativeIntake = {
  readonly creative_id: string;
  readonly sanitation: SanitationState;
  /**
   * R5 (partie N) — un visuel non assaini n'est jamais rendu. Vrai du seul état `clean` :
   * `deferred` n'est pas « propre en attendant », c'est « pas encore assaini ».
   */
  readonly renderable: boolean;
  /** Le SVG assaini, quand il l'a été ici. Absent sinon. */
  readonly clean_svg?: string;
  /** Assainissement puis fiche technique, dans cet ordre. */
  readonly findings: readonly Finding[];
};

export type CreativeReception = {
  readonly creative: Creative;
  readonly payload: CreativePayload;
};

/**
 * Passe un visuel reçu par l'assainissement puis par sa fiche technique.
 *
 * Le résultat n'est pas un `Outcome` : la réception aboutit toujours à un
 * constat, même quand elle refuse. Ce que l'écran doit montrer, c'est l'état
 * du visuel et ce qui lui est reproché, pas une absence de valeur.
 */
export function receiveCreative(
  reception: CreativeReception,
  spec: CreativeSpec,
  config: SanitizeConfig = DEFAULT_SANITIZE_CONFIG,
): CreativeIntake {
  const { creative, payload } = reception;

  if (payload.kind === 'svg') {
    const sanitized = sanitizeSvg(payload.source, config);
    if (!sanitized.ok) {
      return {
        creative_id: creative.id,
        sanitation: 'failed',
        renderable: false,
        findings: [withEntity(sanitized.finding, creative.id)],
      };
    }
    return {
      creative_id: creative.id,
      sanitation: 'clean',
      renderable: true,
      clean_svg: sanitized.cleanSvg,
      findings: [
        ...sanitized.warnings.map(f => withEntity(f, creative.id)),
        ...specFindings(creative, spec),
      ],
    };
  }

  return {
    creative_id: creative.id,
    sanitation: 'deferred',
    renderable: false,
    findings: specFindings(creative, spec),
  };
}

/** Les mêmes, dans l'ordre reçu. L'appelant indexe par identifiant. */
export function receiveCreatives(
  receptions: readonly CreativeReception[],
  spec: CreativeSpec,
  config: SanitizeConfig = DEFAULT_SANITIZE_CONFIG,
): readonly CreativeIntake[] {
  return receptions.map(reception => receiveCreative(reception, spec, config));
}

function specFindings(creative: Creative, spec: CreativeSpec): readonly Finding[] {
  const result = guardCreativeAgainstSpec(creative, spec);
  return result.ok ? [] : result.findings;
}

/**
 * L'assainisseur ne connaît pas les visuels : il rend des anomalies sans
 * entité. Les rattacher ici évite qu'une anomalie de réception flotte sans
 * dire de quel visuel elle parle.
 */
function withEntity(finding: Finding, creativeId: string): Finding {
  return finding.entity !== null
    ? finding
    : { ...finding, entity: { kind: 'creative', id: creativeId } };
}

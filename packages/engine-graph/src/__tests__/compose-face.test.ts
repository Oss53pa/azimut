import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type {
  ContentBlockDef,
  ContentBlockKind,
  FaceTemplate,
  SiteData,
  TravelProfile,
} from '@azimut/core-model';
import { resolveFaceContent } from '../resolve-face.js';
import { renderFace } from '../render-face.js';
import type { FaceTheme } from '../render-face.js';
import { composeFace, faceIndexForSide, resolveFaceFromSchedule } from '../compose-face.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';
import { NO_WAYFINDING_RULES } from '../message-schedule.js';
import type { MessageSchedule } from '../message-schedule.js';

const SITE = refMultilevel;
const NODE = 'n-ml-hall';
const SUPPORT = 'sup-1';
const AT = '2026-04-01T00:00:00.000Z';

function profile(): TravelProfile {
  const found = SITE.travel_profiles.find(p => p.key === 'standard');
  if (found === undefined) throw new Error('profil standard absent');
  return found;
}

function refTemplate(): FaceTemplate {
  const tpl = SITE.face_templates.find(
    t => t.support_type_key === 'directional' && t.side === 'front',
  );
  if (tpl === undefined) throw new Error('gabarit de référence absent');
  return tpl;
}

/** Gabarit d'un seul bloc, pour couvrir chaque nature de bloc. */
function singleBlock(kind: ContentBlockKind, config: Record<string, unknown> = {}): FaceTemplate {
  const block: ContentBlockDef = {
    kind,
    ordinal: 1,
    region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
    config,
  };
  return { ...refTemplate(), blocks: [block] };
}

function scheduleFor(template: FaceTemplate, site: SiteData = SITE): MessageSchedule {
  const outcome = generateMessageSchedule({
    site: { ...site, face_templates: [template] },
    supports: [{ id: SUPPORT, node_id: NODE, support_type_key: 'directional' }],
    profile: profile(),
    informationLevels: [{ support_type_key: 'directional', levels: [2] }],
    rules: NO_WAYFINDING_RULES,
    version: 1,
    generated_at: AT,
  });
  if (!outcome.ok) throw new Error('génération échouée');
  return outcome.value;
}

function compose(template: FaceTemplate, site: SiteData = SITE) {
  return composeFace({
    site: { ...site, face_templates: [template] },
    template,
    profile: profile(),
    supportId: SUPPORT,
    nodeId: NODE,
    generated_at: AT,
  });
}

// ---------------------------------------------------------------------------
// Repérage de face
// ---------------------------------------------------------------------------

describe('H2.5 — repérage de la face', () => {
  it('trouve l’indice du côté déclaré', () => {
    const type = SITE.support_types.find(t => t.key === 'directional');
    if (type === undefined) throw new Error('typologie absente');
    expect(faceIndexForSide(type, 'front')).toBe(0);
  });

  it('ne trouve rien pour un côté absent', () => {
    const type = SITE.support_types.find(t => t.key === 'directional');
    if (type === undefined) throw new Error('typologie absente');
    expect(faceIndexForSide(type, 'back')).toBeNull();
  });

  it('trie les faces comme la génération, pour que les indices coïncident', () => {
    const type = {
      id: 't', org_id: 'o', key: 'k', name: 'k', face_count: 3,
      faces: [
        { side: 'right', default_width_mm: 1, default_height_mm: 1 },
        { side: 'front', default_width_mm: 1, default_height_mm: 1 },
        { side: 'left', default_width_mm: 1, default_height_mm: 1 },
      ],
    };
    expect(faceIndexForSide(type, 'front')).toBe(0);
    expect(faceIndexForSide(type, 'left')).toBe(1);
    expect(faceIndexForSide(type, 'right')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Équivalence : la bascule ne doit rien changer au rendu
// ---------------------------------------------------------------------------

const ALL_KINDS: readonly ContentBlockKind[] = [
  'header', 'destination_list', 'pictogram', 'arrow',
  'map', 'legend', 'free_text', 'logo', 'emergency_info',
];

describe('H2.5 — la composition via le tableau est équivalente à la résolution directe', () => {
  it('produit la même face sur le gabarit de référence', () => {
    const template = refTemplate();
    const direct = resolveFaceContent(SITE, template, NODE, profile());
    const viaSchedule = compose(template);

    expect(direct.ok).toBe(true);
    expect(viaSchedule.ok).toBe(true);
    if (!direct.ok || !viaSchedule.ok) return;
    expect(viaSchedule.value).toEqual(direct.value);
  });

  for (const kind of ALL_KINDS) {
    it(`produit la même face pour un bloc « ${kind} »`, () => {
      const config = kind === 'pictogram'
        ? { category_id: 'cat-office' }
        : kind === 'free_text'
          ? { text: 'Bienvenue' }
          : kind === 'arrow'
            ? { direction: 'left' }
            : {};
      const template = singleBlock(kind, config);

      const direct = resolveFaceContent(SITE, template, NODE, profile());
      const viaSchedule = compose(template);

      expect(direct.ok).toBe(true);
      expect(viaSchedule.ok).toBe(true);
      if (!direct.ok || !viaSchedule.ok) return;
      expect(viaSchedule.value).toEqual(direct.value);
    });
  }

  it('produit le même SVG, donc le même livrable', () => {
    const template = refTemplate();
    const theme: FaceTheme = {
      background: 'tok-bg',
      text_primary: 'tok-fg',
      text_secondary: 'tok-fg2',
      accent: 'tok-accent',
      border: 'tok-border',
    };
    const opts = { width_mm: 600, height_mm: 400, theme, font_family: 'X' };

    const direct = resolveFaceContent(SITE, template, NODE, profile());
    const viaSchedule = compose(template);
    if (!direct.ok || !viaSchedule.ok) throw new Error('résolution échouée');

    expect(renderFace(viaSchedule.value, opts)).toBe(renderFace(direct.value, opts));
  });

  it('conserve les avertissements que la résolution produit', () => {
    // Une destination rattachée à un nœud absent du graphe fait remonter
    // un avertissement, que la bascule ne doit pas avaler.
    const broken: SiteData = {
      ...SITE,
      destinations: SITE.destinations.map((d, i) =>
        i === 0 ? { ...d, node_id: 'n-inexistant' } : d,
      ),
    };
    const template = refTemplate();
    const direct = resolveFaceContent(broken, template, NODE, profile());
    const viaSchedule = compose(template, broken);

    if (!direct.ok || !viaSchedule.ok) throw new Error('résolution échouée');
    expect(direct.warnings.length).toBeGreaterThan(0);
    expect(viaSchedule.warnings.map(w => w.code))
      .toEqual(expect.arrayContaining(direct.warnings.map(w => w.code)));
  });

  it('est déterministe (invariant 4)', () => {
    const template = refTemplate();
    const a = compose(template);
    const b = compose(template);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Lecture depuis un tableau fourni
// ---------------------------------------------------------------------------

describe('H2.5 — lecture depuis un tableau fourni', () => {
  it('consomme un tableau déjà généré sans en refaire un', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const read = resolveFaceFromSchedule({
      schedule,
      template,
      supportId: SUPPORT,
      faceIndex: 0,
      pictograms: SITE.pictograms,
    });
    const direct = resolveFaceContent(SITE, template, NODE, profile());
    if (!read.ok || !direct.ok) throw new Error('résolution échouée');
    expect(read.value).toEqual(direct.value);
  });

  it('accepte un tableau passé à composeFace', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const composed = composeFace({
      site: { ...SITE, face_templates: [template] },
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
      schedule,
    });
    expect(composed.ok).toBe(true);
  });

  it('refuse de composer quand une ligne manque', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const firstLine = schedule.lines[0];
    if (firstLine === undefined) throw new Error('tableau vide');
    const truncated: MessageSchedule = { ...schedule, lines: [firstLine] };
    const read = resolveFaceFromSchedule({
      schedule: truncated,
      template,
      supportId: SUPPORT,
      faceIndex: 0,
      pictograms: SITE.pictograms,
    });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.findings.map(f => f.code)).toContain('WAYFIND.LINE_MISSING');
  });

  it('signale une ligne périmée sans refuser la composition', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const stale: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({ ...l, stale: true })),
    };
    const read = resolveFaceFromSchedule({
      schedule: stale,
      template,
      supportId: SUPPORT,
      faceIndex: 0,
      pictograms: SITE.pictograms,
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.warnings.map(w => w.code)).toContain('WAYFIND.SCHEDULE_STALE');
  });

  it('ignore les lignes d’un autre support', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const foreign: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({ ...l, support_id: 'sup-autre' })),
    };
    const read = resolveFaceFromSchedule({
      schedule: foreign,
      template,
      supportId: SUPPORT,
      faceIndex: 0,
      pictograms: SITE.pictograms,
    });
    expect(read.ok).toBe(false);
  });

  it('ignore les lignes d’une autre face', () => {
    const template = refTemplate();
    const schedule = scheduleFor(template);
    const otherFace: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({ ...l, face_index: 3 })),
    };
    const read = resolveFaceFromSchedule({
      schedule: otherFace,
      template,
      supportId: SUPPORT,
      faceIndex: 0,
      pictograms: SITE.pictograms,
    });
    expect(read.ok).toBe(false);
  });
});

describe('H2.5 — tolérance à la génération, refus face à un tableau enregistré', () => {
  it('compose malgré une typologie non déclarée, comme avant la bascule', () => {
    // Le catalogue classe une face absente de la typologie en
    // avertissement, pas en refus. La bascule ne durcit pas cette
    // position : la composition reste possible.
    const template: FaceTemplate = { ...refTemplate(), support_type_key: 'inexistante' };
    const composed = composeFace({
      site: { ...SITE, face_templates: [template] },
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
    });
    expect(composed.ok).toBe(true);
  });

  it('compose malgré un côté absent de la typologie', () => {
    const template: FaceTemplate = { ...refTemplate(), side: 'back' };
    const composed = composeFace({
      site: { ...SITE, face_templates: [template] },
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
    });
    expect(composed.ok).toBe(true);
  });

  it('produit la même face qu’une résolution directe sur un côté non déclaré', () => {
    const template: FaceTemplate = { ...refTemplate(), side: 'back' };
    const direct = resolveFaceContent(SITE, template, NODE, profile());
    const viaSchedule = composeFace({
      site: { ...SITE, face_templates: [template] },
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
    });
    if (!direct.ok || !viaSchedule.ok) throw new Error('résolution échouée');
    expect(viaSchedule.value).toEqual(direct.value);
  });

  it('remonte la cause réelle plutôt que « ligne absente »', () => {
    const template = refTemplate();
    const composed = composeFace({
      site: { ...SITE, face_templates: [template] },
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: 'n-inexistant',
      generated_at: AT,
    });
    expect(composed.ok).toBe(false);
    if (composed.ok) return;
    const codes = composed.findings.map(f => f.code);
    expect(codes).toContain('GRAPH.RESOLVE_NODE_NOT_FOUND');
    expect(codes).not.toContain('WAYFIND.LINE_MISSING');
  });

  it('refuse une typologie inconnue quand un tableau est fourni', () => {
    const template: FaceTemplate = { ...refTemplate(), support_type_key: 'inexistante' };
    const composed = composeFace({
      site: SITE,
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
      schedule: scheduleFor(refTemplate()),
    });
    expect(composed.ok).toBe(false);
    if (composed.ok) return;
    expect(composed.findings.map(f => f.code)).toContain('WAYFIND.SUPPORT_TYPE_UNKNOWN');
  });

  it('refuse un côté absent quand un tableau est fourni', () => {
    const template: FaceTemplate = { ...refTemplate(), side: 'back' };
    const composed = composeFace({
      site: SITE,
      template,
      profile: profile(),
      supportId: SUPPORT,
      nodeId: NODE,
      generated_at: AT,
      schedule: scheduleFor(refTemplate()),
    });
    expect(composed.ok).toBe(false);
    if (composed.ok) return;
    expect(composed.findings.map(f => f.code)).toContain('WAYFIND.FACE_TEMPLATE_MISSING');
  });
});

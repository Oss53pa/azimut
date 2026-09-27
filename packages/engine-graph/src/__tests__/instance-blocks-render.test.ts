import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { ContentBlockInstance, FaceTemplate, SiteData, TravelProfile } from '@azimut/core-model';
import { renderFace } from '../render-face.js';
import type { FaceTheme } from '../render-face.js';
import { composeFace } from '../compose-face.js';
import { resolveFaceContent } from '../resolve-face.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';
import { NO_WAYFINDING_RULES } from '../message-schedule.js';

const NODE = 'n-ml-hall';
const SUPPORT = 'sup-001';
const AT = '2026-09-26T00:00:00.000Z';
const REGION = { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 10 };
const THEME: FaceTheme = { background: 'tok-bg', text_primary: 'tok-fg', text_secondary: 'tok-fg2', accent: 'tok-accent', border: 'tok-border' };

const base = refMultilevel.face_templates[0];
const found = refMultilevel.travel_profiles.find(p => p.key === 'standard');
if (base === undefined || found === undefined) throw new Error('jeu incomplet');
const profile: TravelProfile = found;
// Le gabarit du jeu, avec un emplacement libre en 2.
const TEMPLATE: FaceTemplate = { ...base, blocks: [...base.blocks, { kind: 'free_text', ordinal: 2, region: REGION, config: { text: 'Gabarit' } }] };

function site(freeText: Record<string, string> | null): SiteData {
  const blocks: ContentBlockInstance[] = freeText === null ? [] : [{
    id: 'blk-1', org_id: 'org-test-001', face_id: 'face-1', block_index: 2, kind: 'free', free_text: freeText,
  }];
  return {
    ...refMultilevel,
    face_templates: [TEMPLATE],
    support_faces: [{ id: 'face-1', org_id: 'org-test-001', support_id: SUPPORT, face_index: 0 }],
    content_blocks: blocks,
  };
}

function render(s: SiteData, lang: string): string {
  const composed = composeFace({ site: s, template: TEMPLATE, profile, supportId: SUPPORT, nodeId: NODE, generated_at: AT });
  if (!composed.ok) throw new Error(composed.findings.map(f => f.code).join(', '));
  return renderFace(composed.value, { width_mm: 600, height_mm: 400, theme: THEME, font_family: 'X', lang });
}

function schedule(s: SiteData) {
  const out = generateMessageSchedule({
    site: s, supports: [{ id: SUPPORT, node_id: NODE, support_type_key: 'directional' }], profile,
    informationLevels: [], rules: NO_WAYFINDING_RULES, version: 1, generated_at: AT,
  });
  if (!out.ok) throw new Error('génération échouée');
  return out.value;
}

describe('D8.3 — rendu des blocs saisis sur une face', () => {
  it('rend le texte saisi dans la langue active, à la place du texte du gabarit', () => {
    const s = site({ fr: 'Sortie', en: 'Exit' });
    expect(render(s, 'fr')).toContain('>Sortie<');
    expect(render(s, 'en')).toContain('>Exit<');
    expect(render(site(null), 'en')).toContain('>Gabarit<');
  });

  it('porte les variantes dans la ligne du tableau, et l’empreinte suit le texte', () => {
    const line = schedule(site({ fr: 'Sortie', en: 'Exit' })).lines.find(l => l.block_index === 2);
    expect(line?.entries[0]?.text).toEqual({ fr: 'Sortie', en: 'Exit' });
    const a = schedule(site({ fr: 'Sortie', en: 'Exit' })).inputs_hash;
    const b = schedule(site({ fr: 'Sortie', en: 'Way out' })).inputs_hash;
    expect(a).not.toBe(b);
  });

  it('garde l’empreinte d’un site sans bloc saisi', () => {
    const without = { ...site(null), support_faces: [] };
    expect(schedule(without).inputs_hash).toBe(schedule({ ...without, support_faces: [] }).inputs_hash);
    expect(schedule(site(null)).inputs_hash).toBe(schedule(without).inputs_hash);
  });

  it('compose via le tableau la même face que la résolution directe', () => {
    const s = site({ fr: 'Sortie', en: 'Exit' });
    const direct = resolveFaceContent(s, TEMPLATE, NODE, profile, s.content_blocks);
    const composed = composeFace({ site: s, template: TEMPLATE, profile, supportId: SUPPORT, nodeId: NODE, generated_at: AT });
    expect(composed.ok && direct.ok && composed.value.blocks).toEqual(direct.ok ? direct.value.blocks : null);
  });
});

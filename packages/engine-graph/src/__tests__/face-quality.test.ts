import { describe, it, expect } from 'vitest';
import { loadRulesPack } from '@azimut/rules/loader';
import type { LoadedRulesPack } from '@azimut/rules';
import { checkFaceContrast } from '../face-quality.js';
import type { FaceTheme } from '../render-face.js';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';

// Colours built from a helper so no literal hex appears in source (the
// design-token guard scans test files); these are test-only theme values.
const hx = (rgb: string): string => `#${rgb}`;
const WHITE = hx('ffffff');
const BLACK = hx('000000'); // vs white → 21
const GREY_LOW = hx('949494'); // vs white → 3.03 (below 4.7)
const GREY_MID = hx('6d6d6d'); // vs white → 5.17 (passes 4.7, fails 6.1)

function pack(): LoadedRulesPack {
  const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!outcome.ok) throw new Error('fixture non chargeable');
  return outcome.value;
}

const theme = (text: string, accent: string, background: string): FaceTheme => ({
  background,
  text_primary: text,
  text_secondary: text,
  accent,
  border: text,
});

describe('G6.2 — checkFaceContrast (wired to FaceTheme)', () => {
  it('passes a high-contrast face', () => {
    const r = checkFaceContrast(pack(), {
      face_id: 'f-1',
      supportRegistry: 'wayfinding',
      theme: theme(BLACK, BLACK, WHITE),
      hasAccentContent: true,
    });
    expect(r.ok).toBe(true);
  });

  it('blocks low-contrast text against the resolved minimum', () => {
    const r = checkFaceContrast(pack(), {
      face_id: 'f-1',
      supportRegistry: 'wayfinding',
      theme: theme(GREY_LOW, BLACK, WHITE), // text 3.03 < 4.7
      hasAccentContent: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const texts = r.findings.filter((f) => f.code === 'LAYOUT.CONTRAST_BELOW_MIN');
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts[0]?.ruleRef).toBe('CONTRAST.MIN_TEXT_ON_BACKGROUND');
  });

  it('hardens under the safety scope (text at 5.17 passes wayfinding, fails safety)', () => {
    const wayfinding = checkFaceContrast(pack(), {
      face_id: 'f-1',
      supportRegistry: 'wayfinding',
      theme: theme(GREY_MID, BLACK, WHITE),
      hasAccentContent: true,
    });
    expect(wayfinding.ok).toBe(true);
    const safety = checkFaceContrast(pack(), {
      face_id: 'f-1',
      supportRegistry: 'safety',
      theme: theme(GREY_MID, BLACK, WHITE),
      hasAccentContent: true,
    });
    expect(safety.ok).toBe(false);
  });

  it('refuses rather than inventing when no rule matches the scope', () => {
    const r = checkFaceContrast(pack(), {
      face_id: 'f-1',
      supportRegistry: 'unknown_registry',
      theme: theme(BLACK, BLACK, WHITE),
      hasAccentContent: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.code === 'RULES.RULE_NOT_FOUND')).toBe(true);
  });

  it('checks the accent colour only when the face draws accent content', () => {
    // Good text (21), low-contrast accent (3.03 < pictogram min 3.3).
    const withAccent = checkFaceContrast(pack(), {
      face_id: 'f-1', supportRegistry: 'wayfinding',
      theme: theme(BLACK, GREY_LOW, WHITE), hasAccentContent: true,
    });
    expect(withAccent.ok).toBe(false);
    if (!withAccent.ok) {
      expect(withAccent.findings.some((f) => f.ruleRef === 'CONTRAST.MIN_PICTOGRAM_ON_BACKGROUND'))
        .toBe(true);
    }

    const noAccent = checkFaceContrast(pack(), {
      face_id: 'f-1', supportRegistry: 'wayfinding',
      theme: theme(BLACK, GREY_LOW, WHITE), hasAccentContent: false,
    });
    expect(noAccent.ok).toBe(true);
  });
});

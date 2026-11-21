import { describe, it, expect } from 'vitest';
import { totpNow } from '../totp.js';

/** RFC 6238, annexe B : le secret « 12345678901234567890 » en base 32, SHA-1. */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('le code TOTP des essais', () => {
  it('rend les valeurs de l’annexe B de la RFC 6238, sur six chiffres', () => {
    expect(totpNow(RFC_SECRET, 59_000)).toBe('287082');
    expect(totpNow(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totpNow(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
  });
});

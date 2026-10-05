import { describe, it, expect } from 'vitest';
import { DEFAULT_STRICTNESS, recallStrictness, rememberStrictness } from '../strictness-memory.js';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

describe('J1.3 — le niveau de redressement mémorisé', () => {
  it('se retrouve d’une session à l’autre', () => {
    const store = memoryStore();
    expect(recallStrictness(store)).toBe(DEFAULT_STRICTNESS);
    rememberStrictness('permissive', store);
    expect(recallStrictness(store)).toBe('permissive');
  });

  it('une valeur inconnue ou un stockage refusé ramènent au niveau intermédiaire', () => {
    const store = memoryStore();
    store.setItem('azimut.redressement', 'laxiste');
    expect(recallStrictness(store)).toBe('normal');
    const refusing = {
      getItem: (): string | null => { throw new Error('refusé'); },
      setItem: (): void => { throw new Error('refusé'); },
    };
    expect(recallStrictness(refusing)).toBe('normal');
    expect(() => { rememberStrictness('strict', refusing); }).not.toThrow();
    expect(recallStrictness(null)).toBe('normal');
  });
});

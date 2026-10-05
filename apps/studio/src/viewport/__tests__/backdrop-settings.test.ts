import { describe, it, expect } from 'vitest';
import { DEFAULT_BACKDROP, recallBackdrop, rememberBackdrop } from '../backdrop-settings.js';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

describe('J1.4 — les réglages du fond de décalque', () => {
  it('se retrouvent par zone et par niveau', () => {
    const store = memoryStore();
    rememberBackdrop('empreintes:n1', { opacity: 0.3, showShapes: false }, store);
    expect(recallBackdrop('empreintes:n1', store)).toEqual({ opacity: 0.3, showShapes: false });
    expect(recallBackdrop('empreintes:n2', store)).toEqual(DEFAULT_BACKDROP);
  });

  it('une valeur illisible ou hors bornes est ignorée, champ par champ', () => {
    const store = memoryStore();
    store.setItem('azimut.fond.a', '{pas du json');
    store.setItem('azimut.fond.b', JSON.stringify({ opacity: 3, showShapes: false }));
    expect(recallBackdrop('a', store)).toEqual(DEFAULT_BACKDROP);
    expect(recallBackdrop('b', store)).toEqual({ opacity: DEFAULT_BACKDROP.opacity, showShapes: false });
  });

  it('un stockage absent ou refusé ne casse rien', () => {
    const refusing = {
      getItem: (): string | null => { throw new Error('refusé'); },
      setItem: (): void => { throw new Error('refusé'); },
    };
    expect(recallBackdrop('a', null)).toEqual(DEFAULT_BACKDROP);
    expect(recallBackdrop('a', refusing)).toEqual(DEFAULT_BACKDROP);
    expect(() => { rememberBackdrop('a', DEFAULT_BACKDROP, refusing); }).not.toThrow();
  });
});

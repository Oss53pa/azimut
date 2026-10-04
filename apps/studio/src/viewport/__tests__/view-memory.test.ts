import { describe, it, expect } from 'vitest';
import { forgetView, recallView, rememberView } from '../view-memory.js';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
}

const view = { centerX_m: 12.5, centerY_m: -3, scale_px_per_m: 40, rotationDeg: 0 };

describe('E3.3 — la position de vue, mémorisée par niveau, hors du modèle', () => {
  it('se retrouve telle qu’elle a été laissée, pour le même niveau seulement', () => {
    const store = memoryStore();
    rememberView('empreintes:niv-1', view, store);
    expect(recallView('empreintes:niv-1', store)).toEqual(view);
    expect(recallView('empreintes:niv-2', store)).toBeNull();
  });

  it('une valeur illisible ou hors bornes est ignorée', () => {
    const store = memoryStore();
    store.setItem('azimut.vue.a', 'pas du json');
    store.setItem('azimut.vue.b', JSON.stringify({ centerX_m: 0, centerY_m: 0, scale_px_per_m: 9000 }));
    store.setItem('azimut.vue.c', JSON.stringify({ centerX_m: 'x', centerY_m: 0, scale_px_per_m: 10 }));
    expect(recallView('a', store)).toBeNull();
    expect(recallView('b', store)).toBeNull();
    expect(recallView('c', store)).toBeNull();
  });

  it('s’oublie au recadrage, et un stockage absent ne casse rien', () => {
    const store = memoryStore();
    rememberView('k', view, store);
    forgetView('k', store);
    expect(recallView('k', store)).toBeNull();
    expect(recallView('k', null)).toBeNull();
    expect(() => { rememberView('k', view, null); forgetView('k', null); }).not.toThrow();
  });

  it('un stockage qui refuse l’écriture ne lève rien', () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error('plein'); }, removeItem: () => { throw new Error('refusé'); } };
    expect(() => { rememberView('k', view, refusing); forgetView('k', refusing); }).not.toThrow();
  });
});

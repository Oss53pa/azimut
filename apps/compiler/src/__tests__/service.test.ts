import { describe, it, expect } from 'vitest';
import { kioskPackagePath, readServiceConfig } from '../service.js';

const COMPLETE = {
  AZIMUT_COMPILER_DATABASE_URL: 'postgres://service@base/azimut',
  AZIMUT_KIOSK_BUNDLE_DIR: '/srv/borne',
  AZIMUT_PACKAGE_DIR: '/srv/paquets',
  AZIMUT_KIOSK_MIN_RUNTIME: '1.0.0',
};

describe('T-0.11 — configuration du service', () => {
  it('lit une configuration complète, avec les cadences par défaut', () => {
    const read = readServiceConfig(COMPLETE);
    expect(read).toEqual({
      ok: true,
      config: {
        databaseUrl: 'postgres://service@base/azimut',
        kioskBundleDir: '/srv/borne',
        packageDir: '/srv/paquets',
        kioskMinRuntime: '1.0.0',
        idleMs: 5_000,
        reapEveryMs: 60_000,
      },
    });
  });

  it('refuse de démarrer à moitié configuré, et nomme tout ce qui manque', () => {
    const read = readServiceConfig({ AZIMUT_PACKAGE_DIR: '  ' });
    expect(read).toEqual({
      ok: false,
      problems: [
        'AZIMUT_COMPILER_DATABASE_URL absente',
        'AZIMUT_KIOSK_BUNDLE_DIR absente',
        'AZIMUT_PACKAGE_DIR absente',
        'AZIMUT_KIOSK_MIN_RUNTIME absente',
      ],
    });
  });

  it('refuse une version d’exécution ou une cadence mal formée', () => {
    const read = readServiceConfig({
      ...COMPLETE,
      AZIMUT_KIOSK_MIN_RUNTIME: 'v1',
      AZIMUT_WORKER_IDLE_MS: '0',
      AZIMUT_WORKER_REAP_MS: '1.5',
    });
    expect(read).toEqual({
      ok: false,
      problems: [
        'AZIMUT_KIOSK_MIN_RUNTIME doit être de la forme 1.2.3',
        'AZIMUT_WORKER_IDLE_MS doit être un entier positif de millisecondes',
        'AZIMUT_WORKER_REAP_MS doit être un entier positif de millisecondes',
      ],
    });
  });

  it('accepte des cadences explicites', () => {
    const read = readServiceConfig({
      ...COMPLETE, AZIMUT_WORKER_IDLE_MS: '250', AZIMUT_WORKER_REAP_MS: '10000',
    });
    expect(read.ok && read.config.idleMs).toBe(250);
    expect(read.ok && read.config.reapEveryMs).toBe(10_000);
  });

  it('range un paquet par site et par version', () => {
    expect(kioskPackagePath('site-1', 7)).toBe('sites/site-1/v7');
  });
});

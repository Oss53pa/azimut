import { createDb } from '@azimut/db';
import { fileSystemAssetStore } from './asset-store.js';
import { dbKioskPackageRecorder } from './db-package-recorder.js';
import { DbWorkerQueue } from './db-queue.js';
import { createKioskPackageJobHandler, dbLoadSite } from './kiosk-package-job.js';
import { MAX_ATTEMPTS } from './queue.js';
import type { JobHandler, WorkerLoopOptions } from './worker.js';

/**
 * T-0.11 — l'assemblage du service de compilation sur la base.
 *
 * Un seul gestionnaire aujourd'hui, `build_kiosk_package` : c'est le seul qui
 * charge son site travail par travail, sous l'identité du demandeur. Les
 * autres reçoivent un site figé à leur construction et ne savent pas servir
 * une file qui mêle les sites. Un travail d'un autre type est clos en échec
 * par la boucle, avec la raison (« No handler registered »).
 *
 * Tout vient de l'environnement (A2.4) : aucune adresse, aucun chemin, aucun
 * secret n'est écrit ici. Une configuration incomplète est refusée au
 * démarrage, avec la liste de ce qui manque, plutôt que de tourner à moitié.
 */
export type ServiceConfig = {
  /** Connexion du service : membre de `azimut_compiler` et de `authenticated` (ORDRE.md). */
  readonly databaseUrl: string;
  /** Répertoire du programme de borne construit : `index.html` et `assets/`. */
  readonly kioskBundleDir: string;
  /** Répertoire où les paquets sont écrits. */
  readonly packageDir: string;
  /** Version minimale d'exécution portée par le manifeste (D10.2). */
  readonly kioskMinRuntime: string;
  /** Attente quand la file est vide. */
  readonly idleMs: number;
  /** Intervalle du relevé des travaux sans progression (D9.2). */
  readonly reapEveryMs: number;
};

export type ServiceEnv = Readonly<Record<string, string | undefined>>;

export type ConfigOutcome =
  | { readonly ok: true; readonly config: ServiceConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

const DEFAULT_IDLE_MS = 5_000;
const DEFAULT_REAP_EVERY_MS = 60_000;
const SEMVER = /^\d+\.\d+\.\d+$/;

function required(env: ServiceEnv, name: string, problems: string[]): string {
  const value = env[name]?.trim() ?? '';
  if (value === '') problems.push(`${name} absente`);
  return value;
}

function duration(env: ServiceEnv, name: string, fallback: number, problems: string[]): number {
  const raw = env[name]?.trim() ?? '';
  if (raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    problems.push(`${name} doit être un entier positif de millisecondes`);
    return fallback;
  }
  return value;
}

/** Lit et vérifie la configuration du service depuis l'environnement. */
export function readServiceConfig(env: ServiceEnv): ConfigOutcome {
  const problems: string[] = [];
  const databaseUrl = required(env, 'AZIMUT_COMPILER_DATABASE_URL', problems);
  const kioskBundleDir = required(env, 'AZIMUT_KIOSK_BUNDLE_DIR', problems);
  const packageDir = required(env, 'AZIMUT_PACKAGE_DIR', problems);
  const kioskMinRuntime = required(env, 'AZIMUT_KIOSK_MIN_RUNTIME', problems);
  if (kioskMinRuntime !== '' && !SEMVER.test(kioskMinRuntime)) {
    problems.push('AZIMUT_KIOSK_MIN_RUNTIME doit être de la forme 1.2.3');
  }
  const idleMs = duration(env, 'AZIMUT_WORKER_IDLE_MS', DEFAULT_IDLE_MS, problems);
  const reapEveryMs = duration(env, 'AZIMUT_WORKER_REAP_MS', DEFAULT_REAP_EVERY_MS, problems);

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    config: { databaseUrl, kioskBundleDir, packageDir, kioskMinRuntime, idleMs, reapEveryMs },
  };
}

/** Le chemin d'un paquet dans le répertoire des paquets. */
export function kioskPackagePath(siteId: string, version: number): string {
  return `sites/${siteId}/v${version}`;
}

/** Les gestionnaires que le service enregistre, par type de travail. */
export function serviceHandlers(
  config: ServiceConfig,
  db: ReturnType<typeof createDb>,
): ReadonlyMap<string, JobHandler> {
  return new Map<string, JobHandler>([
    ['build_kiosk_package', createKioskPackageJobHandler({
      loadSite: dbLoadSite(db),
      bundleStore: fileSystemAssetStore(config.kioskBundleDir),
      packageSink: fileSystemAssetStore(config.packageDir),
      storagePathFor: kioskPackagePath,
      recordPackage: dbKioskPackageRecorder(db),
      minRuntime: config.kioskMinRuntime,
    })],
  ]);
}

export type Service = {
  readonly loop: Omit<WorkerLoopOptions, 'shouldStop' | 'sleep'>;
  /** Ferme la connexion à la base. */
  readonly close: () => Promise<void>;
};

/** Assemble le service : connexion, file en base, gestionnaires, horloge. */
export function createService(config: ServiceConfig, now: () => Date): Service {
  const db = createDb(config.databaseUrl);
  return {
    loop: {
      queue: new DbWorkerQueue(db, { maxAttempts: MAX_ATTEMPTS }),
      handlers: serviceHandlers(config, db),
      now,
      sleepMs: config.idleMs,
      reapEveryMs: config.reapEveryMs,
    },
    close: () => db.$client.end(),
  };
}

import { createService, readServiceConfig } from './service.js';
import { runWorkerLoop } from './worker.js';

/**
 * T-0.11 — point d'entrée du service de compilation.
 *
 * Lit la configuration, prend les travaux de la file en base jusqu'à un
 * signal d'arrêt, puis termine le travail en cours et ferme la connexion. Un
 * arrêt n'interrompt jamais un travail : la boucle ne s'arrête qu'entre deux.
 */
async function main(): Promise<number> {
  const read = readServiceConfig(process.env);
  if (!read.ok) {
    for (const problem of read.problems) console.error(`configuration : ${problem}`);
    return 2;
  }

  let stopping = false;
  let wake: (() => void) | null = null;
  const stop = (): void => {
    stopping = true;
    wake?.();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  const service = createService(read.config, () => new Date());
  try {
    const summary = await runWorkerLoop({
      ...service.loop,
      shouldStop: () => stopping,
      sleep: (ms) => new Promise<void>((resolve) => {
        const timer = setTimeout(() => { wake = null; resolve(); }, ms);
        wake = () => { clearTimeout(timer); wake = null; resolve(); };
      }),
    });
    console.log(`arrêt : ${summary.processed} travail(s) traité(s), ${summary.reaped} relevé(s)`);
    return 0;
  } finally {
    await service.close();
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  },
);

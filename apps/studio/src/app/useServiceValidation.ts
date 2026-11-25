/**
 * B5 — l'écran de validation demande le passage au service, et en suit
 * l'issue (décisions QB0, QB2 ; 0085).
 *
 * Le travail réussi, le passage du service est relu et rendu à l'écran, puis
 * la session est relue pour qu'il y entre : c'est lui que la soumission du
 * tableau des messages lira. Tant que le service ne l'a pas traité, l'écran
 * dit où en est la demande ; au-delà de l'attente, il le dit aussi, et la
 * demande reste en file.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import type { SinkConfig } from '../state/postgrest-sink.js';
import {
  SERVICE_POLL_MS, SERVICE_WAIT_MS, readServiceJob, readServicePassage, requestServiceValidation,
} from '../state/service-validation-request.js';

export type ServiceNotice = 'queued' | 'running' | 'failed' | 'waiting' | 'unavailable';

export function useServiceValidation(options: {
  readonly config: SinkConfig | null;
  readonly orgId: string;
  readonly siteId: string;
  readonly onPassage: (findings: readonly Finding[], ranAt: string, durationMs: number) => void;
  readonly refresh: () => Promise<void>;
}): { readonly available: boolean; readonly notice: ServiceNotice | null; readonly request: () => void } {
  const { config, orgId, siteId } = options;
  const [notice, setNotice] = useState<ServiceNotice | null>(null);
  const live = useRef(true);
  const done = useRef(options.onPassage);
  const refresh = useRef(options.refresh);
  done.current = options.onPassage;
  refresh.current = options.refresh;

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const request = useCallback((): void => {
    if (config === null) return;
    void (async () => {
      const started = performance.now();
      setNotice('queued');
      const jobId = await requestServiceValidation(config, orgId, siteId);
      if (!live.current) return;
      if (jobId === null) { setNotice('unavailable'); return; }
      const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });
      while (live.current && performance.now() - started < SERVICE_WAIT_MS) {
        await sleep(SERVICE_POLL_MS);
        if (!live.current) return;
        const job = await readServiceJob(config, jobId);
        if (job === null) continue;
        if (job.state === 'queued' || job.state === 'running') { setNotice(job.state); continue; }
        if (job.state !== 'succeeded') { setNotice('failed'); return; }
        const passage = await readServicePassage(config, job.validationId);
        if (!live.current) return;
        if (passage === null) { setNotice('failed'); return; }
        setNotice(null);
        done.current(passage.findings, passage.ranAt, Math.round(performance.now() - started));
        await refresh.current();
        return;
      }
      if (live.current) setNotice('waiting');
    })();
  }, [config, orgId, siteId]);

  return { available: config !== null, notice, request };
}

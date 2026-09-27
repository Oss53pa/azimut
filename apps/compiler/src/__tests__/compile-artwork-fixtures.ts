/**
 * Le décor partagé des essais de `createArtworkHandler` (T-2.12) : thème,
 * contexte de compilation sur le site de référence multi-niveaux, et fabrique
 * de tâche. Réparti entre plusieurs fichiers d'essais pour tenir la limite de
 * 400 lignes (A2.4).
 */
import type { CompileContext } from '../compile-artwork.js';
import type { Job } from '../job.js';
import type { FaceTheme } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';

export const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

export const context: CompileContext = {
  site: refMultilevel,
  theme,
  font_family: 'Helvetica',
  pdf_target: 'pdf-x4',
  creation_date: new Date('2024-06-15T12:00:00Z'),
};

export function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-compile-001',
    org_id: 'org-test-001',
    kind: 'compile_artworks',
    state: 'running',
    payload,
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2024-06-15T12:00:00Z'),
    started_at: new Date('2024-06-15T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

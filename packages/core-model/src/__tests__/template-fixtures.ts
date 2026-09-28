/**
 * Le décor partagé des essais du langage de gabarit (D8) : un gabarit valide,
 * à amender. Réparti entre plusieurs fichiers d'essais pour tenir la limite de
 * 400 lignes (A2.4).
 */
import { templateSchema } from '../template-schema.js';
import type { Template } from '../template-schema.js';

export function validTemplate(overrides?: Partial<Template>): Template {
  return templateSchema.parse({
    key: 'directional-suspended-2lines',
    faceCount: 2,
    grid: { columns: 12, margin_mm: 40, gutter_mm: 20 },
    blocks: [
      {
        index: 0,
        kind: 'resolved',
        binding: { source: 'route', field: 'nextDestinations', limit: 4 },
        area: { col: 1, colSpan: 9, row: 1 },
        style: { role: 'primary', align: 'left' },
      },
      {
        index: 1,
        kind: 'pictogram',
        binding: { source: 'destination', field: 'pictogram' },
        area: { col: 10, colSpan: 3, row: 1 },
      },
    ],
    sizing: { mode: 'computed', growAxis: 'width' },
    ...overrides,
  });
}

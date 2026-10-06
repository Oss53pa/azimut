import { describe, it, expect } from 'vitest';
import { transitionSchedule } from '@azimut/engine-graph';
import {
  annotateCommands, annotationsOn, openAnnotationIdsOn, readAnnotations, replyCommand, setStateCommand,
} from '../review-annotation.js';

const write = { orgId: 'org', siteId: 'site', timestamp: '2026-10-06T08:00:00.000Z' };
const ink = [[{ x: 0.1, y: 0.1, p: 0.5 }, { x: 0.4, y: 0.2, p: 0.7 }]];

describe('J4 — l’annotation en révision', () => {
  it('une même remarque sur trois lignes : trois annotations, un seul geste (R8)', () => {
    const out = annotateCommands(
      ['l1', 'l2', 'l3'].map((line, i) => ({ id: `a${String(i)}`, anchor: { kind: 'message_line' as const, id: line } })),
      { body: '  Pictogramme à revoir  ', ink: null }, write,
    );
    expect(out.kind).toBe('written');
    if (out.kind !== 'written') return;
    expect(out.commands).toHaveLength(3);
    expect(new Set(out.commands.map(c => c.groupKey)).size).toBe(1);
    expect(out.commands.every(c => c.module === '02-wayfinding')).toBe(true);
    expect(out.commands[0]?.after).toMatchObject({ message_line_id: 'l1', state: 'open', body: 'Pictogramme à revoir', ink: null });
  });

  it('un tracé seul suffit ; ni texte ni tracé, rien n’est écrit', () => {
    const anchor = { kind: 'zone' as const, id: 'z' };
    expect(annotateCommands([{ id: 'a', anchor }], { body: '', ink }, write).kind).toBe('written');
    expect(annotateCommands([{ id: 'a', anchor }], { body: '   ', ink: [[]] }, write).kind).toBe('empty');
  });

  it('se relit avec son fil, et une ligne sans ancre unique n’est pas montrée', () => {
    const rows = [
      { table: 'review_annotation', id: 'a', values: { message_line_id: 'l1', state: 'open', body: 'x', ink: JSON.stringify(ink), created_at: '1' } },
      { table: 'review_annotation', id: 'b', values: { zone_id: 'z', support_id: 's', state: 'open', body: 'y' } },
      { table: 'review_annotation', id: 'c', values: { zone_id: 'z', state: 'open', body: 'gommée', deleted_at: '2' } },
      { table: 'review_annotation_reply', id: 'r2', values: { annotation_id: 'a', body: 'deux', created_at: '3' } },
      { table: 'review_annotation_reply', id: 'r1', values: { annotation_id: 'a', body: 'un', created_at: '2' } },
    ];
    const read = readAnnotations(rows);
    expect(read.map(a => a.id)).toEqual(['a']);
    expect(read[0]?.ink).toEqual(ink);
    expect(read[0]?.replies.map(r => r.body)).toEqual(['un', 'deux']);
    expect(annotationsOn(read, { kind: 'message_line', id: 'l1' })).toHaveLength(1);
  });

  it('une annotation ouverte sur une ligne du tableau bloque l’approbation (R12)', () => {
    const rows = [
      { table: 'review_annotation', id: 'ouverte', values: { message_line_id: 'l1', state: 'open', body: 'x' } },
      { table: 'review_annotation', id: 'traitee', values: { message_line_id: 'l2', state: 'resolved', body: 'y' } },
      { table: 'review_annotation', id: 'ailleurs', values: { message_line_id: 'autre', state: 'open', body: 'z' } },
    ];
    const open = openAnnotationIdsOn(readAnnotations(rows), ['l1', 'l2']);
    expect(open).toEqual(['ouverte']);
    const refused = transitionSchedule('approve', {
      schedule: {
        site_id: 'site', version: 1, state: 'in_review', generated_at: '', inputs_hash: '', lines: [],
      },
      findings: [], graphValidated: true, rulesPackBound: true, openAnnotationIds: open, rejectionReason: null, supersedingVersion: null,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings.map(f => f.code)).toEqual(['REVIEW.ANNOTATION_OPEN']);
  });

  it('la clôture ne porte que l’état : la signature est celle de la base', () => {
    const [annotation] = readAnnotations([{ table: 'review_annotation', id: 'a', values: { zone_id: 'z', state: 'open', body: 'x' } }]);
    if (annotation === undefined) throw new Error('annotation attendue');
    const command = setStateCommand(annotation, 'rejected', write);
    expect(command?.after).toEqual({ state: 'rejected' });
    expect(setStateCommand(annotation, 'open', write)).toBeNull();
    expect(replyCommand('a', 'r', '   ', write)).toBeNull();
  });
});

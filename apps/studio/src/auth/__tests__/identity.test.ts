import { describe, it, expect } from 'vitest';
import { identityOf, membershipsFrom, LOCAL_IDENTITY } from '../identity.js';
import { ACTOR_OF_SESSION, ORG_OF_SESSION } from '../../app/session-identity.js';

const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORG_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const USER = 'cccccccc-0000-4000-8000-000000000003';

describe('AUTH.4 — les rattachements', () => {
  it('rend les rattachements avec le nom de l’organisation, triés par nom', () => {
    expect(membershipsFrom(
      [{ org_id: ORG_A, role: 'designer' }, { org_id: ORG_B, role: 'admin' }],
      [{ id: ORG_A, name: 'Zénith' }, { id: ORG_B, name: 'Alpha' }],
    )).toEqual([
      { orgId: ORG_B, orgName: 'Alpha', role: 'admin' },
      { orgId: ORG_A, orgName: 'Zénith', role: 'designer' },
    ]);
  });

  it('échoue sur une ligne de forme inattendue plutôt que de l’écarter', () => {
    expect(membershipsFrom([{ org_id: ORG_A, role: 'stagiaire' }], [])).toBeNull();
    expect(membershipsFrom([{ org_id: ORG_A, role: 'external_reviewer' }], [])).toBeNull();
    expect(membershipsFrom([{ org_id: 'pas-un-uuid', role: 'admin' }], [])).toBeNull();
    expect(membershipsFrom([null], [])).toBeNull();
    expect(membershipsFrom([], [{ id: ORG_A }])).toBeNull();
  });

  it('rend une liste vide sans rattachement : l’écran le dira', () => {
    expect(membershipsFrom([], [])).toEqual([]);
  });

  it('pose l’organisation et le rôle du rattachement choisi', () => {
    expect(identityOf(USER, { orgId: ORG_A, orgName: 'A', role: 'owner_rep' }))
      .toEqual({ userId: USER, orgId: ORG_A, actor: 'owner_rep' });
  });

  it('garde en mode local l’identité des sites de référence', () => {
    expect(LOCAL_IDENTITY).toEqual({ userId: null, orgId: ORG_OF_SESSION, actor: ACTOR_OF_SESSION });
  });
});

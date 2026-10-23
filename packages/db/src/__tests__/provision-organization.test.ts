import { describe, it, expect } from 'vitest';
import { provisionStatements } from '../provision-organization.js';

const ORG = 'a6200000-0000-0000-0000-0000000000a1';
const ADMIN = 'a6200000-0000-0000-0000-00000000a001';

describe('provisionStatements : organisation et premier administrateur', () => {
  it('se joue sous le rôle propriétaire des membres, puis le quitte', () => {
    const statements = provisionStatements({ id: ORG, name: 'A', slug: 'a', adminId: ADMIN });
    expect(statements[0]).toBe('set local role azimut_membership_admin');
    expect(statements.at(-1)).toBe('reset role');
    expect(statements[2]).toContain(`'${ADMIN}', 'admin'`);
  });

  it('refuse un identifiant, un administrateur ou un slug mal formés', () => {
    const ok = { id: ORG, name: 'A', slug: 'a', adminId: ADMIN };
    expect(() => provisionStatements({ ...ok, id: "x'; drop table azimut.site; --" })).toThrow(/organisation/);
    expect(() => provisionStatements({ ...ok, adminId: 'pas-un-uuid' })).toThrow(/administrateur/);
    expect(() => provisionStatements({ ...ok, slug: "a' or 1=1" })).toThrow(/slug/);
  });

  it('double l’apostrophe d’un nom', () => {
    const [, insert] = provisionStatements({ id: ORG, name: "L'Atelier", slug: 'atelier', adminId: ADMIN });
    expect(insert).toContain("'L''Atelier'");
  });
});

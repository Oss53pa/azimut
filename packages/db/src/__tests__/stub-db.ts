import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';


/**
 * A drizzle stub that dispatches `db.select().from(table).where(...)` to the
 * rows registered for that table, so the full loadSiteData path (queries →
 * assemble → map) runs without a live Postgres. Tables with no entry return [].
 */
export function stubDb(byTable: Map<object, unknown[]>): PostgresJsDatabase {
  const db = {
    select() {
      return {
        from(table: object) {
          const rows = byTable.get(table) ?? [];
          const result = { where: () => Promise.resolve(rows) };
          // Some queries await `.from(t)` with a `.where`; all go through where.
          return result;
        },
      };
    },
  };
  return db as unknown as PostgresJsDatabase;
}

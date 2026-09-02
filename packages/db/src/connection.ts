import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createConnection(url: string): postgres.Sql {
  return postgres(url);
}

export function createDb(url: string) {
  const client = createConnection(url);
  return drizzle(client);
}

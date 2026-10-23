import type { Db } from '@flicktips/db';
import type { SQL } from 'drizzle-orm';

import type { Row } from './group-rows.js';

/**
 * Runs a parameterized raw query and returns its rows the way PHP's PDO (emulated prepares, the legacy API's
 * setup) fetched them: every non-NULL value is a string. Fields the PHP code did not settype() therefore keep
 * the string type in the JSON, as the legacy pages expect. Dates already come back as strings from Drizzle.
 */
export async function pdoRows(db: Pick<Db, 'execute'>, query: SQL): Promise<Row[]> {
  const [rows] = (await db.execute(query)) as unknown as [Row[]];
  return rows.map(pdoRow);
}

export function pdoRow(row: Row): Row {
  const out: Row = {};
  for (const [field, value] of Object.entries(row)) {
    out[field] = typeof value === 'number' || typeof value === 'bigint' ? String(value) : value;
  }
  return out;
}

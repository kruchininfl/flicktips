// Resume point of a `match` run: every movie with id <= cursor has been processed and written to the report.
import { readFile, rename, writeFile } from 'node:fs/promises';

export interface Checkpoint {
  version: 1;
  mode: 'dry-run' | 'apply';
  database: string;
  host: string;
  includeErrored: boolean;
  cursor: number;
  updatedAt: string;
  totals: Record<string, number>;
}

export async function readCheckpoint(path: string): Promise<Checkpoint | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Checkpoint;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeCheckpoint(path: string, checkpoint: Checkpoint): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(checkpoint, null, 2) + '\n');
  await rename(tmp, path);
}

// Append-only CSV + JSONL reports. The CSV starts with a UTF-8 BOM so that Excel/Numbers show Cyrillic.
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type Cell = string | number | boolean | null | undefined;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values: Cell[]): string {
  return values.map(csvCell).join(',') + '\n';
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class ReportWriter<Row> {
  constructor(
    private readonly paths: { csv?: string; jsonl?: string },
    private readonly columns: readonly string[] = [],
    private readonly toCsv: (row: Row) => Cell[] = () => [],
  ) {}

  // truncate: start new files (duplicates report); otherwise append and write the header only once
  async open(truncate = false): Promise<void> {
    const { csv, jsonl } = this.paths;
    for (const path of [csv, jsonl]) if (path) await mkdir(dirname(path), { recursive: true });
    if (csv && (truncate || !(await exists(csv)))) await writeFile(csv, '\uFEFF' + csvLine([...this.columns]));
    if (jsonl && (truncate || !(await exists(jsonl)))) await writeFile(jsonl, '');
  }

  async append(rows: Row[]): Promise<void> {
    if (!rows.length) return;
    const { csv, jsonl } = this.paths;
    if (jsonl) await appendFile(jsonl, rows.map((r) => JSON.stringify(r) + '\n').join(''));
    if (csv) await appendFile(csv, rows.map((r) => csvLine(this.toCsv(r))).join(''));
  }
}

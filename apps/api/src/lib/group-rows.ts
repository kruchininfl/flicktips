// TypeScript port of the PHP Services\Mapper::group: folds joined SQL rows (one row per movie × genre × …)
// into one object per key, casting fields like PHP settype and collecting "group" fields into arrays.

export type PhpType = 'int' | 'float' | 'bool' | 'string';

export interface FieldOptions {
  // settype() target
  type?: PhpType;
  // output name of the field (inside the group item for group fields)
  rename?: string;
  // name of the array the field goes to; one item per distinct groupIdField value
  group?: string;
  // row field(s) identifying the group item; with several, all must be non-empty and are joined with '_'
  groupIdField?: string | readonly string[];
}

export type Row = Record<string, unknown>;

// Leading numeric prefix, as PHP 7 reads numeric strings (" 12abc" → 12, "1e3" → 1000, "abc" → 0).
const numericPrefix = /^[ \t\n\r\v\f]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

function phpFloat(value: unknown): number {
  if (value === null || value === undefined || value === false) return 0;
  if (value === true) return 1;
  if (typeof value === 'number') return value;
  const match = numericPrefix.exec(String(value));
  return match ? Number(match[0]) : 0;
}

// The value after PHP's settype($value, $type).
export function phpCast(value: unknown, type: 'int'): number;
export function phpCast(value: unknown, type: 'float'): number;
export function phpCast(value: unknown, type: 'bool'): boolean;
export function phpCast(value: unknown, type: 'string'): string;
export function phpCast(value: unknown, type: PhpType): number | boolean | string;
export function phpCast(value: unknown, type: PhpType): number | boolean | string {
  switch (type) {
    case 'int': {
      const n = Math.trunc(phpFloat(value));
      return Number.isFinite(n) ? n : 0;
    }
    case 'float':
      return phpFloat(value);
    case 'bool':
      if (typeof value === 'string') return value !== '' && value !== '0';
      if (typeof value === 'number') return value !== 0;
      return !!value;
    case 'string':
      if (value === null || value === undefined || value === false) return '';
      if (value === true) return '1';
      return String(value);
  }
}

// PHP array keys from row values: null becomes ''.
const keyOf = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/**
 * Mapper::group. Rows sharing `key` (one field or several joined with '_') become one object; flat fields
 * take the value of the last row, group fields are collected into `item[group]`, one entry per group id,
 * in order of first appearance. A group with no entries is left out, as in PHP.
 */
export function groupRows<Out = Row>(
  rows: Row[],
  key: string | readonly string[],
  fields: Record<string, FieldOptions>,
): Out[] {
  const items = new Map<string, Map<string, unknown>>();

  for (const row of rows) {
    const itemKey = typeof key === 'string' ? keyOf(row[key]) : key.map((k) => keyOf(row[k])).join('_');
    let item = items.get(itemKey);
    if (!item) {
      item = new Map();
      items.set(itemKey, item);
    }

    for (const [field, raw] of Object.entries(row)) {
      const options = fields[field] ?? {};
      const value = options.type ? phpCast(raw, options.type) : raw;
      const name = options.rename ?? field;

      if (!options.group) {
        item.set(name, value);
        continue;
      }

      let groupId: string | null;
      const idField = options.groupIdField ?? '';
      if (typeof idField === 'string') {
        groupId = isEmpty(row[idField]) ? null : keyOf(row[idField]);
      } else {
        groupId = idField.every((f) => !isEmpty(row[f])) ? idField.map((f) => keyOf(row[f])).join('_') : null;
      }
      if (groupId === null) continue;

      let group = item.get(options.group) as Map<string, Row> | undefined;
      if (!(group instanceof Map)) {
        group = new Map();
        item.set(options.group, group);
      }
      const entry = group.get(groupId) ?? {};
      entry[name] = value;
      group.set(groupId, entry);
    }
  }

  return [...items.values()].map((item) => {
    const out: Row = {};
    for (const [name, value] of item) {
      out[name] = value instanceof Map ? [...value.values()] : value;
    }
    return out as Out;
  });
}

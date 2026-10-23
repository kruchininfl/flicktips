// Typed port of the PHP Services\Mapper::group: folds the flat rows of a JOIN into nested objects,
// casting fields the way PHP's settype did so that responses keep their legacy types.

export type PhpType = 'int' | 'float' | 'bool' | 'string';

export interface FieldOptions {
  type?: PhpType;
  rename?: string;
  // name of the nested array the field goes into
  group?: string;
  // field(s) whose value identifies an item of the group; several are joined with '_'
  groupIdField?: string | string[];
}

export type Row = Record<string, unknown>;

// PHP's string -> number conversion: leading numeric prefix, else 0.
function phpNumber(value: string, int: boolean): number {
  const match = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(value);
  if (!match) return 0;
  const n = Number(match[0]);
  return int ? Math.trunc(n) : n;
}

function phpString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '1';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// settype($value, $type)
export function phpCast(value: unknown, type: PhpType): number | boolean | string {
  switch (type) {
    case 'int':
    case 'float': {
      const int = type === 'int';
      if (value === null || value === undefined || value === false) return 0;
      if (value === true) return 1;
      if (typeof value === 'number') return int ? Math.trunc(value) : value;
      if (typeof value === 'bigint') return Number(value);
      return phpNumber(phpString(value), int);
    }
    case 'bool':
      if (typeof value === 'string') return value !== '' && value !== '0';
      if (typeof value === 'number') return value !== 0;
      return !!value;
    case 'string':
      return phpString(value);
  }
}

// What PDO (PHP 7.4, emulated prepares) handed to PHP: every non-NULL value as a string.
export function pdoRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k] = v === null || v === undefined ? null : phpString(v);
  return out;
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

function joinKey(row: Row, fields: string[]): string {
  return fields.map((f) => phpString(row[f])).join('_');
}

// Mapper::group($rows, $keys, $fieldsOptions). Rows are merged by `key`; for flat fields later rows win.
// Grouped fields go to item[group][groupId][name]; an item is created only when its group id is set and
// not ''. Row and group-item order follow first appearance; a group without items is left out.
export function groupRows<Out = Row>(rows: Row[], key: string | string[], fields: Record<string, FieldOptions>): Out[] {
  const result = new Map<string, Row>();
  const groups = new Map<Row, Map<string, Map<string, Row>>>();

  for (const row of rows) {
    const k = Array.isArray(key) ? joinKey(row, key) : phpString(row[key]);
    let item = result.get(k);
    if (!item) {
      item = {};
      result.set(k, item);
      groups.set(item, new Map());
    }
    const itemGroups = groups.get(item)!;

    for (const [field, raw] of Object.entries(row)) {
      const opts = fields[field];
      const value = opts?.type ? phpCast(raw, opts.type) : raw;
      const name = opts?.rename ?? field;

      if (opts?.group) {
        const idField = opts.groupIdField ?? field;
        // PHP: isset($row[$f]) && $row[$f] != '' for every id field (rows hold strings, so '0' counts as set)
        const idFields = Array.isArray(idField) ? idField : [idField];
        if (!idFields.every((f) => !isEmpty(row[f]))) continue;
        const groupId = joinKey(row, idFields);

        let group = itemGroups.get(opts.group);
        if (!group) {
          group = new Map();
          itemGroups.set(opts.group, group);
        }
        let entry = group.get(groupId);
        if (!entry) {
          entry = {};
          group.set(groupId, entry);
        }
        entry[name] = value;
      } else {
        item[name] = value;
      }
    }
  }

  return [...result.values()].map((item) => {
    for (const [name, group] of groups.get(item)!) item[name] = [...group.values()];
    return item as Out;
  });
}

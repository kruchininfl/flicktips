import {q} from '../core/db';

interface IRow {
  id: number;
  name: string;
}

export default async function insertQuality(strings: string[]) {
  await q("INSERT ft_quality (name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)", [strings.map((string) => [string])]);

  const [ rows ] = await q("SELECT id, name FROM ft_quality WHERE name IN (?)", [strings]);

  return (rows as Array<IRow>).reduce((acc, row) => {
    acc[row.name] = row.id;

    return acc;
  }, {});
}
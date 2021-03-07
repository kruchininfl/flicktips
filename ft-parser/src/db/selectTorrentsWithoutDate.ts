import {q} from '../core/db';

interface IRow {
  id: number;
  link: string;
}

export default async function selectTorrentsWithoutDate(limit: number = 10) {
  const [ total ] = await q("SELECT COUNT(*) as total FROM ft_torrent WHERE checked = 0 AND created IS NULL");
  const [ rows ] = await q("SELECT id, link FROM ft_torrent WHERE checked = 0 AND created IS NULL LIMIT ?", [limit]);

  return {
    total: total[0].total,
    rows: rows as IRow[],
  }
}
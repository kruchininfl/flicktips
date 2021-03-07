import {q} from '../core/db';

export default async function selectLastFilm(): Promise<{
  ft_id: number;
  kp_id: number;
  name?: string;
  original_name?: string;
  slug?: string;
  date_add?: string;
  date_update?: string;
  torrents: number[];
} | undefined> {
  const [ rows ] = await q("SELECT * FROM ft_film ORDER BY date_update DESC LIMIT 1");

  return rows[0];
}
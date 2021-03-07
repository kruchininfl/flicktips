import {q} from '../core/db';

interface IRow {
  id: number;
  kp_id: number;
  my_kp_id?: number;
  name?: string;
  original_name?: string;
}

const MAX_DAY_DIFF = 7;

export default async function selectFilmUnmatch(limit: number = 10) {
  const [ total ] = await q("SELECT COUNT(*) as total FROM ft_film f \
    LEFT JOIN movie m_m ON m_m.kp_id = f.kp_id \
    WHERE (f.match_date IS NULL OR DATEDIFF(CURDATE(), f.match_date) >= ?) \
    AND (m_m.kp_force_check IS NULL OR m_m.kp_force_check = 0)\
    ORDER BY f.match_date, f.date_add DESC", [MAX_DAY_DIFF]);

  const [ rows ] = await q("SELECT f.id, f.name, f.original_name, f.kp_id, m_m.kp_id AS my_kp_id FROM ft_film f \
    LEFT JOIN movie m_m ON m_m.kp_id = f.kp_id \
    WHERE (f.match_date IS NULL OR DATEDIFF(CURDATE(), f.match_date) >= ?) \
    AND (m_m.kp_force_check IS NULL OR m_m.kp_force_check = 0) \
    ORDER BY f.match_date, f.date_add DESC \
    LIMIT ?", [MAX_DAY_DIFF, limit]);

  return {
    total: total[0].total,
    rows: rows as IRow[],
  }
}
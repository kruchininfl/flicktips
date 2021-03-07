import {q} from '../core/db';

export default async function updateFilmMatchDate(films: number[]) {
  return await q("UPDATE ft_film SET match_date=NOW() WHERE id IN (?);", [films]);
}
import {q} from '../core/db';

export default async function insertFilm(film: {
  ft_id: number;
  kp_id: number;
  name?: string;
  original_name?: string;
  slug?: string;
  date_add?: string;
  date_update?: string;
  torrents: number[];
}) {
  await q(`
    INSERT ft_film (ft_id, kp_id, name, original_name, slug, date_add, date_update) VALUES (?) \
    ON DUPLICATE KEY UPDATE kp_id = VALUES(kp_id), name = VALUES(name), original_name = VALUES(original_name), slug = VALUES(slug), \
    date_add = VALUES(date_add), date_update = VALUES(date_update)
  `, [[
    film.ft_id,
    film.kp_id,
    film.name,
    film.original_name,
    film.slug,
    film.date_add,
    film.date_update,
  ]]);

  const [ rows ] = await q("SELECT id FROM ft_film WHERE kp_id=?", [film.kp_id]);

  const filmId = rows[0].id;

  await q(`INSERT IGNORE ft_film_torrent (film_id, torrent_id) VALUES ?`, [film.torrents.map((torrentID) => ([
    filmId,
    torrentID,
  ]))]);

  return filmId;
}
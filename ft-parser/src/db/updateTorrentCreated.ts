import {q} from '../core/db';

export default async function updateTorrentCreated(data: [number, string | null][]) {
  return Promise.all(data.map(([id, created]) => (
    q("UPDATE ft_torrent SET created = ?, checked = 1 WHERE id =?;", [created, id])
  )));
}
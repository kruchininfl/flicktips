import {q} from '../core/db';

interface ITorrent {
  quality?: number;
  voice?: number;
  id: number;
  size?: string;
  link?: string;
  created?: string;
}

interface IRow {
  id: number;
}

export default async function insertTorrent(torrents: ITorrent[]) {
  await q(`
    INSERT ft_torrent (ft_id, quality, voice, size, link, created) VALUES ? \
    ON DUPLICATE KEY UPDATE quality = VALUES(quality), voice = VALUES(voice), size = VALUES(size), link = VALUES(link), created = VALUES(created)
  `, [torrents.map((torrent) => [
    torrent.id,
    torrent.quality || null,
    torrent.voice || null,
    torrent.size,
    torrent.link,
    torrent.created,
  ])]);

  const [ rows ] = await q("SELECT id FROM ft_torrent WHERE ft_id IN(?)", [torrents.map(({ id }) => id)]);

  return (rows as Array<IRow>).map(({ id }) => id);
}
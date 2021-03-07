import {IProgress} from '../app';
import selectTorrentsWithoutDate from '../db/selectTorrentsWithoutDate';
import parseFastTorrentFile from '../core/parseFastTorrentFile';
import moment from 'moment';
import updateTorrentCreated from '../db/updateTorrentCreated';

export default async function parseTorrentDate(progress: IProgress) {
  let hasData = true;

  while(hasData) {
    const torrents = await selectTorrentsWithoutDate(10);

    hasData = Boolean(torrents.rows.length);

    progress.currentStep = "torrentDate";
    progress.steps.torrentDate.total = torrents.total;

    if (torrents.total) {
      const torrentsData: [number, string | null][] = [];

      for (const torrent of torrents.rows) {
        const file = await parseFastTorrentFile(torrent.link);
        const created = file.payload?.created && moment(file.payload.created);

        torrentsData.push([torrent.id, created && created.isValid() && created.toDate() <= new Date() ? created.format("YYYY-MM-DD") : null]);
      }

      await updateTorrentCreated(torrentsData);

      progress.steps.torrentDate.parsed += torrents.rows.length;
    }
  }
}
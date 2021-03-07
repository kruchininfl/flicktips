import FetchBase from './FetchBase';
import parseTorrent from 'parse-torrent';

const {_} = new FetchBase({
  baseUrl: "http://fast-torrent.ru",
  timeout: 5000,
  enableProxy: true,
});

export default async function parseFastTorrentFile(url: string) {
  return _<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  }).then((resp) => {
    if (!resp.error) {
      try {
        return {
          error: false,
          payload: parseTorrent(resp.payload),
        }
      } catch (e) {
        return {
          error: true,
          error_code: "JSON_PARSE_FAIL",
        }
      }
    } else {
      return resp;
    }
  });
};
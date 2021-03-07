import fetchFilmDetails, {fetchFastTorrentFilmList, IFilmDetails, IFilmSummary} from '../core/fetchFastTorrent';
import fs from "fs";
import selectLastFilm from '../db/selectLastFilm';
import moment from 'moment';
import insertVoice from '../db/insertVoice';
import insertQuality from '../db/insertQuality';
import insertTorrent from '../db/insertTorrent';
import insertFilm from '../db/insertFilm';
import {IProgress} from '../app';

const MAX_WORKERS_NUM = 5;
const PATH_TO_JSON_TOTAL = "./temp/total.json";
const PATH_TO_JSON_FAILS = "./temp/fails.json";

const _getFilmWorker = async (
  summaryFilmList: IFilmSummary[],
  cb: (film: IFilmDetails & {
    dateAdd: IFilmSummary["dateAdd"];
    dateUpdate: IFilmSummary["dateUpdate"];
  } | string, filmSummary: IFilmSummary) => void,
) => {
  const summaryFilm = summaryFilmList.splice(0, 1)[0];

  if (!summaryFilm) {
    return false;
  }

  const {
    link,
    dateAdd,
    dateUpdate,
  } = summaryFilm;

  const film = await fetchFilmDetails(link);

  await cb(film ? {
    ...film,
    dateAdd,
    dateUpdate,
  } : `Error: ${link}`, summaryFilm);

  return _getFilmWorker(summaryFilmList, cb);
}

const _getList = (() => {
  const START_PAGE = 1;
  const MAX_PAGE = Infinity;

  return async (
    progress: IProgress,
    minDate?: string,
  ) => {
    if (fs.existsSync(PATH_TO_JSON_TOTAL)) {
      return JSON.parse(fs.readFileSync(PATH_TO_JSON_TOTAL, "utf8")) as IFilmSummary[];
    }

    const links: IFilmSummary[] = [];

    let currentPage = START_PAGE;
    let hasNextPage = true;

    while (hasNextPage) {
      const resp = await fetchFastTorrentFilmList(currentPage);

      if (resp) {
        progress.steps.list.total = resp.total;
        progress.steps.list.current = currentPage;

        const relativeItems = minDate ? resp.items.filter((item) => (
          item.dateUpdate >= minDate
        )) : resp.items;

        currentPage++;
        hasNextPage = resp.hasNextPage && currentPage <= MAX_PAGE && relativeItems.length === resp.items.length;
        links.push(...relativeItems);
      } else {
        currentPage++;
        hasNextPage = true;
      }
    }

    return links;
  }
})()

export default async function parseFastTorrent(progress: IProgress) {
  progress.currentStep = "list";

  const lastFilm = await selectLastFilm();
  const minUpdatedDate = lastFilm?.date_update && moment(lastFilm.date_update).format("YYYY-MM-DD")
  const filmSummaryList = await _getList(progress, minUpdatedDate);

  console.log(minUpdatedDate);

  fs.writeFileSync(PATH_TO_JSON_TOTAL, JSON.stringify(filmSummaryList), { flag: "w+" });

  const filmFailsList: IFilmSummary[] = [];

  progress.currentStep = "filmDetails";
  progress.steps.filmDetails.total = filmSummaryList.length;

  try {
    await Promise.all(new Array(MAX_WORKERS_NUM).fill(undefined).map(() => (
      new Promise((resolve, reject) => {
        _getFilmWorker(filmSummaryList, async (film, filmSummary) => {
          try {
            if (typeof film !== "string" && film.kpId && film.torrents?.length) {
              const {
                voices,
                qualities,
              } = film.torrents.reduce((acc: {
                voices: string[];
                qualities: string[];
              }, { quality, voice }) => {
                if (voice && !acc.voices.includes(voice)) {
                  acc.voices.push(voice);
                }

                if (quality && !acc.qualities.includes(quality)) {
                  acc.qualities.push(quality);
                }

                return acc;
              }, {
                voices: [],
                qualities: [],
              });

              if (!voices.length || !qualities.length) {
                progress.steps.filmDetails.fail++;
                return false;
              }

              const [
                dbVoice,
                dbQuality,
              ] = await Promise.all([
                insertVoice(voices),
                insertQuality(qualities),
              ]);

              const dbTorrents = await insertTorrent(film.torrents.map((torrent) => ({
                ...torrent,
                id: torrent.link ? Number(/\/download\/torrent\/(.*?)\//g.exec(torrent.link)?.[1]): 0,
                voice: torrent.voice && dbVoice[torrent.voice],
                quality: torrent.quality && dbQuality[torrent.quality],
                created: film.dateUpdate,
              })));

              if (dbTorrents.length) {
                const filmId = await insertFilm(({
                  ft_id: film.id,
                  kp_id: film.kpId,
                  name: film.name,
                  original_name: film.originalName,
                  slug: film.slug,
                  date_add: film.dateAdd,
                  date_update: film.dateUpdate,
                  torrents: dbTorrents,
                }));

                if (filmId) {
                  progress.steps.filmDetails.success++;
                } else {
                  filmFailsList.push(filmSummary);
                  progress.steps.filmDetails.fail++;
                }
              } else {
                filmFailsList.push(filmSummary);
                progress.steps.filmDetails.fail++;
              }
            } else {
              filmFailsList.push(filmSummary);
              progress.steps.filmDetails.fail++;
            }
          } catch(e) {
            filmFailsList.push(filmSummary);
            progress.steps.filmDetails.fail++;
          }
        }).then(resolve).catch(reject);
      })
    )));

    fs.unlinkSync(PATH_TO_JSON_TOTAL);
  } catch (e) {
    fs.writeFileSync(PATH_TO_JSON_TOTAL, JSON.stringify(filmSummaryList), { flag: "w+" });
  } finally {
    fs.writeFileSync(PATH_TO_JSON_FAILS, JSON.stringify(filmFailsList), { flag: "w+" });
  }
}

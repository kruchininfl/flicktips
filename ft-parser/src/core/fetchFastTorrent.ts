import cheerio from 'cheerio';
import FetchBase from './FetchBase';

const {_} = new FetchBase({
  baseUrl: "http://fast-torrent.ru",
  timeout: 5000,
  enableProxy: true,
  maxTry: 5,
});

export interface IFilmSummary {
  link: string;
  dateAdd: string;
  dateUpdate: string;
}

async function fetch(url: string) {
  return _<string>(url).then((resp) => {
    if (!resp.error) {
      try {
        return {
          error: false,
          payload: cheerio.load(resp.payload) as cheerio.Root,
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
}

export const fetchFastTorrentFilmList = (() => {
  const PER_PAGE = 50;
  const TEXT_DATE_ADD = "Дата добавления:";
  const TEXT_DATE_UPDATE = "Последнее обновление:";

  return async (page: number): Promise<{
    items: Array<{
      link: string;
      dateAdd: string;
      dateUpdate: string;
    }>;
    hasNextPage: boolean;
    total: number;
  } | undefined> => {
    const resp = await fetch(`/new-torrent/${page}.html?pages=${PER_PAGE}`);

    if (resp.error || !resp.payload) {
      return undefined;
    }

    const $ = resp.payload;

    return {
      items: $(".film-foot").toArray().reduce((acc: IFilmSummary[], item) => {
        const $item = $(item);

        const href = $item.find("a").attr("href");
        const dateAdd = $(item).find(`em:contains("${TEXT_DATE_ADD}")`)?.text().replace(TEXT_DATE_ADD, "").trim();
        const dateUpdate = $(item).find(`em:contains("${TEXT_DATE_UPDATE}")`)?.text().replace(TEXT_DATE_UPDATE, "").trim();

        if (href && dateAdd.length === 10 && dateUpdate.length === 10) {
          acc.push({
            link: href,
            dateAdd: `${dateAdd.substr(6, 4)}-${dateAdd.substr(3, 2)}-${dateAdd.substr(0, 2)}`,
            dateUpdate: `${dateUpdate.substr(6, 4)}-${dateUpdate.substr(3, 2)}-${dateUpdate.substr(0, 2)}`,
          });
        }

        return acc;
      }, []),
      hasNextPage: Boolean($(".page_next a")?.length),
      total: Number($(".paginator.mod_sort").eq(0).find("li:not([class])").last().text()),
    };
  }
})();

export interface IFilmDetails {
  slug: string;
  id: number;
  name?: string;
  originalName?: string;
  kpId?: number;
  torrents?: Array<{
    quality?: string;
    voice?: string;
    size?: string;
    link?: string;
  }>
}
export default async function fetchFilmDetails(
  url: string,
): Promise<false | IFilmDetails> {
  const [
    respMain,
    respTorrents,
  ] = await Promise.all([
    fetch(url),
    fetch(url.replace(".html", "/torrents.html")),
  ]);

  if (
    respMain.error ||
    respTorrents.error ||
    !respMain.payload ||
    !respTorrents.payload
  ) {
    return false;
  }

  const $ = respMain.payload;
  const $$ = respTorrents.payload;

  return {
    slug: url.replace("/film/", "").replace(".html", ""),
    id: Number($(".film_controll").attr("obj_id")),
    name: $("#film_name").text(),
    originalName: $("#film_name_orig").text(),
    kpId: Number($("#user_vote1").next().attr("style")
      ?.replace("height:38px;background:url(\"https://rating.kinopoisk.ru/", "")
      ?.replace(".gif\") no-repeat 50% 0", "") || 0),
    torrents: $$(".torrent-row.open").toArray().map((item) => {
      const $row = $$(item);

      return {
        quality: $row.find(".c1 .qa-icon").attr("class")?.replace("qa-icon qa-", "")?.replace("use_tooltip", "").trim(),
        voice: $row.find(".c2 > b").text(),
        size: $row.find(".c3").text(),
        link: $row.find(".c7 .download-event").attr("href"),
      };
    })
  }
};
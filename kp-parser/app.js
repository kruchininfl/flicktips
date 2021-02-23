import {search as kpSearch, getFilm, getFilmStaff, sleep} from './components/parser';
import mysql from 'mysql2/promise';
import cs from 'console-stamp';
import moment from 'moment';

cs(console, '[HH:MM:ss.l]');

let connection;

const MAX_WORKERS = 1;
const MAX_DIFF_CHECKING_DAY = 7;
const MAX_DIFF_CHECKING_DAY_FOR_STAFF = 180;
const MIN_STRING_SIMILARITY_K = 0.9;

const mysqlConfig = {
  host    : 'localhost',
  // host    : '95.214.10.128',
  user    : 'flicktips',
  password: 'Aing6sii',
  database: 'flicktips'
};

const selectMovie = async () => {
  let [rows] = await connection.execute(`SELECT 
    COUNT(*) AS sum_total,
    movie.id, movie.title, movie.kp_id, movie.original_title, movie.type, movie.kp_check_date, movie.kp_force_check,
    CASE WHEN movie.release_date IS NOT NULL THEN YEAR(movie.release_date) ELSE YEAR(movie.first_air_date) END AS year
    FROM movie_vote
    LEFT JOIN movie ON movie.id=movie_vote.movie_id 
    WHERE movie.kp_check_date IS NULL OR DATEDIFF(CURDATE(), kp_check_date) >= ? OR kp_force_check >= 1
    GROUP BY movie_id 
    ORDER BY 
      SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 0)) DESC,
      SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 0)) DESC,
      SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 3 DAY), 1, 0)) DESC,
      SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY), 1, 0)) DESC,
      sum_total DESC
    LIMIT 1`, [MAX_DIFF_CHECKING_DAY]);

  if (!rows || !rows.length) {
    [rows] = await connection.execute(`SELECT
      id, (likes + dislikes + neutral) AS votes, original_title, title, type, kp_id,
      CASE WHEN release_date IS NOT NULL THEN YEAR(release_date) ELSE YEAR(first_air_date) END AS year
      FROM movie 
      WHERE kp_check_date IS NULL OR DATEDIFF(CURDATE(), kp_check_date) >= ? OR kp_force_check >= 1
      ORDER BY votes DESC, kp_force_check DESC, kp_check_date ASC LIMIT 1`, [MAX_DIFF_CHECKING_DAY]);
  }

  return rows;
};

const insertCountries = async (countries) => {
  if (!countries || !countries.length) {
    return false;
  }

  await connection.query('INSERT IGNORE `country` (name) VALUES ?', [countries.map(country => [country])]);
  const [rows] = await connection.query('SELECT id FROM `country` WHERE name IN (?)', [countries]);

  return rows;
};

const insertGenres = async (genres) => {
  if (!genres || !genres.length) {
    return false;
  }

  await connection.query('INSERT IGNORE `kp-genre` (name) VALUES ?', [genres.map(genre => [genre])]);
  const [rows] = await connection.query('SELECT id FROM `kp-genre` WHERE name IN (?)', [genres]);

  return rows;
};

const insertPeople = async (people) => {
  if (!people || !people.length) {
    return false;
  }

  const mappedGroups = people.reduce(function (result, item) {
    result.set(item.group.type, item.group.title);
    return result;
  }, new Map());

  await connection.query('INSERT IGNORE `group` (type, title) VALUES ?', [Array.from(mappedGroups)]);
  const [groups] = await connection.query('SELECT id, type FROM `group` WHERE type IN (?)', [Array.from(mappedGroups.keys())]);

  const uniquePeople = people.reduce(function (result, item) {
    result.set(item.id, [item.id, item.name, item.originalName, item.img]);
    return result;
  }, new Map());

  await connection.query('INSERT IGNORE `people` (kp_id, name, original_name, kp_photo) VALUES ?', [Array.from(uniquePeople.values())]);
  const [staff] = await connection.query('SELECT id, kp_id FROM `people` WHERE kp_id IN (?)', [Array.from(uniquePeople.keys())]);

  return people.map(person => {
    const id = staff.find(p => {
      return p.kp_id === person.id;
    }).id;

    const group_id = groups.find(g => {
      return g.type === person.group.type;
    }).id;

    return {
      id,
      group_id,
      description: person.description || null
    }
  });
};

const updateFilm = async (film) => {
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM `movie_country` WHERE movie_id = ?', film.my_id);
    await connection.query('DELETE FROM `movie_kp-genre` WHERE movie_id = ?', film.my_id);
    await connection.query('DELETE FROM `movie_people` WHERE movie_id = ?', film.my_id);

    film.countries && film.countries.length
    && await connection.query('INSERT IGNORE `movie_country` (movie_id, country_id) VALUES ?', [film.countries.map(country => [film.my_id, country.id])]);

    film.genres && film.genres.length
    && await connection.query('INSERT IGNORE `movie_kp-genre` (movie_id, `kp-genre_id`) VALUES ?', [film.genres.map(genre => [film.my_id, genre.id])]);

    film.staff && film.staff.length
    && await connection.query('INSERT IGNORE `movie_people` (movie_id, people_id, group_id, `order`, description) VALUES ?', [film.staff.map((person, index) => [film.my_id, person.id, person.group_id, index, person.description])]);

    await connection.query('UPDATE movie SET ? WHERE id = ?', [{
      kp_id              : film.id,
      kp_title           : film.title,
      kp_start_year      : film.start_year,
      kp_finish_year     : film.finish_year,
      kp_overview        : film.description,
      kp_duration        : film.duration,
      kp_release_date    : film.release_date,
      kp_release_date_dvd: film.release_dvd,
      kp_release_date_rus: film.release_rus,
      kp_rating_value    : film.kp_rating.value,
      kp_rating_count    : film.kp_rating.count,
      imdb_rating_value  : film.imdb_rating.value,
      imdb_rating_count  : film.imdb_rating.count,
      kp_error           : null,
      kp_check_date      : new Date(),
      kp_force_check     : null,
      kp_title_similarity: film.similarity
    }, film.my_id]);

    await connection.commit();

    console.log('film "' + film.title + ' - ' + film.my_id + '" updated');
  } catch (err) {
    await connection.rollback();
    console.log(err);
  }
};

const insertError = async (filmId, error) => {
  await connection.query('DELETE FROM `movie_country` WHERE movie_id = ?', filmId);
  await connection.query('DELETE FROM `movie_kp-genre` WHERE movie_id = ?', filmId);
  await connection.query('DELETE FROM `movie_people` WHERE movie_id = ?', filmId);

  await connection.query('UPDATE movie SET ? WHERE id = ?', [{
    kp_id              : null,
    kp_title           : null,
    kp_start_year      : null,
    kp_finish_year     : null,
    kp_overview        : null,
    kp_duration        : null,
    kp_release_date    : null,
    kp_release_date_dvd: null,
    kp_release_date_rus: null,
    kp_rating_value    : null,
    kp_rating_count    : null,
    imdb_rating_value  : null,
    imdb_rating_count  : null,
    kp_error           : error,
    kp_check_date      : new Date(),
    kp_title_similarity: null
  }, filmId]);

  console.log('film "' + filmId + ' error: ' + error);
};

const worker = (mainResolve) => {
  return new Promise((resolve) => {
    mainResolve = mainResolve || resolve;

    selectMovie().then((result) => {
      if (!result.length) {
        mainResolve && mainResolve();
        return false;
      }

      const {
        id,
        original_title,
        title,
        type,
        year,
        kp_id: dbKpId,
        kp_check_date,
        kp_force_check,
      } = result[0];

      (dbKpId && kp_force_check !== 2
        ? Promise.resolve({})
        : kpSearch(original_title, title, year, type, MIN_STRING_SIMILARITY_K)
      ).then(({id: kpId, similarity}) => {
        if (!kpId && !dbKpId) {
          insertError(id, 'not_found')
            .then(() => worker(mainResolve))
            .catch(err => console.error(err));
        } else {
          const lastCheckDaysAgo = kp_check_date && moment().diff(kp_check_date, "days");
          const disableStaffParsing = lastCheckDaysAgo && lastCheckDaysAgo < MAX_DIFF_CHECKING_DAY_FOR_STAFF && !kp_force_check;

          Promise.all([
            id, getFilm(kpId || dbKpId),
            disableStaffParsing ? Promise.resolve(null) : getFilmStaff(kpId || dbKpId),
            similarity
          ]).then(([my_id, film, staff, similarity]) => {
            film.my_id = my_id;

            const countriesReady = insertCountries(film.countries);
            const genresReady = insertGenres(film.genres);
            const peopleReady = insertPeople(staff);

            Promise.all([film, countriesReady, genresReady, peopleReady])
              .then(([film, countries, genres, people]) => {
                film.countries = countries || null;
                film.genres = genres || null;
                film.staff = people || null;
                film.similarity = similarity;

                updateFilm(film).then(() => worker(mainResolve)).catch(err => console.error(err));
              }).catch(err => console.error(err));
          }).catch(err => console.error(err));
        }
      });
    }).catch(err => console.error(err));
  }).catch(err => console.error(err));
};

(async function () {
  connection = await mysql.createConnection(mysqlConfig);

  let workers = [];
  for (let i = 0; i < MAX_WORKERS; i++) {
    workers.push(worker());
  }

  Promise.all(workers).then(() => {
    (async function () {
      console.log('end');
      await sleep(60000);
    })();
  }).catch(err => console.error(err));
})();

// (async () => {
//   // const d = await getFilm(655800) // serial;
//   const d = await getFilm(31739) // film;
//
//   console.log(d);
// })();

// (async function () {
//   const original_title = 'The Help';
//   const title = 'Прислуга';
//   const year = 2011;
//   const type = 'movie';
//
//   kpSearch(original_title, title, year, type, MIN_STRING_SIMILARITY_K).then((res) => {
//     console.log(res);
//   });
// })();

process.on('unhandledRejection', function (reason) {
  console.error('Unhandled Rejection:', reason.stack);
  process.exit(1);
});
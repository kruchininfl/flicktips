import {search as kpSearch, getFilm, getFilmStaff, sleep} from './components/parser';
import mysql from 'mysql2/promise';
import cs from 'console-stamp';

cs(console, '[HH:MM:ss.l]');

const MAX_WORKERS = 1;
const MAX_DIFF_CHECKING_DAY = 7;

const mysqlConfig = {
  host    : 'localhost',
  user    : 'flicktips',
  password: 'Aing6si',
  database: 'flicktips'
};

const selectMovie = async () => {
  const connection = await mysql.createConnection(mysqlConfig);

  let [rows] = await connection.execute(`SELECT 
    COUNT(*) AS sum_total,
    movie.id, movie.title, movie.kp_id,
    CASE WHEN movie.release_date IS NOT NULL THEN YEAR(movie.release_date) ELSE YEAR(movie.first_air_date) END AS year
    FROM movie_vote
    LEFT JOIN movie ON movie.id=movie_vote.movie_id 
    WHERE movie.kp_check_date IS NULL OR DATEDIFF(CURDATE(), kp_check_date) >= ?
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
      id, (likes + dislikes + neutral) AS votes, original_title, 
      CASE WHEN release_date IS NOT NULL THEN YEAR(release_date) ELSE YEAR(first_air_date) END AS year
      FROM movie 
      WHERE kp_check_date IS NULL OR DATEDIFF(CURDATE(), kp_check_date) >= ?
      ORDER BY votes DESC LIMIT 1`, [MAX_DIFF_CHECKING_DAY]);
  }

  connection.end();

  return rows;
};

const insertCountries = async (countries) => {
  if (!countries || !countries.length) {
    return false;
  }

  const connection = await mysql.createConnection(mysqlConfig);

  await connection.query('INSERT IGNORE `country` (kp_id, name) VALUES ?', [countries.map(country => [country.id, country.name])]);
  const [rows] = await connection.query('SELECT id FROM `country` WHERE kp_id IN (?)', [countries.map(country => [country.id])]);

  connection.end();

  return rows;
};

const insertGenres = async (genres) => {
  if (!genres || !genres.length) {
    return false;
  }

  const connection = await mysql.createConnection(mysqlConfig);

  await connection.query('INSERT IGNORE `kp-genre` (kp_id, name) VALUES ?', [genres.map(genre => [genre.id, genre.name])]);
  const [rows] = await connection.query('SELECT id FROM `kp-genre` WHERE kp_id IN (?)', [genres.map(genre => [genre.id])]);

  connection.end();

  return rows;
};

const insertPeople = async (people) => {
  if (!people || !people.length) {
    return false;
  }

  const connection = await mysql.createConnection(mysqlConfig);

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

  connection.end();

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
  const connection = await mysql.createConnection(mysqlConfig);

  try {
    await connection.beginTransaction();

    film.countries && film.countries.length
    && await connection.query('INSERT IGNORE `movie_country` (movie_id, country_id) VALUES ?', [film.countries.map(country => [film.my_id, country.id])]);

    film.genres && film.genres.length
    && await connection.query('INSERT IGNORE `movie_kp-genre` (movie_id, `kp-genre_id`) VALUES ?', [film.genres.map(genre => [film.my_id, genre.id])]);

    film.staff && film.staff.length
    && await connection.query('INSERT IGNORE `movie_people` (movie_id, people_id, group_id, `order`, description) VALUES ?', [film.staff.map((person, index) => [film.my_id, person.id, person.group_id, index, person.description])]);

    await connection.query('UPDATE movie SET ? WHERE id = ?', [{
      kp_id              : film.id,
      kp_title           : film.title,
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
      kp_check_date      : new Date()
    }, film.my_id]);

    await connection.commit();

    connection.end();

    console.log('film "' + film.title + ' - ' + film.my_id + '" updated');
  } catch (err) {
    await connection.rollback();
    connection.end();
    console.log(err);
  }
};

const insertError = async (filmId, error) => {
  const connection = await mysql.createConnection(mysqlConfig);

  await connection.query('UPDATE movie SET ? WHERE id = ?', [{kp_error: error, kp_check_date: new Date()}, filmId]);

  connection.end();

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

      const {id, original_title, year, kp_id: dbKpId} = result[0];

      kpSearch(original_title, year).then(kpId => {
        if (!kpId && !dbKpId) {
          insertError(id, 'not_found')
            .then(() => worker(mainResolve))
            .catch(err => console.error(err));
        } else {
          Promise.all([id, getFilm(kpId || dbKpId), getFilmStaff(kpId || dbKpId)]).then(([my_id, film, staff]) => {
            film.my_id = my_id;

            const countriesReady = insertCountries(film.countries);
            const genresReady = insertGenres(film.genres);
            const peopleReady = insertPeople(staff);

            Promise.all([film, countriesReady, genresReady, peopleReady])
              .then(([film, countries, genres, people]) => {
                film.countries = countries || null;
                film.genres = genres || null;
                film.staff = people || null;

                updateFilm(film).then(() => worker(mainResolve)).catch(err => console.error(err));
              }).catch(err => console.error(err));
          }).catch(err => console.error(err));
        }
      });
    }).catch(err => console.error(err));
  }).catch(err => console.error(err));
};

let workers = [];
for (let i = 0; i < MAX_WORKERS; i++) {
  workers.push(worker());
}

// Promise.all(workers).then(() => {
//   (async function () {
//     console.log('end');
//     sleep(1800000);
//   })();
// }).catch(err => console.error(err));
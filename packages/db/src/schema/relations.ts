import { relations } from 'drizzle-orm/relations';
import {
  movie,
  bookmark,
  user,
  ftFilm,
  ftFilmTorrent,
  ftTorrent,
  ftQuality,
  ftVoice,
  country,
  movieCountry,
  genre,
  movieGenre,
  kpGenre,
  movieKpGenre,
  group,
  moviePeople,
  people,
  movieVote,
} from './schema.js';

export const bookmarkRelations = relations(bookmark, ({ one }) => ({
  movie: one(movie, {
    fields: [bookmark.movieId],
    references: [movie.id],
  }),
  user: one(user, {
    fields: [bookmark.userId],
    references: [user.id],
  }),
}));

export const movieRelations = relations(movie, ({ many }) => ({
  bookmarks: many(bookmark),
  movieCountries: many(movieCountry),
  movieGenres: many(movieGenre),
  movieKpGenres: many(movieKpGenre),
  moviePeople: many(moviePeople),
  movieVotes: many(movieVote),
}));

export const userRelations = relations(user, ({ many }) => ({
  bookmarks: many(bookmark),
  movieVotes: many(movieVote),
}));

export const ftFilmTorrentRelations = relations(ftFilmTorrent, ({ one }) => ({
  ftFilm: one(ftFilm, {
    fields: [ftFilmTorrent.filmId],
    references: [ftFilm.id],
  }),
  ftTorrent: one(ftTorrent, {
    fields: [ftFilmTorrent.torrentId],
    references: [ftTorrent.id],
  }),
}));

export const ftFilmRelations = relations(ftFilm, ({ many }) => ({
  ftFilmTorrents: many(ftFilmTorrent),
}));

export const ftTorrentRelations = relations(ftTorrent, ({ one, many }) => ({
  ftFilmTorrents: many(ftFilmTorrent),
  ftQuality: one(ftQuality, {
    fields: [ftTorrent.quality],
    references: [ftQuality.id],
  }),
  ftVoice: one(ftVoice, {
    fields: [ftTorrent.voice],
    references: [ftVoice.id],
  }),
}));

export const ftQualityRelations = relations(ftQuality, ({ many }) => ({
  ftTorrents: many(ftTorrent),
}));

export const ftVoiceRelations = relations(ftVoice, ({ many }) => ({
  ftTorrents: many(ftTorrent),
}));

export const movieCountryRelations = relations(movieCountry, ({ one }) => ({
  country: one(country, {
    fields: [movieCountry.countryId],
    references: [country.id],
  }),
  movie: one(movie, {
    fields: [movieCountry.movieId],
    references: [movie.id],
  }),
}));

export const countryRelations = relations(country, ({ many }) => ({
  movieCountries: many(movieCountry),
}));

export const movieGenreRelations = relations(movieGenre, ({ one }) => ({
  genre: one(genre, {
    fields: [movieGenre.genreId],
    references: [genre.id],
  }),
  movie: one(movie, {
    fields: [movieGenre.movieId],
    references: [movie.id],
  }),
}));

export const genreRelations = relations(genre, ({ many }) => ({
  movieGenres: many(movieGenre),
}));

export const movieKpGenreRelations = relations(movieKpGenre, ({ one }) => ({
  kpGenre: one(kpGenre, {
    fields: [movieKpGenre.kpGenreId],
    references: [kpGenre.id],
  }),
  movie: one(movie, {
    fields: [movieKpGenre.movieId],
    references: [movie.id],
  }),
}));

export const kpGenreRelations = relations(kpGenre, ({ many }) => ({
  movieKpGenres: many(movieKpGenre),
}));

export const moviePeopleRelations = relations(moviePeople, ({ one }) => ({
  group: one(group, {
    fields: [moviePeople.groupId],
    references: [group.id],
  }),
  movie: one(movie, {
    fields: [moviePeople.movieId],
    references: [movie.id],
  }),
  person: one(people, {
    fields: [moviePeople.peopleId],
    references: [people.id],
  }),
}));

export const groupRelations = relations(group, ({ many }) => ({
  moviePeople: many(moviePeople),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  moviePeople: many(moviePeople),
}));

export const movieVoteRelations = relations(movieVote, ({ one }) => ({
  movie: one(movie, {
    fields: [movieVote.movieId],
    references: [movie.id],
  }),
  user: one(user, {
    fields: [movieVote.userId],
    references: [user.id],
  }),
}));

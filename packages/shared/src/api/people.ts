import type { MovieBase } from './movies.js';

// A person's movie: one entry per (movie, role group), newest first.
export interface PersonMovie extends MovieBase {
  kp_id: number | null;
  kp_rating_value: number;
  imdb_rating_value: number;
  group_id: number;
  group_title: string | null;
}

// GET /api/people/:id: the `people` row as PDO strings (`kp_id` removed) plus the movies.
export interface Person {
  id: string;
  name: string | null;
  original_name: string | null;
  [column: string]: unknown;
  movies: PersonMovie[];
}

export interface PersonResponse {
  success: true;
  person: Person;
}

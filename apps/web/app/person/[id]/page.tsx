import type { Metadata } from 'next';
import { cache } from 'react';

import type { PersonMovie } from '@flicktips/shared';

import { orNotFound, serverApi } from '@/api/server';
import { JsonLd } from '@/components/JsonLd';
import { MoviePreview } from '@/components/movie/MoviePreview';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/config';
import { pageMetadata } from '@/lib/metadata';
import { withShareTags } from '@/lib/share-metadata';

// shared by generateMetadata and the page: one API call per request
const getPerson = cache((id: string) => orNotFound(serverApi.people.get(id)));

// What the page shows about a person: names, photo, career (the role groups) and the movies per group.
async function load(id: string) {
  const { person: row } = await getPerson(id);
  const { movies, ...person } = row;

  const name = person.name || null;
  const originalName = person.original_name && person.original_name !== person.name ? person.original_name : null;
  const photo = typeof person.kp_photo === 'string' && person.kp_photo ? person.kp_photo : null;

  const metaName = name ? name + (originalName ? ` (${originalName})` : '') : originalName || person.original_name;

  // one list per role group, in the order of first appearance for the career line
  const career: string[] = [];
  const groups = new Map<number, { type: string | null; movies: PersonMovie[] }>();
  for (const movie of movies) {
    const group = groups.get(movie.group_id);
    if (group) {
      group.movies.push(movie);
    } else {
      if (movie.group_title) career.push(movie.group_title);
      groups.set(movie.group_id, { type: movie.group_title, movies: [movie] });
    }
  }
  // the legacy sort() compared the stringified [id, group] pairs
  const grouped = [...groups.entries()].sort(([a], [b]) =>
    String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0,
  );

  return { id: person.id, name, originalName, photo, metaName, career, groups: grouped.map(([, group]) => group) };
}

export async function generateMetadata({ params }: PageProps<'/person/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const person = await load(id);
  const title = person.metaName + ' — FlickTips';
  const description =
    person.metaName + '. ' + (person.career.length ? person.career.join(', ') + '. ' : '') + 'Фильмография, фото.';
  const image = person.photo || DEFAULT_OG_IMAGE;

  return withShareTags(
    // the legacy page used og:type video.movie here too
    pageMetadata({ title, description, path: '/person/' + person.id, image, type: 'video.movie' }),
    { image, shareDescription: description },
  );
}

export default async function PersonPage({ params }: PageProps<'/person/[id]'>) {
  const { id } = await params;
  const person = await load(id);

  return (
    <div className="person">
      <JsonLd
        data={{
          '@type': 'Person',
          name: person.name || person.originalName || person.metaName,
          ...(person.name && person.originalName ? { alternateName: person.originalName } : {}),
          url: `${SITE_URL}/person/${person.id}`,
          ...(person.photo ? { image: person.photo } : {}),
          ...(person.career.length ? { jobTitle: person.career } : {}),
        }}
      />

      <div className="person__head">
        <div className="person__head-photo-wrap">
          <div className="person__head-photo">
            {person.photo ? (
              <div style={{ backgroundImage: `url(${person.photo})` }} className="person__head-photo-inn">
                {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup: an invisible img for SEO */}
                <img src={person.photo} alt={person.metaName ?? ''} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="person__head-data">
          {person.name ? <h1 className="person__title">{person.name}</h1> : null}

          {person.name ? (
            <h2 className="person__subtitle">{person.originalName}</h2>
          ) : (
            <h1 className="person__title">{person.originalName}</h1>
          )}

          {person.career.length ? (
            <dl className="person__dl">
              <dt>Карьера</dt>
              <dd>{person.career.join(', ')}</dd>
            </dl>
          ) : null}
        </div>
      </div>

      {person.groups.map((group, key) => (
        <div key={key} className="person__group">
          <div className="person__group-title">{group.type}</div>
          <div className="person__group-list movie-prev-list">
            {group.movies.map((movie, index) => (
              <MoviePreview key={index} movie={movie} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

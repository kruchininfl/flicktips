import type { Metadata } from 'next';
import { cache } from 'react';

import type { PersonMovie } from '@flicktips/shared';

import { orNotFound, serverApi } from '@/api/server';
import { JsonLd } from '@/components/JsonLd';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { PersonFilmography } from '@/components/person/PersonFilmography';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/config';
import { pageMetadata } from '@/lib/metadata';
import { plural } from '@/lib/plural';
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
  const groups = new Map<number, { title: string | null; movies: PersonMovie[] }>();
  for (const movie of movies) {
    const group = groups.get(movie.group_id);
    if (group) {
      group.movies.push(movie);
    } else {
      if (movie.group_title) career.push(movie.group_title);
      groups.set(movie.group_id, { title: movie.group_title, movies: [movie] });
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

// what the viewer's friends thought of the person's movies: how many movies they voted on, the share of likes
function friendsStats(groups: { movies: PersonMovie[] }[]) {
  const seen = new Set<number>();
  let watched = 0;
  let votes = 0;
  let liked = 0;
  for (const group of groups) {
    for (const movie of group.movies) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      if (movie.votes?.length) watched++;
      for (const vote of movie.votes ?? []) {
        votes++;
        if (vote.value >= 2) liked++;
      }
    }
  }
  return { movies: seen.size, watched, liked: votes ? Math.round((100 * liked) / votes) : null };
}

// /person/:id — Figma «Персона»: the name, the career, the counts and the filmography by role
export default async function PersonPage({ params }: PageProps<'/person/[id]'>) {
  const { id } = await params;
  const person = await load(id);
  const stats = friendsStats(person.groups);
  const title = person.name || person.originalName || person.metaName || '';

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
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

      <section className="flex flex-col items-start gap-4 rounded-card border border-ring bg-card p-5 shadow-card sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <UserAvatar src={person.photo} name={title} size={96} className="max-sm:size-20" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="type-h1-mobile break-words sm:type-h1">{title}</h1>
          {(person.name && person.originalName) || person.career.length ? (
            <p className="text-muted-foreground">
              {[person.name ? person.originalName : null, person.career.join(', ').toLowerCase()]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Stat value={stats.movies} label={plural(stats.movies, ['фильм', 'фильма', 'фильмов'])} />
            {stats.watched > 0 && <Stat value={stats.watched} label="смотрели друзья" />}
            {stats.liked !== null && <Stat value={`${stats.liked}%`} label="понравилось" />}
          </div>
        </div>
      </section>

      <PersonFilmography groups={person.groups} />
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

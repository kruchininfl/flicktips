'use client';

import { useState } from 'react';

import type { PersonMovie } from '@flicktips/shared';

import { MovieCard, MovieGrid } from '@/components/film/MovieCard';
import { ToggleCount } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Group {
  title: string | null;
  movies: PersonMovie[];
}

// Figma «Персона» → «Фильмография»: every movie once under «Все», then a chip per role group.
export function PersonFilmography({ groups }: { groups: Group[] }) {
  const [filter, setFilter] = useState('all');

  const all = new Map<number, PersonMovie>();
  for (const group of groups) for (const movie of group.movies) if (!all.has(movie.id)) all.set(movie.id, movie);
  const shown = filter === 'all' ? [...all.values()] : (groups[Number(filter)]?.movies ?? []);

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="type-h2">Фильмография</h2>
        {groups.length > 1 && (
          <ToggleGroup
            type="single"
            variant="chip"
            value={filter}
            onValueChange={(value) => value && setFilter(value)}
            className="-mx-4 w-auto flex-nowrap overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:flex-wrap sm:px-0"
          >
            <ToggleGroupItem value="all">
              Все <ToggleCount>{all.size}</ToggleCount>
            </ToggleGroupItem>
            {groups.map((group, index) => (
              <ToggleGroupItem key={index} value={String(index)}>
                {group.title || 'Другое'} <ToggleCount>{group.movies.length}</ToggleCount>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
      <MovieGrid>
        {shown.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </MovieGrid>
    </section>
  );
}

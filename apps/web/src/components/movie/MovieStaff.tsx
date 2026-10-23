import Link from 'next/link';

import type { StaffGroup } from '@flicktips/shared';

import { LazyLoad } from '@/components/gui/LazyLoad';

// Cast and crew: a horizontal list of people per role group; photos load lazily (web/src/components/MoviePage).
export function MovieStaff({ groups }: { groups: StaffGroup[] }) {
  return groups.map((group, key) =>
    group.people.length ? (
      <div key={key} className="movie__staff-group">
        <div className="movie__staff-group-title">{group.title}</div>
        <div className="movie__staff-group-list">
          {group.people.map((person) => (
            <Link
              href={'/person/' + person.id}
              key={`${person.id}-${person.description ?? ''}`}
              className="movie-person movie-person_details"
            >
              <div className="movie-person__photo">
                {person.photo ? (
                  <LazyLoad>
                    <div style={{ backgroundImage: `url(${person.photo})` }} className="movie-person__photo-inn">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup: an invisible img for SEO */}
                      <img src={person.photo} alt={person.name || person.original_name || ''} />
                    </div>
                  </LazyLoad>
                ) : null}
              </div>

              {person.name ? <div className="movie-person__name">{person.name}</div> : null}
              {person.original_name ? <div className="movie-person__original-name">{person.original_name}</div> : null}
              {person.description ? <div className="movie-person__descr">{person.description}</div> : null}
            </Link>
          ))}
        </div>
      </div>
    ) : null,
  );
}

import Link from 'next/link';

import type { StaffGroup } from '@flicktips/shared';

import { initials } from '@/components/brand/UserAvatar';

// Figma «Режиссёр и актёры»: directors, then the cast, as a row of photo cards that scrolls sideways.
export function People({ groups }: { groups: StaffGroup[] }) {
  const pick = (type: string) => groups.filter((group) => group.type === type).flatMap((group) => group.people);
  const people = [
    ...pick('director').map((person) => ({ ...person, role: 'режиссёр' })),
    ...pick('actor').map((person) => ({ ...person, role: person.description ?? '' })),
  ].slice(0, 16);
  if (!people.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-h2">Режиссёр и актёры</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {people.map((person) => {
          const name = person.name || person.original_name || '';
          return (
            <Link
              key={`${person.id}-${person.role}`}
              href={'/person/' + person.id}
              className="group flex w-[120px] shrink-0 flex-col gap-1 sm:w-[136px]"
            >
              <span className="relative mb-1 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-muted type-h2 text-faint">
                {initials(name)}
                {person.photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- Кинопоиск photos
                  <img
                    src={person.photo}
                    alt={name}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                )}
              </span>
              <span className="line-clamp-2 font-medium group-hover:underline">{name}</span>
              {person.role && <span className="truncate type-caption text-muted-foreground">{person.role}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

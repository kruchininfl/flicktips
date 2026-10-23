'use client';

import { IconCheck, IconDots, IconSearch, IconUserPlus, IconUsers, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import type { CircleResponse, CircleUser, ListedUser, RecommendedUser } from '@flicktips/shared';

import { api } from '@/api/browser';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { ShareDialog } from '@/components/share/ShareDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VOTE_NAMES } from '@/lib/movies';
import { VoteGlyph } from '@/components/votes/votes';
import { yearOf } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';

import { setFollowing } from './follow-store';

type Circle = Omit<CircleResponse, 'success'>;

const votesText = (n: number) => `${n} ${plural(n, ['оценка', 'оценки', 'оценок'])}`;
const commonText = (n: number) => `${n} ${plural(n, ['общий друг', 'общих друга', 'общих друзей'])}`;

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-ring bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="type-h3">{title}</h2>
        {note && <p className="type-caption text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// a person: the avatar and the name link to the profile, the caption under the name, the actions on the right
function Row({
  user,
  caption,
  children,
}: {
  user: { id: number; username: string | null; avatar: string | null };
  caption?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3">
      <Link href={`/user/${user.id}`} className="shrink-0" tabIndex={-1}>
        <UserAvatar src={user.avatar} name={user.username} size={40} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/user/${user.id}`} className="truncate font-medium hover:underline">
          {user.username || 'Без имени'}
        </Link>
        {caption && <div className="truncate type-caption text-muted-foreground">{caption}</div>}
      </div>
      {children}
    </li>
  );
}

function LastVote({ vote }: { vote: CircleUser['last_vote'] }) {
  if (!vote) return <>пока без оценок</>;
  const kind = VOTE_NAMES[vote.vote];
  return (
    <span className="flex min-w-0 items-center gap-1">
      {kind && (
        <span className="shrink-0">
          <VoteGlyph kind={kind} size={12} />
        </span>
      )}
      <span className="truncate">
        <span className="max-sm:hidden">последняя: </span>
        {vote.title}
      </span>
    </span>
  );
}

const matches = (user: { username: string | null }, query: string) =>
  (user.username ?? '').toLowerCase().includes(query.trim().toLowerCase());

interface FriendsProps {
  initial: Circle;
  recommendations: RecommendedUser[];
  // the viewer's invite link, when it could be loaded
  inviteLink: string | null;
}

// Figma «Друзья»: requests, all friends with a search, follows not returned yet, «Возможно, вы знакомы».
// Friends follow each other; accepting a request is following back, declining stores a «no» row.
export function Friends({ initial, recommendations, inviteLink }: FriendsProps) {
  const [circle, setCircle] = useState(initial);
  const [query, setQuery] = useState('');
  const [others, setOthers] = useState<ListedUser[]>([]);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState<Set<number>>(new Set());

  const known = new Set([...circle.friends, ...circle.requests, ...circle.outgoing].map((u) => u.id));
  const friends = circle.friends.filter((user) => matches(user, query));
  const suggested = recommendations.filter((user) => !known.has(user.id) || added.has(user.id));

  // nobody among the friends: look for other people with that name
  const searchOthers = query.trim().length >= 2 && friends.length === 0;
  useEffect(() => {
    if (!searchOthers) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.users
        .search(query.trim())
        .then((response) => !cancelled && setOthers(response.results))
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOthers]);

  // runs a request for one person, then reloads the lists
  const act = async (userId: number, request: () => Promise<unknown>) => {
    if (busy.has(userId)) return;
    setBusy((s) => new Set(s).add(userId));
    try {
      await request();
      const next = await api.me.circle();
      setCircle({ friends: next.friends, requests: next.requests, outgoing: next.outgoing });
    } catch {
      // the error is reported by the API client
    } finally {
      setBusy((s) => {
        const copy = new Set(s);
        copy.delete(userId);
        return copy;
      });
    }
  };

  const follow = (userId: number, subscribed: boolean) =>
    act(userId, async () => {
      const response = await api.me.subscribe(userId, subscribed);
      setFollowing(response.userId, response.subscribed);
      if (subscribed) setAdded((s) => new Set(s).add(userId));
    });

  const count = circle.friends.length;
  const requests = circle.requests.length;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1-mobile sm:type-h1">Друзья</h1>
          <p className="text-muted-foreground">
            {count
              ? `${count} ${plural(count, ['друг', 'друга', 'друзей'])} · видите их оценки в ленте и на страницах фильмов`
              : 'Друзья видят оценки друг друга в ленте и на страницах фильмов'}
          </p>
        </div>
        {inviteLink && (
          <ShareDialog
            title="Пригласите друзей"
            description="Отправьте личную ссылку — когда друг войдёт по ней, вы подпишетесь друг на друга."
            link={inviteLink}
            text="Делюсь оценками фильмов на FlickTips — подписывайся!"
          >
            <Button className="self-start sm:self-auto">
              <IconUserPlus />
              Пригласить друга
            </Button>
          </ShareDialog>
        )}
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {requests > 0 && (
            <Card
              title="Заявки в друзья"
              note={`${requests} ${plural(requests, ['человек хочет', 'человека хотят', 'человек хотят'])} видеть ваши оценки`}
            >
              <ul className="flex flex-col gap-2">
                {circle.requests.map((user) => (
                  <Row
                    key={user.id}
                    user={user}
                    caption={[user.common_friends ? commonText(user.common_friends) : '', votesText(user.votes_count)]
                      .filter(Boolean)
                      .join(' · ')}
                  >
                    <Button
                      size="s"
                      className="max-sm:hidden"
                      disabled={busy.has(user.id)}
                      onClick={() => void follow(user.id, true)}
                    >
                      Принять
                    </Button>
                    <Button
                      size="s"
                      variant="ghost"
                      className="max-sm:hidden"
                      disabled={busy.has(user.id)}
                      onClick={() => void act(user.id, () => api.me.declineRequest(user.id))}
                    >
                      Отклонить
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="sm:hidden"
                      aria-label="Принять"
                      disabled={busy.has(user.id)}
                      onClick={() => void follow(user.id, true)}
                    >
                      <IconCheck />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="sm:hidden"
                      aria-label="Отклонить"
                      disabled={busy.has(user.id)}
                      onClick={() => void act(user.id, () => api.me.declineRequest(user.id))}
                    >
                      <IconX />
                    </Button>
                  </Row>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Все друзья">
            {count > 0 && (
              <label className="flex h-10 items-center gap-2 rounded-md bg-input px-3 focus-within:ring-[3px] focus-within:ring-brand-line">
                <IconSearch className="size-4 shrink-0 text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Имя или ник"
                  aria-label="Поиск по друзьям"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
                />
              </label>
            )}

            {count === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <IconUsers className="size-8 text-faint" />
                <p className="max-w-[420px] text-muted-foreground">
                  Друзей пока нет. Пригласите знакомых по ссылке или подпишитесь на кого-нибудь справа: когда он
                  подпишется в ответ, вы станете друзьями.
                </p>
              </div>
            )}

            {friends.length > 0 && (
              <ul className="flex flex-col gap-2">
                {friends.map((user) => (
                  <Row key={user.id} user={user} caption={<LastVote vote={user.last_vote} />}>
                    <span className="type-caption whitespace-nowrap text-faint max-lg:hidden">
                      {votesText(user.votes_count)}
                    </span>
                    {user.match !== null && (
                      <Badge status="accent" dot={false}>
                        совпадение {user.match}%
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Действия" className="max-sm:hidden">
                          <IconDots />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/user/${user.id}`}>Открыть профиль</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onSelect={() => void follow(user.id, false)}>
                          Удалить из друзей
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Row>
                ))}
              </ul>
            )}

            {count > 0 && friends.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="type-caption text-muted-foreground">
                  {searchOthers && others.length ? 'Среди друзей нет, но есть на FlickTips:' : 'Никого не нашли'}
                </p>
                {searchOthers && others.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {others.map((user) => (
                      <Row key={user.id} user={user}>
                        <FollowIcon
                          followed={user.subscribed || known.has(user.id)}
                          busy={busy.has(user.id)}
                          onClick={() => void follow(user.id, true)}
                        />
                      </Row>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          {circle.outgoing.length > 0 && (
            <Card title="Ждут ответа" note="Вы подписаны, они пока нет. Станете друзьями, когда они подпишутся в ответ">
              <ul className="flex flex-col gap-2">
                {circle.outgoing.map((user) => (
                  <Row key={user.id} user={user} caption={votesText(user.votes_count)}>
                    <Button
                      size="s"
                      variant="ghost"
                      disabled={busy.has(user.id)}
                      onClick={() => void follow(user.id, false)}
                    >
                      Отписаться
                    </Button>
                  </Row>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {suggested.length > 0 && (
          <Card title="Возможно, вы знакомы" note="По общим друзьям и похожим оценкам">
            <ul className="flex flex-col gap-2">
              {suggested.map((user) => (
                <Row key={user.id} user={user} caption={reasonText(user)}>
                  <FollowIcon
                    followed={added.has(user.id)}
                    busy={busy.has(user.id)}
                    onClick={() => void follow(user.id, true)}
                  />
                </Row>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function reasonText(user: RecommendedUser): string {
  if (user.reason === 'friends' && user.reason_count) return commonText(user.reason_count);
  if (user.reason === 'votes' && user.reason_count) {
    return `${user.reason_count} ${plural(user.reason_count, ['такая же оценка', 'такие же оценки', 'таких же оценок'])}`;
  }
  const since = yearOf(user.registration_date);
  return since ? `На FlickTips с ${since} года` : '';
}

function FollowIcon({ followed, busy, onClick }: { followed: boolean; busy: boolean; onClick: () => void }) {
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn('shrink-0', followed && 'text-positive')}
      aria-label={followed ? 'Вы подписаны' : 'Подписаться'}
      title={followed ? 'Вы подписаны' : 'Подписаться'}
      disabled={busy || followed}
      onClick={onClick}
    >
      {followed ? <IconCheck /> : <IconUserPlus />}
    </Button>
  );
}

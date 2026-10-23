'use client';

import { useState } from 'react';

import type { Paged, UserVoteMovie } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { PagePlaceholder } from '@/components/gui/PagePlaceholder';
import { useMovieState } from '@/components/movie/useMovieState';
import { MoviePreview } from '@/components/movie/MoviePreview';
import { timeAgo } from '@/lib/dates';
import { pluralGender } from '@/lib/gender';

interface ProfileVotesProps {
  userId: number;
  username: string | null;
  gender: string | null;
  isMyPage: boolean;
  initial: Paged<UserVoteMovie>;
  // server time in ms: the group headings ("2 дня назад") are computed from it on both sides
  now: number;
}

function VoteItem({ movie, isMyPage }: { movie: UserVoteMovie; isMyPage: boolean }) {
  const state = useMovieState(movie);
  const active = state.isSuper || state.isLiked || state.isDisliked || state.isNeutral;

  return (
    <MoviePreview
      votesFilter={0}
      movie={state}
      className={'profile__votes-item' + (isMyPage && !active ? ' m-inactive' : '')}
    />
  );
}

// A user's votes grouped by "how long ago", with the "Показать еще" paging.
export function ProfileVotes({ userId, username, gender, isMyPage, initial, now }: ProfileVotesProps) {
  const [votes, setVotes] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleLoadData = () => {
    if (loading) return;
    setLoading(true);
    api.users
      .votes(userId, { page: votes.page + 1 })
      .then(({ results }) => setVotes({ ...results, entities: [...votes.entities, ...results.entities] }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  if (!votes.total) {
    const text = isMyPage
      ? 'У вас пока нет оценок'
      : `${username || 'Пользователь'} пока не ${pluralGender(gender, ['ставил', 'ставила', 'ставил(а)'])} оценок`;
    return <PagePlaceholder icon="star" text={text} />;
  }

  const durations: string[] = [];
  const items = votes.entities.flatMap((entity, key) => {
    const duration = timeAgo(Number(entity.timestamp) * 1000, now);
    const out = [];

    // group headings are separate list items so they span a whole grid row above their cards
    if (!durations.includes(duration)) {
      durations.push(duration);
      out.push(
        <div key={'group-' + key} className="profile__votes-group">
          {duration}
        </div>,
      );
    }
    out.push(<VoteItem key={entity.id} movie={entity} isMyPage={isMyPage} />);
    return out;
  });

  return (
    <>
      <div className="profile__votes movie-prev-list">{items}</div>

      {votes.pages > votes.page ? (
        <Button onClick={handleLoadData} loading={loading} className="btn_more">
          Показать еще
        </Button>
      ) : null}
    </>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { FilmVote } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { Modal } from '@/components/gui/Modal';
import { Userpic } from '@/components/gui/Userpic';
import { VoteIcon } from '@/components/gui/VoteIcon';
import { formatLongDate } from '@/lib/dates';
import { VOTE_NAMES, VOTE_TEXTS } from '@/lib/movies';

import { useMovieState } from './useMovieState';

// 'YYYY-MM-DD HH:MM:SS' as the API stores it (Moscow time)
const voteDate = (timestamp: string) => formatLongDate(Date.parse(timestamp.replace(' ', 'T') + '+03:00'));

interface MovieVotesPopupProps {
  movieId: number;
  super: number;
  likes: number;
  neutral: number;
  dislikes: number;
}

// «Все оценки (N)» and the popup listing every vote of the movie (web/src/components/MoviePage/MovieVotes).
// The votes are requested each time the popup opens.
export function MovieVotesPopup({ movieId, ...counters }: MovieVotesPopupProps) {
  const movie = useMovieState({ id: movieId, ...counters });
  const total = movie.super + movie.likes + movie.neutral + movie.dislikes;
  const [loading, setLoading] = useState(false);
  const [votes, setVotes] = useState<FilmVote[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const response = await api.movies.votes(movieId);
      setVotes(response.votes);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  };
  const close = () => setIsOpen(false);

  return (
    <>
      {total > 0 ? (
        <Button onClick={() => void open()} size="big" color="blue" variant="border" loading={loading}>
          Все оценки ({total})
        </Button>
      ) : (
        <Button size="big" color="gray" variant="border" disabled>
          Нет оценок
        </Button>
      )}

      <Modal isOpen={isOpen && votes.length > 0} onRequestClose={close} className="p-votes" contentLabel="Movie votes">
        <Icon name="cross" onClick={close} className="ReactModal__Close m-white" />

        <div className="p-votes__content">
          {votes.map((vote) => (
            <div key={vote.id} className="vote-details">
              <Link
                onClick={close}
                className={'link vote-details__user' + (vote.user.isFriend ? ' m-friend' : '')}
                href={'/user/' + vote.user.id}
              >
                <Userpic avatar={vote.user.avatar} size="big" />
                <div className="vote-details__user__name">{vote.user.username}</div>
              </Link>

              <div className={'vote-details__value m-' + VOTE_NAMES[vote.vote]}>
                <VoteIcon vote={vote.vote} active />
                <span>{VOTE_TEXTS[vote.vote]}</span>
              </div>

              <div className="vote-details__date">{voteDate(vote.timestamp)}</div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

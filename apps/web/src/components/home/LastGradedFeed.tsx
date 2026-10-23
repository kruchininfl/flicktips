'use client';

import { useState } from 'react';

import type { FeedResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { InviteButton } from '@/components/invite/InviteButton';
import { MovieHero } from '@/components/movie/MovieHero';
import { MoviePreview } from '@/components/movie/MoviePreview';
import { useUi } from '@/components/shell/UiProvider';

type Results = FeedResponse['results'];

interface LastGradedFeedProps {
  // the first page, loaded on the server (the friends' feed for signed-in visitors, as the legacy page did)
  initial: Results;
  initialOnlyFriends: boolean;
}

function EmptyPage({ onlyFriends }: { onlyFriends: boolean }) {
  if (onlyFriends) {
    return (
      <div className="page-ph">
        <div className="page-ph__icn">
          <Icon name="list" />
        </div>
        <div className="page-ph__text">
          К сожалению, ваши друзья пока не оценивали фильмы и сериалы. <br />
          <br />
          Расскажите друзьям о нашем приложении, чтобы знать какие фильмы им понравились.
        </div>
        <br />
        <InviteButton />
      </div>
    );
  }

  return (
    <div className="page-ph">
      <div className="page-ph__icn">
        <Icon name="list" />
      </div>
      <div className="page-ph__text">К сожалению, на данный момент нет оценок</div>
    </div>
  );
}

// The home page (web/src/components/LastGradedPage): the "friends / all" switch, the latest vote as a hero, the
// rest as cards, "Показать еще". The server data is the starting point; the switch and paging re-request the feed.
export function LastGradedFeed({ initial, initialOnlyFriends }: LastGradedFeedProps) {
  const { startLoading, doneLoading } = useUi();
  const [state, setState] = useState({ initial, onlyFriends: initialOnlyFriends, results: initial });
  const [loading, setLoading] = useState(false);

  // fresh server data (the viewer toggled "hide viewed", signed in or out): start over from it
  if (state.initial !== initial) {
    setState({ initial, onlyFriends: initialOnlyFriends, results: initial });
  }

  const { onlyFriends, results } = state;
  const [first, ...rest] = results.entities;

  const load = (friends: boolean, page: number) => (friends ? api.feed.friends(page) : api.feed.lastGraded(page));

  const handleFilter = async (friends: boolean) => {
    if (friends === onlyFriends) return;
    startLoading();
    try {
      // a guest asking for the friends' feed gets the sign-in popup (401) and stays where they are
      const response = await load(friends, 1);
      setState((s) => ({ ...s, onlyFriends: friends, results: response.results }));
    } catch {
      // the error is reported by the API client
    } finally {
      doneLoading();
    }
  };

  const handleLoadData = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // page N returns the first N pages at once
      const response = await load(onlyFriends, results.page + 1);
      setState((s) => ({ ...s, results: response.results }));
    } catch {
      // the error is reported by the API client
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="lg-header">
        <div className="segmented">
          <span
            onClick={() => void handleFilter(true)}
            className={'segmented__item' + (onlyFriends ? ' m-active' : '')}
          >
            Друзья
          </span>
          <span
            onClick={() => void handleFilter(false)}
            className={'segmented__item' + (onlyFriends ? '' : ' m-active')}
          >
            Все оценки
          </span>
        </div>
      </div>

      {first ? <MovieHero movie={first} label={onlyFriends ? 'Свежая оценка друзей' : 'Свежая оценка'} /> : null}

      {first ? (
        <div className="lg-list movie-prev-list">
          {rest.map((movie) => (
            <MoviePreview key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <EmptyPage onlyFriends={onlyFriends} />
      )}

      {results.page < results.pages ? (
        <Button onClick={() => void handleLoadData()} loading={loading} className="btn_more">
          Показать еще
        </Button>
      ) : null}
    </div>
  );
}

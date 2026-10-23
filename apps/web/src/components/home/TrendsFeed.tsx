'use client';

import type { TrendsResponse } from '@flicktips/shared';

import { Button } from '@/components/gui/Button';
import { Icon } from '@/components/gui/Icon';
import { MoviePreview } from '@/components/movie/MoviePreview';
import { useUi } from '@/components/shell/UiProvider';
import { useViewer } from '@/viewer/ViewerProvider';

// The popular movies list (web/src/components/TrendsPage). The legacy router has no route for it and the API
// returns the trends in one page, so it has no "Показать еще" now; kept for parity until it is routed again.
export function TrendsFeed({ results }: { results: TrendsResponse['results'] }) {
  const viewer = useViewer();
  const { openSignIn } = useUi();

  return (
    <div className="home-page">
      {!viewer ? (
        <div className="about-ttip">
          <div className="about-ttip__inn">
            <div className="about-ttip__title">ЛЮБИШЬ ХОРОШЕЕ КИНО?</div>
            <div className="about-ttip__icons">
              <Icon name="friends" className="about-ttip__icon" />
              <Icon name="heart-like-fill" className="about-ttip__icon" />
              <Icon name="film" className="about-ttip__icon" />
            </div>
            <div className="about-ttip__text">
              Смотри и оценивай фильмы.
              <br />
              Следи за оценками друзей.
            </div>
            <Button onClick={openSignIn} className="about-ttip__btn" color="blue">
              Присоединиться
            </Button>
          </div>
        </div>
      ) : null}
      <h1 className="title">Популярные фильмы</h1>

      <div className="movie-prev-list">
        {results.total ? results.entities.map((movie) => <MoviePreview key={movie.id} movie={movie} />) : null}
      </div>
    </div>
  );
}

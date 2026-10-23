import { cx } from '@/lib/cx';

import './MovieStatExternal.scss';

function modClass(value: number | null | undefined) {
  if (!value) return 'm-na';
  if (value >= 6.8) return 'm-high';
  if (value >= 6) return 'm-medium';
  return value > 0 ? 'm-low' : 'm-na';
}

interface MovieStatExternalProps {
  kpValue?: number | null;
  imdbValue?: number | null;
  // 'm-prev' on cards
  className?: string;
}

// Кинопоиск and IMDb ratings with their logos (web/src/partitions/MovieStatExternal).
export function MovieStatExternal({ kpValue, imdbValue, className }: MovieStatExternalProps) {
  if (kpValue === undefined && imdbValue === undefined) return null;

  return (
    <div className={cx('movie-eStat', className)}>
      <div className="movie-eStat__item">
        <i className="movie-eStat__item-icn m-kp" />
        <div className={'movie-eStat__item-val ' + modClass(kpValue)}>{kpValue ? kpValue.toFixed(1) : 'N/A'}</div>
      </div>
      <div className="movie-eStat__item">
        <i className="movie-eStat__item-icn m-imdb" />
        <div className={'movie-eStat__item-val ' + modClass(imdbValue)}>{imdbValue ? imdbValue.toFixed(1) : 'N/A'}</div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';

import type { SearchResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Icon } from '@/components/gui/Icon';
import { Spinner } from '@/components/gui/Spinner';
import { MoviePreview } from '@/components/movie/MoviePreview';

import { useUi } from './UiProvider';
import './HeaderSearch.scss';

const MIN_QUERY_LENGTH = 2;

// Movie search in the header (web/src/partitions/HeaderSearch): opened from the header and the phone tab bar.
export function HeaderSearch() {
  const { searchOpen, openSearch, closeSearch } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  // focus in the same tick as the click, otherwise mobile browsers don't show the keyboard
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const clear = () => {
    clearTimeout(timer.current);
    request.current?.abort();
    setPending(false);
    setResponse(null);
  };

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length <= MIN_QUERY_LENGTH) {
      clear();
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setPending(true);
      api.movies
        .search(value)
        .then((result) => {
          if (!controller.signal.aborted) setResponse(result);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 500);
  };

  const closeForce = () => {
    closeSearch();
    clear();
    setQuery('');
  };

  // a click on a result's link closes the search; clicks elsewhere in a card (votes, bookmark) don't
  const handleResultClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('a')) closeForce();
  };

  const renderResults = () => {
    if (response && response.total) {
      return response.results.map((movie) => (
        <div onClick={handleResultClick} key={movie.id} className="header-search__result-item">
          <MoviePreview votesFilter={0} movie={movie} />
        </div>
      ));
    }
    if (response && query.length > MIN_QUERY_LENGTH && !pending) {
      return <div className="header-search__result-empty">По вашему запросу ничего не найдено.</div>;
    }
    return null;
  };

  return (
    <div className="header__right-item">
      <div className="header-search">
        <div onClick={openSearch} className="header-search__toggle">
          <Icon name="loupe" />
          <span className="header-search__toggle-text">Поиск</span>
        </div>
        <div className={'header-search__container' + (searchOpen ? ' m-opened' : '')}>
          <div className="header-search__head">
            <input
              ref={input}
              value={query}
              onChange={handleQueryChange}
              className="header-search__head-input"
              type="text"
              placeholder="Фильм или сериал"
            />
            <Spinner className="header-search__head-spinner" active={pending} size="small" />
            <Icon name="loupe" className="header-search__head-icn" />
            <Icon name="cross" className="header-search__head-cross" onClick={closeForce} />
          </div>

          <div onClick={closeForce} className="header-search__result-wrap overlay">
            <div onClick={(e) => e.stopPropagation()} className="header-search__result">
              {renderResults()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

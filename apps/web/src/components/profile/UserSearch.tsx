'use client';

import { useEffect, useRef, useState } from 'react';

import type { ListedUser } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Icon } from '@/components/gui/Icon';

import { FriendsList } from './FriendsList';

const DEBOUNCE_MS = 300;

// Finds FlickTips users by name
export function UserSearch() {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // only the latest request may set the results
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text: string) => {
    const request = ++latest.current;
    setQuery(text);

    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.users
      .search(text.trim())
      .then((response) => response.results)
      .catch((): ListedUser[] => [])
      .then((found) => {
        if (request !== latest.current) return;
        setResults(found);
        setLoading(false);
      });
  };

  const handleChange = (text: string) => {
    setValue(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(text), DEBOUNCE_MS);
  };

  const renderResults = () => {
    if (query.trim().length < 2) return null;
    if (!results.length) return loading ? null : <div className="user-search__empty">Никого не нашли</div>;
    return <FriendsList users={results} />;
  };

  return (
    <div className="user-search">
      <div className="user-search__field">
        <Icon name="loupe" className="user-search__icn" />
        <input
          className="user-search__input"
          type="search"
          placeholder="Найти друзей по имени"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
      {renderResults()}
    </div>
  );
}

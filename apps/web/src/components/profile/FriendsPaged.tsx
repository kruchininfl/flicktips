'use client';

import { useState } from 'react';

import type { FriendsType, ListedUser, Paged } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';

import { FriendsList } from './FriendsList';

// The following / followers list with the "Показать еще" paging.
export function FriendsPaged({ type, initial }: { type: FriendsType; initial: Paged<ListedUser> }) {
  const [response, setResponse] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleLoadData = () => {
    if (loading) return;
    setLoading(true);
    api.me
      .friends({ type, page: response.page + 1 })
      .then(({ results }) => setResponse({ ...results, entities: [...response.entities, ...results.entities] }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <FriendsList users={response.entities} />

      {response.pages > response.page ? (
        <Button onClick={handleLoadData} loading={loading} className="btn_more">
          Показать еще
        </Button>
      ) : null}
    </div>
  );
}

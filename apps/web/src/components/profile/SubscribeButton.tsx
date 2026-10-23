'use client';

import { useState } from 'react';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { useUi } from '@/components/shell/UiProvider';
import { useViewer } from '@/viewer/ViewerProvider';

import { setFollowing, useFollowing } from './follow-store';

interface SubscribeButtonProps {
  userId: number;
  subscribed: boolean;
}

// Follow / unfollow a user. Guests get the sign-in popup instead.
export function SubscribeButton({ userId, subscribed: initial }: SubscribeButtonProps) {
  const viewer = useViewer();
  const { openSignIn } = useUi();
  const subscribed = useFollowing(userId, initial);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (!viewer) {
      openSignIn();
      return;
    }
    if (loading) return;

    setLoading(true);
    api.me
      .subscribe(userId, !subscribed)
      .then((response) => setFollowing(response.userId, response.subscribed))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  return (
    <Button loading={loading} color={subscribed ? 'light-gray' : 'green'} onClick={handleClick}>
      {subscribed ? 'отписаться' : 'подписаться'}
    </Button>
  );
}

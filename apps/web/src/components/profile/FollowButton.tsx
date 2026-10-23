'use client';

import { IconCheck, IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { api } from '@/api/browser';
import { useUi } from '@/components/shell/UiProvider';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/viewer/ViewerProvider';

import { setFollowing, useFollowing } from './follow-store';

interface FollowButtonProps {
  userId: number;
  subscribed: boolean;
  followsMe: boolean;
}

// Follow / unfollow on someone's profile: friends are people who follow each other, so a follower is offered
// «Добавить в друзья». Guests get the sign-in popup instead.
export function FollowButton({ userId, subscribed: initial, followsMe }: FollowButtonProps) {
  const viewer = useViewer();
  const { openSignIn } = useUi();
  const subscribed = useFollowing(userId, initial);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
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

  if (subscribed) {
    return (
      <Button variant="outline" disabled={loading} onClick={toggle} title="Отписаться">
        <IconCheck />
        {followsMe ? 'Вы друзья' : 'Вы подписаны'}
      </Button>
    );
  }
  return (
    <Button variant="brand" disabled={loading} onClick={toggle}>
      <IconUserPlus />
      {followsMe ? 'Добавить в друзья' : 'Подписаться'}
    </Button>
  );
}

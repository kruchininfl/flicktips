'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';

export function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const handleAccept = () => {
    if (accepting) return;
    setAccepting(true);
    api.me
      .acceptInvite(code)
      .then(({ inviterId }) => router.push('/user/' + inviterId))
      .catch(() => setAccepting(false));
  };

  return (
    <Button color="green" loading={accepting} onClick={handleAccept} className="p-invite__btn">
      Стать друзьями
    </Button>
  );
}

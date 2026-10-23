'use client';

import { IconUsers } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/api/browser';
import { Button } from '@/components/ui/button';

// a signed-in visitor on someone's invite: follow each other, then their profile
export function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const accept = () => {
    if (accepting) return;
    setAccepting(true);
    api.me
      .acceptInvite(code)
      .then(({ inviterId }) => router.push('/user/' + inviterId))
      .catch(() => setAccepting(false));
  };

  return (
    <Button variant="brand" className="w-full" disabled={accepting} onClick={accept}>
      <IconUsers />
      Стать друзьями
    </Button>
  );
}

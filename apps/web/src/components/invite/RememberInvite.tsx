'use client';

import { useEffect } from 'react';

import { rememberInvite } from '@/lib/remembered';
import { useViewer } from '@/viewer/ViewerProvider';

// Guests accept the invite after signing in (components/shell/PendingActions).
export function RememberInvite({ code }: { code: string }) {
  const viewer = useViewer();
  const signedIn = !!viewer;

  useEffect(() => {
    if (!signedIn) rememberInvite(code);
  }, [signedIn, code]);

  return null;
}

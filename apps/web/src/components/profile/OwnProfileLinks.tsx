'use client';

import Link from 'next/link';

import { canUseTelegram, TelegramButton } from '@/components/telegram/TelegramButton';
import { useViewer } from '@/viewer/ViewerProvider';

// Own page: on desktop these are in the header user menu, which phones do not have.
export function OwnProfileLinks() {
  const telegram = canUseTelegram(useViewer());

  return (
    <div className="profile__relation profile__phone-only">
      <Link href="/profile/accounts/" className="profile__accounts-link">
        Способы входа
      </Link>
      {telegram ? <span className="profile__links-sep">·</span> : null}
      <TelegramButton className="profile__accounts-link" />
    </div>
  );
}

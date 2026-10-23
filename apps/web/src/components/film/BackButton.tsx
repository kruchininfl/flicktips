'use client';

import { IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

// «Назад»: the previous page of the site, or the feed when the page was opened directly.
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="s"
      className="self-start"
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
    >
      <IconArrowLeft />
      Назад
    </Button>
  );
}

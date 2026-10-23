import { IconMovieOff } from '@tabler/icons-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata = { title: { absolute: 'Страница не найдена — FlickTips' }, robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[740px] flex-col items-center gap-4 rounded-card border border-ring bg-card px-6 py-16 text-center shadow-card lg:mt-6">
      <IconMovieOff className="size-10 text-faint" />
      <h1 className="type-h2">Страница не найдена</h1>
      <p className="max-w-[420px] text-muted-foreground">
        Возможно, ссылка устарела или в ней опечатка. Фильмы и оценки друзей ждут в ленте.
      </p>
      <Button variant="outline" asChild>
        <Link href="/">В ленту</Link>
      </Button>
    </div>
  );
}

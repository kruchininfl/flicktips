import { IconBookmark, IconBrandTelegram, IconFlame, IconUsers, type Icon } from '@tabler/icons-react';
import Link from 'next/link';

import { Mark } from '@/components/brand/Logo';
import { InviteDialogButton } from '@/components/invite/InviteDialogButton';
import { Button } from '@/components/ui/button';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata({ title: 'О Проекте — FlickTips', path: '/about' });

const FEATURES: { icon: Icon; title: string; text: string }[] = [
  {
    icon: IconFlame,
    title: 'Четыре оценки',
    text: 'Супер, Нравится, Так себе, Не нравится. Без десятибалльной шкалы.',
  },
  { icon: IconUsers, title: 'Лента друзей', text: 'Видно, что посмотрели друзья и что им понравилось.' },
  { icon: IconBrandTelegram, title: 'Telegram-группа', text: 'Бот публикует оценки в ваш общий чат.' },
  {
    icon: IconBookmark,
    title: 'Закладки',
    text: 'Сохраняйте фильмы на потом и смотрите, кому из друзей они понравились.',
  },
];

// /about — Figma «О проекте»
export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section className="flex flex-col items-start gap-4 overflow-hidden rounded-card border border-ring bg-card [background-image:radial-gradient(ellipse_520px_180px_at_0%_100%,var(--accent-tint),transparent)] p-6 shadow-card sm:p-10">
        <span className="inline-flex items-center gap-1.5">
          <Mark />
          <span className="type-logo">
            flick<span className="text-brand-text">tips</span>
          </span>
        </span>
        <h1 className="type-h1-mobile sm:type-h1">Кино, которое советуют друзья</h1>
        <p className="max-w-[580px] type-large text-muted-foreground">
          FlickTips собирает оценки ваших друзей в одну ленту. Вместо рейтинга незнакомцев — мнение людей, вкусу которых
          вы доверяете.
        </p>
        <div className="flex flex-wrap gap-2">
          <InviteDialogButton />
          <Button variant="outline" asChild>
            <Link href="/telegram">
              <IconBrandTelegram />
              Telegram-бот
            </Link>
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 sm:gap-6">
        <h2 className="type-h2">Как это работает</h2>
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
            <li
              key={title}
              className="flex flex-col items-start gap-3 rounded-card border border-ring bg-card p-5 shadow-card"
            >
              <span className="flex size-10 items-center justify-center rounded-md bg-brand-tint text-brand-text">
                <FeatureIcon className="size-5" />
              </span>
              <h3 className="type-h3">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

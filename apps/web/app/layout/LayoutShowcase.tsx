'use client';

import { IconBookmark, IconPlayerPlay, IconShare } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';

import { Logo } from '@/components/brand/Logo';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleCount } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VoteButton } from '@/components/votes/VoteButton';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph, type VoteKind } from '@/components/votes/votes';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-ring bg-card p-6 shadow-card">
      <h2 className="mb-1 type-h2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

// /layout: the redesign's UI kit (Figma page «Основа и компоненты»), to check the components in both themes.
export function LayoutShowcase() {
  const [vote, setVote] = useState<VoteKind | null>('super');
  const [filter, setFilter] = useState<VoteKind | 'all'>('all');
  const [tab, setTab] = useState('friends');
  const [on, setOn] = useState(true);

  return (
    <div className="flex max-w-[960px] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="type-h1-mobile sm:type-h1">Компоненты</h1>
        <p className="text-muted-foreground">Основа нового дизайна. Тема переключается луной в сайдбаре.</p>
      </div>

      <Section title="Логотип и аватары">
        <Row>
          <Logo />
          {([24, 32, 40, 96] as const).map((size) => (
            <UserAvatar key={size} src={null} name="Артём Кручинин" size={size} />
          ))}
        </Row>
      </Section>

      <Section title="Кнопки">
        {(['m', 's'] as const).map((size) => (
          <Row key={size}>
            <Button size={size}>Основная</Button>
            <Button size={size} variant="outline">
              <IconBookmark />В закладки
            </Button>
            <Button size={size} variant="outline">
              <IconPlayerPlay />
              Трейлер
            </Button>
            <Button size={size} variant="ghost">
              Призрак
            </Button>
            <Button size={size} variant="brand">
              <IconShare />
              Поделиться
            </Button>
          </Row>
        ))}
      </Section>

      <Section title="Вкладки и фильтры">
        <Row>
          <ToggleGroup type="single" variant="tab" value={tab} onValueChange={(value) => value && setTab(value)}>
            <ToggleGroupItem value="friends">Друзья</ToggleGroupItem>
            <ToggleGroupItem value="all">Все оценки</ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <ToggleGroup
          type="single"
          variant="chip"
          value={filter}
          onValueChange={(value) => value && setFilter(value as VoteKind | 'all')}
        >
          <ToggleGroupItem value="all">
            Все <ToggleCount>48</ToggleCount>
          </ToggleGroupItem>
          {VOTE_KINDS.map((kind, index) => (
            <ToggleGroupItem key={kind} value={kind}>
              <VoteGlyph kind={kind} />
              {VOTE_LABELS[kind]} <ToggleCount>{[12, 20, 9, 7][index]}</ToggleCount>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>

      <Section title="Оценки">
        {(['l', 'm', 's'] as const).map((size) => (
          <Row key={size}>
            {VOTE_KINDS.map((kind, index) => (
              <VoteButton
                key={kind}
                kind={kind}
                size={size}
                count={[14, 23, 4, 1][index]}
                selected={vote === kind}
                onClick={() => setVote(vote === kind ? null : kind)}
              />
            ))}
          </Row>
        ))}
      </Section>

      <Section title="Бейджи и переключатель">
        <Row>
          <Badge status="positive">Подключён</Badge>
          <Badge status="warning">Нужна настройка</Badge>
          <Badge status="destructive">Ошибка</Badge>
          <Badge status="accent">Работает</Badge>
          <Badge status="neutral">Импортировано 214</Badge>
          <Switch checked={on} onCheckedChange={setOn} aria-label="Пример" />
        </Row>
      </Section>
    </div>
  );
}

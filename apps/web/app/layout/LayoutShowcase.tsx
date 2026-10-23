'use client';

import { IconBookmark, IconPlayerPlay, IconShare } from '@tabler/icons-react';
import { useState } from 'react';

import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Logo } from '@/ui/Logo';
import { Segmented } from '@/ui/Segmented';
import { Switch } from '@/ui/Switch';
import { VoteButton } from '@/ui/VoteButton';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph, type VoteKind } from '@/ui/votes';

import styles from './LayoutShowcase.module.scss';

const FEED_TABS = [
  { value: 'friends', label: 'Друзья' },
  { value: 'all', label: 'Все оценки' },
] as const;

// /layout: the redesign's UI kit (Figma page «Основа и компоненты»), to check the components in both themes.
export function LayoutShowcase() {
  const [vote, setVote] = useState<VoteKind | null>('super');
  const [filter, setFilter] = useState<VoteKind | 'all'>('all');
  const [tab, setTab] = useState<(typeof FEED_TABS)[number]['value']>('friends');
  const [on, setOn] = useState(true);

  return (
    <div className={styles.page}>
      <h1>Компоненты</h1>
      <p className={styles.lead}>Основа нового дизайна. Тема переключается луной в сайдбаре.</p>

      <section>
        <h2>Логотип и аватары</h2>
        <div className={styles.row}>
          <Logo />
          <Avatar src={null} name="Артём Кручинин" size={24} />
          <Avatar src={null} name="Артём Кручинин" size={32} />
          <Avatar src={null} name="Артём Кручинин" size={40} />
          <Avatar src={null} name="Артём Кручинин" size={96} />
        </div>
      </section>

      <section>
        <h2>Кнопки</h2>
        {(['m', 's'] as const).map((size) => (
          <div key={size} className={styles.row}>
            <Button size={size}>Основная</Button>
            <Button size={size} variant="outline" icon={<IconBookmark />}>
              В закладки
            </Button>
            <Button size={size} variant="outline" icon={<IconPlayerPlay />}>
              Трейлер
            </Button>
            <Button size={size} variant="ghost">
              Призрак
            </Button>
            <Button size={size} variant="accent" icon={<IconShare />}>
              Поделиться
            </Button>
          </div>
        ))}
      </section>

      <section>
        <h2>Вкладки и фильтры</h2>
        <div className={styles.row}>
          <Segmented options={FEED_TABS} value={tab} onChange={setTab} />
        </div>
        <div className={styles.row}>
          <Chip selected={filter === 'all'} count={48} onClick={() => setFilter('all')}>
            Все
          </Chip>
          {VOTE_KINDS.map((kind, index) => (
            <Chip
              key={kind}
              selected={filter === kind}
              count={[12, 20, 9, 7][index]}
              icon={<VoteGlyph kind={kind} />}
              onClick={() => setFilter(kind)}
            >
              {VOTE_LABELS[kind]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2>Оценки</h2>
        {(['l', 'm', 's'] as const).map((size) => (
          <div key={size} className={styles.row}>
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
          </div>
        ))}
      </section>

      <section>
        <h2>Бейджи и переключатель</h2>
        <div className={styles.row}>
          <Badge status="positive">Подключён</Badge>
          <Badge status="warning">Нужна настройка</Badge>
          <Badge status="destructive">Ошибка</Badge>
          <Badge status="accent">Работает</Badge>
          <Badge status="neutral">Импортировано 214</Badge>
          <Switch checked={on} onChange={setOn} label="Пример" />
        </div>
      </section>
    </div>
  );
}

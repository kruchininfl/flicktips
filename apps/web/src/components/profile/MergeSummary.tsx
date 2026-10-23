'use client';

import type { LoginService, MergeSummary as MergeSummaryData } from '@flicktips/shared';

import { Button } from '@/components/gui/Button';
import { Userpic } from '@/components/gui/Userpic';

export const SERVICES: { id: LoginService; name: string; short: 'vk' | 'ya'; label: string }[] = [
  { id: 'vkontakte', name: 'ВКонтакте', short: 'vk', label: 'VK' },
  { id: 'yandex', name: 'Яндекс ID', short: 'ya', label: 'Я' },
];

export const serviceName = (id: LoginService) => SERVICES.find((service) => service.id === id)!.name;

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return `${n} ${forms[0]}`;
  return `${n} ${mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? forms[1] : forms[2]}`;
}

interface MergeSummaryProps {
  service: LoginService;
  merge: MergeSummaryData;
  merging: boolean;
  onMerge: () => void;
  onCancel: () => void;
}

// The account that already signs in with the service being linked, and what merging it would move over.
export function MergeSummary({ service, merge, merging, onMerge, onCancel }: MergeSummaryProps) {
  const other = merge.user;
  const name = other?.username || 'Без имени';

  return (
    <div className="accounts__merge">
      <div className="accounts__merge-title">{serviceName(service)} уже входит в другой аккаунт FlickTips</div>

      <div className="accounts__merge-user">
        <Userpic avatar={other?.avatar} className="accounts__merge-photo" />
        <span>
          <span className="accounts__merge-name">{name}</span>
          <span className="accounts__merge-stats">
            {plural(merge.votes, ['оценка', 'оценки', 'оценок'])}
            {' · '}
            {plural(merge.bookmarks, ['закладка', 'закладки', 'закладок'])}
            {' · '}
            {plural(merge.following, ['подписка', 'подписки', 'подписок'])}
          </span>
        </span>
      </div>

      {merge.blocking.length ? (
        <div className="accounts__merge-text">
          Объединить не получится: к обоим аккаунтам привязаны разные профили{' '}
          {merge.blocking.map(serviceName).join(' и ')}.
        </div>
      ) : (
        <div className="accounts__merge-text">
          Объединить аккаунты? Оценки, закладки и подписки перейдут в этот аккаунт, а «{name}» будет удалён. Входить
          можно будет любым из способов.
          {merge.conflicts
            ? ' ' +
              plural(merge.conflicts, ['фильм оценён', 'фильма оценены', 'фильмов оценены']) +
              ' в обоих аккаунтах по-разному: останется более свежая оценка.'
            : ''}
        </div>
      )}

      <div className="accounts__merge-actions">
        {merge.blocking.length ? null : (
          <Button color="blue" size="big" loading={merging} onClick={onMerge}>
            Объединить
          </Button>
        )}
        <Button color="gray" variant="border" size="big" disabled={merging} onClick={onCancel}>
          {merge.blocking.length ? 'Понятно' : 'Отмена'}
        </Button>
      </div>
    </div>
  );
}

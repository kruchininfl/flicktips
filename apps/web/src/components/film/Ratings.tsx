import { cn } from '@/lib/utils';

// Figma «Рейтинг»: above 7 green, 4–7 yellow, below 4 red. The pill is white in both themes, so the colours are
// the light theme's.
function tone(value: number | null | undefined): string {
  if (!value) return 'text-[#aba09c]';
  if (value > 7) return 'text-[#1c8742]';
  if (value >= 4) return 'text-[#965e00]';
  return 'text-[#e7000b]';
}

const format = (value: number | null | undefined) => (value ? value.toFixed(1) : '—');

// Кинопоиск and IMDb ratings in the white pill of the posters.
export function Ratings({
  kp,
  imdb,
  className,
}: {
  kp: number | null | undefined;
  imdb: number | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-[13px] bg-white/95 px-2 py-[5px] shadow-[0_2px_4px_#0000002e]',
        className,
      )}
    >
      <span className="flex items-center gap-1" title="Кинопоиск">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG logo */}
        <img src="/public/brand/kinopoisk.svg" width={15} height={15} alt="КП" />
        <span className={cn('type-mono', tone(kp))}>{format(kp)}</span>
      </span>
      <span className="flex items-center gap-1" title="IMDb">
        <span className="rounded-[3px] bg-[#f5c518] px-[3px] py-px text-[8px] leading-normal font-bold tracking-[-0.02em] text-black">
          IMDb
        </span>
        <span className={cn('type-mono', tone(imdb))}>{format(imdb)}</span>
      </span>
    </div>
  );
}

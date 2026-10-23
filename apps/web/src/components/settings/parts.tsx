import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Figma «Настройки»: a card with its title and note
export function SettingsCard({
  title,
  note,
  className,
  children,
}: {
  title: string;
  note?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn('flex flex-col gap-4 rounded-card border border-ring bg-card p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="type-h3">{title}</h2>
        {note && <p className="type-caption text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// a row of a card: the icon tile, the name with a caption, then the status and the action; with `href` the whole
// row is the link
export function SettingsRow({
  icon,
  name,
  caption,
  status,
  href,
  children,
}: {
  icon: ReactNode;
  name: string;
  caption?: ReactNode;
  status?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex min-h-14 items-center gap-3">
      {href && <Link href={href} aria-label={name} className="absolute -inset-1 rounded-xl" />}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        {caption && <span className="type-caption text-muted-foreground">{caption}</span>}
      </span>
      {status && <span className="hidden shrink-0 sm:inline-flex">{status}</span>}
      {children}
    </li>
  );
}

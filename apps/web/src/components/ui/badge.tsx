import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

// Figma «Бейдж»: Статус = Успех / Внимание / Ошибка / Акцент / Нейтральный, an outlined pill with a dot.
const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center gap-[5px] rounded-full border px-2 type-caption whitespace-nowrap',
  {
    variants: {
      status: {
        positive: 'border-positive-line text-positive',
        warning: 'border-warning-line text-warning',
        destructive: 'border-destructive-line text-destructive',
        accent: 'border-brand-line text-brand-text',
        neutral: 'border-muted-foreground-line text-muted-foreground',
      },
    },
    defaultVariants: { status: 'neutral' },
  },
);

function Badge({
  className,
  status,
  dot = true,
  children,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ status }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };

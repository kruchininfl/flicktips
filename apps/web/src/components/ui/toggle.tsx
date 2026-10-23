'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

// shadcn Toggle with the Figma «Фильтр» (chip: outline, the accent fill when selected) and «Вкладка» (tab: a
// segment of a muted track, the card colour when active).
const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm whitespace-nowrap transition-[background-color,border-color,color] outline-none focus-visible:ring-[3px] focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        chip: 'h-8 border border-border bg-card px-3 text-foreground hover:bg-muted data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:font-medium data-[state=on]:text-brand-foreground',
        tab: 'h-7 px-3 font-medium text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card',
      },
    },
    defaultVariants: { variant: 'chip' },
  },
);

function Toggle({
  className,
  variant,
  ...props
}: ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, className }))} {...props} />;
}

// the number on a chip («Супер 12»)
function ToggleCount({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] leading-4 text-faint in-data-[state=on]:text-brand-foreground/60',
        className,
      )}
      {...props}
    />
  );
}

export { Toggle, ToggleCount, toggleVariants };

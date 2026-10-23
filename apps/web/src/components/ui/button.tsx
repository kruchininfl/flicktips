import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

// shadcn Button with the Figma «Кнопка» (Тип = Основная / Контур / Призрак / Акцент, Размер = M 36px / S 32px)
// and «Кнопка-иконка» (36px round, 40px square in the collapsed sidebar).
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-[.88]',
        outline: 'border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        brand: 'bg-brand text-brand-foreground hover:opacity-90',
        destructive: 'bg-destructive text-white hover:opacity-90',
      },
      size: {
        m: 'h-9 px-4',
        s: 'h-8 px-3',
        icon: "size-9 text-foreground [&_svg:not([class*='size-'])]:size-[18px]",
        'icon-square': "size-10 rounded-xl text-foreground [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: { variant: 'primary', size: 'm' },
  },
);

function Button({
  className,
  variant = 'primary',
  size = 'm',
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(asChild ? {} : { type: 'button' as const })}
      {...props}
    />
  );
}

export { Button, buttonVariants };

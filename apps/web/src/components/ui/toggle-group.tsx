'use client';

import { type VariantProps } from 'class-variance-authority';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { createContext, useContext, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import { toggleVariants } from './toggle';

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({ variant: 'chip' });

// `variant="tab"` is the Figma segmented control («Друзья | Все оценки»), `variant="chip"` a row of filters.
function ToggleGroup({
  className,
  variant = 'chip',
  children,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      className={cn(
        'flex w-fit items-center',
        variant === 'tab' ? 'rounded-full bg-muted p-[3px]' : 'flex-wrap gap-2',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const { variant } = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleVariants({ variant }), className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn's class joiner: later Tailwind classes override earlier ones (cn('px-4', dense && 'px-2')).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

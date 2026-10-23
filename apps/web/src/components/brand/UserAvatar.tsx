import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// «Артём Кручинин» -> «АК», «Маша» -> «М»
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

const SIZES = {
  24: 'size-6 text-[10px]',
  32: 'size-8 type-caption font-medium',
  40: 'size-10 type-body font-medium',
  96: 'size-24 type-metric',
} as const;

// Figma «Аватар»: Размер = 24 / 32 / 40 / 96; the photo or the initials on a muted circle.
export function UserAvatar({
  src,
  name,
  size = 32,
  className,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

import { cx } from '@/lib/cx';

import styles from './Avatar.module.scss';

// «Артём Кручинин» -> «АК», «Маша» -> «М»
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

// Figma «Аватар»: Размер = 24 / 32 / 40 / 96; the photo or the initials on a muted circle.
export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: 24 | 32 | 40 | 96;
  className?: string;
}) {
  return (
    <span className={cx(styles.avatar, styles[`s${size}`], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars come from VK/Yandex CDNs
        <img src={src} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

import type { HTMLAttributes } from 'react';

import { cx } from '@/lib/cx';

import { GLYPHS, type IconName } from './icons/glyphs';

export type { IconName };

type AnyIconName = IconName | 'soc_ya';

// Just the <svg> of a glyph, for elements that carry the `icn icn_<name>` classes themselves (a link styled as
// an icon, as the legacy `<Link className="icn icn_cross">` did).
export function Glyph({ name }: { name: AnyIconName }) {
  const glyph = name in GLYPHS ? GLYPHS[name as IconName] : null;
  if (!glyph) return null;
  return (
    <svg viewBox={`0 0 ${glyph.width} 1024`} width={`${glyph.width / 1024}em`} height="1em" focusable="false">
      <path d={glyph.d} />
    </svg>
  );
}

interface IconProps extends HTMLAttributes<HTMLElement> {
  // a glyph of the legacy font; 'soc_ya' has none and is drawn by CSS (components/auth/SignInPanel.scss)
  name: AnyIconName;
}

// <i class="icn icn_<name>"> as the legacy markup had it, with the glyph inline instead of from the icon font.
// Sized by font-size and colored by `color`, like a font icon.
export function Icon({ name, className, ...props }: IconProps) {
  return (
    <i className={cx('icn', `icn_${name}`, className)} aria-hidden="true" {...props}>
      <Glyph name={name} />
    </i>
  );
}

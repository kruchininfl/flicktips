'use client';

import { useState } from 'react';

// The movie page's overview; a click toggles `m-open` (web/src/components/MoviePage).
export function MovieDescription({ children }: { children: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <div onClick={() => setOpened((value) => !value)} className={'movie__descr' + (opened ? ' m-open' : '')}>
      {children}
    </div>
  );
}

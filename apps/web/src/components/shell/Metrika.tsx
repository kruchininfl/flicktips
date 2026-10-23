'use client';

// Yandex.Metrika counter 45804789, production only (web/src/components/App/YaMetrica): loads watch.js once and
// reports every client-side navigation as a hit.
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const COUNTER_ID = 45804789;

interface MetrikaWindow {
  Ya?: { Metrika: new (options: Record<string, unknown>) => { hit: (url: string) => void } };
  yaCounter45804789?: { hit: (url: string) => void };
  yandex_metrika_callbacks?: (() => void)[];
}

export function Metrika() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    (window as MetrikaWindow).yaCounter45804789?.hit(pathname);
  }, [pathname]);

  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Script
        id="ya-metrika"
        strategy="afterInteractive"
        src="https://mc.yandex.ru/metrika/watch.js"
        onLoad={() => {
          const w = window as MetrikaWindow;
          try {
            if (w.Ya && !w.yaCounter45804789) {
              w.yaCounter45804789 = new w.Ya.Metrika({
                id: COUNTER_ID,
                clickmap: true,
                trackLinks: true,
                accurateTrackBounce: true,
                webvisor: true,
              });
            }
          } catch (e) {
            console.log(e);
          }
        }}
      />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- tracking pixel */}
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}

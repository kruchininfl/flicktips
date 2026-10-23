'use client';

// Registers the service worker (/serwist/sw.js, see app/serwist/[path]/route.ts and src/sw/sw.ts) for the whole
// site. Off in `next dev`, where a worker would serve stale bundles.
import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

export const SW_URL = '/serwist/sw.js';

export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl={SW_URL}
      disable={process.env.NODE_ENV === 'development'}
      // pages render per viewer: never ask the worker to cache them (see src/sw/sw.ts)
      cacheOnNavigation={false}
      reloadOnOnline={false}
      // the bundle has no imports, so it runs as a classic worker in every browser that has service workers
      options={{ scope: '/', type: 'classic', updateViaCache: 'none' }}
    >
      {children}
    </SerwistProvider>
  );
}

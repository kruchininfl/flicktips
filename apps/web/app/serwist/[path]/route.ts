// /serwist/sw.js (+ its source map): the service worker, bundled from src/sw/sw.ts with esbuild and the precache
// manifest injected. This is Serwist's documented setup for Turbopack builds (@serwist/turbopack), which has no
// webpack plugin hook: the route is static, so `next build` prerenders the files and the standalone server only
// serves them. It answers with `Service-Worker-Allowed: /`, which lets the worker control the whole site.
import { createSerwistRoute } from '@serwist/turbopack';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'src/sw/sw.ts',
  useNativeEsbuild: true,
  // Precache: the build's static assets, the offline page and the few images it and the shell need at once.
  // Everything else is cached at runtime by the rules in sw.ts.
  globPatterns: [
    '.next/static/**/*.{js,css,woff,woff2,png,svg,ico,webp}',
    'public/offline.html',
    'public/public/favicon*.{ico,png}',
    'public/public/android-chrome-192x192.png',
    'public/public/img/*.{png,svg}',
  ],
});

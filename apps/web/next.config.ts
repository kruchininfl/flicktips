import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';

// The Fastify API (apps/api). In production nginx sends /api, /auth and /poster to their upstreams before
// Next.js sees them; the rewrites below make `next dev` / `next start` work alone.
const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  reactStrictMode: true,
  // legacy URLs: /profile/* with a trailing slash, the rest without (proxy.ts)
  skipTrailingSlashRedirect: true,
  sassOptions: {
    // `@use 'base' as *;` from any file (src/styles/_base.scss)
    loadPaths: [new URL('./src/styles', import.meta.url).pathname],
  },
  // The service worker is a prerendered route, which Next.js would send with `s-maxage=31536000`: a proxy cache
  // could then keep an old worker for a year. Browsers check it for updates on every navigation anyway.
  async headers() {
    return [{ source: '/serwist/:path*', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/auth/:path*', destination: `${apiUrl}/auth/:path*` },
      // nginx proxies and caches these from Кинопоиск (nginx/conf.d/flicktips.conf)
      {
        source: '/poster/kp/:file',
        destination: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/:file',
      },
    ];
  },
};

// withSerwist keeps esbuild (bundles the service worker at build time, app/serwist) out of the server bundle
export default withSerwist(nextConfig);

import type { MetadataRoute } from 'next';

// /manifest.webmanifest: the installable app that replaces the Cordova build. Name and icons come from the legacy
// site.webmanifest and favicon set (public/public/); the maskable icons are the same logo inside the safe zone.
// Colors: the site background (theme-color of the layout) and the logo's tile color (browserconfig.xml).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FlickTips',
    short_name: 'FlickTips',
    description: 'Рейтинг фильмов и сериалов на основе оценок друзей, кинопоиска и imdb.',
    lang: 'ru',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0d0e12',
    theme_color: '#0d0e12',
    categories: ['entertainment'],
    icons: [
      { src: '/public/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/public/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/public/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/public/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

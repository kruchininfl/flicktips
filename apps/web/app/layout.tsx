import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

// Component styles first, then the global sheets: the legacy bundle had the partitions' CSS before App.scss and
// the pages' CSS after it, and some equal-specificity rules rely on that order.
import { AppShell } from '@/components/shell/AppShell';
import { UiProvider } from '@/components/shell/UiProvider';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/config';
import { getViewer } from '@/viewer/server';
import { ViewerProvider } from '@/viewer/ViewerProvider';

import '@/styles/app.scss';
import '@/styles/pages.scss';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'FlickTips — фильмы, друзья, лайки',
  description: 'Рейтинг фильмов и сериалов на основе оценок друзей, кинопоиска и imdb.',
  openGraph: {
    title: 'FlickTips — Делитесь впечатлениями о просмотренных фильмах с друзьями.',
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    shortcut: '/public/favicon.ico?3',
    icon: [
      { url: '/public/favicon.ico?3', type: 'image/x-icon' },
      { url: '/public/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/public/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/public/apple-touch-icon.png', sizes: '180x180' },
    other: [{ rel: 'mask-icon', url: '/public/safari-pinned-tab.svg', color: '#5bbad5' }],
  },
  manifest: '/public/site.webmanifest',
  other: { 'msapplication-TileColor': '#333b41' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  themeColor: '#0d0e12',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- the legacy fonts, loaded the same way */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="react-view" id="react-view">
          <ViewerProvider initialViewer={viewer}>
            <UiProvider>
              <AppShell>{children}</AppShell>
            </UiProvider>
          </ViewerProvider>
        </div>
      </body>
    </html>
  );
}

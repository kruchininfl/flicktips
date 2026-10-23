import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.scss';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://flicktips.ru'),
  title: 'FlickTips',
  description: 'Рекомендации фильмов от друзей',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

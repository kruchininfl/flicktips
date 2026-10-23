// Page metadata in the shape the legacy pages put into <Helmet>: a full title (no template), description,
// Open Graph / VK / Twitter tags and the canonical URL.
import type { Metadata } from 'next';

import { DEFAULT_OG_IMAGE, SITE_URL } from './config';

interface PageMetadataInput {
  // the whole <title>, e.g. 'Брат (1997) — FlickTips'
  title: string;
  description?: string;
  // site path ('/movie/42'); becomes the canonical URL and og:url
  path?: string;
  // absolute URL; the logo when missing
  image?: string | null;
  // og:type: 'video.movie' on the movie and person pages
  type?: 'website' | 'video.movie' | 'profile';
  noindex?: boolean;
}

export function pageMetadata({ title, description, path, image, type, noindex }: PageMetadataInput): Metadata {
  const url = path ? SITE_URL + path : undefined;
  const picture = image || DEFAULT_OG_IMAGE;
  const other: Record<string, string> = { title, 'vk:image': picture, 'twitter:title': title };
  if (description) other['twitter:description'] = description;

  return {
    title: { absolute: title },
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: noindex ? { index: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: 'FlickTips',
      images: [picture],
      ...(type ? { type } : {}),
    },
    other,
  };
}

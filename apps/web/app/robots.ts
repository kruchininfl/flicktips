import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/config';

// Same rules as web/robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: ['/api', '/profile', '/signin', '/user', '/404'] },
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemaps/sitemap.xml`,
  };
}

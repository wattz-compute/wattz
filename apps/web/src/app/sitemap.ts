import { FLAGS } from '@/lib/flags';
import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wattz.fi';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    '/',
    ...(FLAGS.playground ? ['/playground'] : []),
    ...(FLAGS.sdk ? ['/docs'] : []),
    ...(FLAGS.operator ? ['/operator'] : []),
    '/status',
    '/receipts',
  ];
  return routes.map((path) => ({
    url: `${siteUrl}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}

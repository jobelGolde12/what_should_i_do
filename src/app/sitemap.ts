// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://whatshouldido-five.vercel.app/',
      lastModified: new Date(),
      priority: 1.0,
    },
  ];
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only pages that opt into indexing (robots: index) belong in the sitemap.
// lastModified is a stable date so the output is deterministic across builds.
const LAST_MODIFIED = "2026-08-10T00:00:00.000Z";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/terms`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}

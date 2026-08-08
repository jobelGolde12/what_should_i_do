/** Single source of truth for site identity, URLs, and social metadata. */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://taskmind.app"
).replace(/\/$/, "");

export const SITE_NAME = "TaskMind";

export const SITE_TITLE =
  "TaskMind - Turn confusing messages into clear actions";

export const SITE_DESCRIPTION =
  "An AI-powered workspace that extracts actions, deadlines, and urgency from any text or document. Not a summarizer - a decision and action clarity tool.";

export const SITE_TAGLINE = "AI-powered task, deadline, and urgency analyzer";

export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const TWITTER_IMAGE = `${SITE_URL}/twitter-image.png`;

export const META_DEFAULTS = {
  applicationName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [TWITTER_IMAGE],
  },
} as const;

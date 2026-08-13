import type { Metadata } from "next";
import ShareView from "@/components/share/ShareView";
import { SITE_NAME, OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shared analysis",
  description:
    "View an AI analysis on TaskMind — extracted actions, deadlines, urgency, and a clear next step.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Shared analysis`,
    description:
      "View an AI analysis on TaskMind — extracted actions, deadlines, urgency, and a clear next step.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Shared analysis`,
    description:
      "View an AI analysis on TaskMind — extracted actions, deadlines, urgency, and a clear next step.",
    images: [OG_IMAGE],
  },
};

export default function SharePage() {
  return <ShareView />;
}

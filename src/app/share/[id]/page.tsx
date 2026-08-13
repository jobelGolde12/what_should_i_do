import type { Metadata } from "next";
import { decryptShareToken } from "@/lib/share-crypto";
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

export default async function SharePage({
  params,
}: {
  params: { id: string };
}) {
  // Decrypt on the server: a `sensitive` payload never sends the raw input to
  // the browser at all, so it can't be recovered by editing the URL.
  let payload = decryptShareToken(params.id);
  if (payload?.sensitive) {
    payload = { ...payload, input: "" };
  }
  return <ShareView payload={payload} shareToken={params.id} />;
}

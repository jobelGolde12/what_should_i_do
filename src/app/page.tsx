import Script from "next/script";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { DashboardHome } from "@/components/dashboard/DashboardHome";

export const metadata = {
  title: "TaskMind - Turn confusing messages into clear actions",
  description:
    "Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, highlight confusing parts, and get a clear next step. Instantly translate analysis to any language.",
  applicationName: "TaskMind",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    url: "https://taskmind.app/",
    title: "TaskMind - AI-Powered Task & Deadline Analyzer",
    description:
      "Transform your text or files into clear action plans with AI analysis. Get deadlines, urgency levels, and translations instantly.",
    images: [
      {
        url: "https://taskmind.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "TaskMind preview",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TaskMind - AI-Powered Task & Deadline Analyzer",
    description:
      "Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, and get translations.",
    images: ["https://taskmind.app/twitter-image.png"],
  },
  alternates: {
    canonical: "https://taskmind.app/",
  },
};

export default function Home() {
  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      <Script
        id="webapp-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "TaskMind",
            url: "https://taskmind.app/",
            description:
              "AI-powered tool that analyzes text and documents to extract actionable tasks, detect deadlines, and provide urgency classifications with multilingual support.",
            applicationCategory: "ProductivityApplication",
            operatingSystem: "Any",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            featureList: [
              "Action Extractor",
              "Deadline Detector",
              "Urgency Classifier",
              "Confusion Highlighter",
              "One-Sentence Guidance",
              "Multilingual Translation",
            ],
            author: {
              "@type": "Organization",
              name: "TaskMind",
            },
          }),
        }}
      />

      <DashboardLayout>
        <DashboardHome />
      </DashboardLayout>
    </>
  );
}

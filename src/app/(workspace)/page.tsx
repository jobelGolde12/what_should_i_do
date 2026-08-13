import Script from "next/script";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import {
  SITE_URL,
  SITE_TITLE,
  OG_IMAGE,
  TWITTER_IMAGE,
  SITE_NAME,
} from "@/lib/site";

export const metadata = {
  title: "Turn confusing messages into clear actions",
  description:
    "Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, highlight confusing parts, and get a clear next step. Instantly translate analysis to any language.",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    title: SITE_TITLE,
    description:
      "Transform your text or files into clear action plans with AI analysis. Get deadlines, urgency levels, and translations instantly.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "TaskMind preview",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description:
      "Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, and get translations.",
    images: [TWITTER_IMAGE],
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is TaskMind?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TaskMind analyzes any text or document and extracts the actions you need to take, the deadlines attached to them, and how urgent they are. It also flags confusing parts and suggests a single next step.",
      },
    },
    {
      "@type": "Question",
      name: "Does TaskMind store my data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your history, templates, and action board are stored locally in your browser. Text you analyze is sent to the analysis provider only to generate results. You can back data up to your own account if you choose to create one.",
      },
    },
    {
      "@type": "Question",
      name: "Can TaskMind analyze files?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Paste text or upload PDFs, Word documents, or images up to 10 MB, and TaskMind will extract the text and analyze it.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. TaskMind is free to use. There is no account required to analyze text, and results are available immediately.",
      },
    },
  ],
};

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: OG_IMAGE,
};

export default function Home() {
  return (
    <>
      <Script
        id="webapp-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            url: SITE_URL,
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
              name: SITE_NAME,
            },
          }),
        }}
      />

      <Script
        id="org-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
      />

      <Script
        id="faq-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      <DashboardHome />
    </>
  );
}

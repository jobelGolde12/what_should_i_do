import { Inter } from 'next/font/google';
import Script from 'next/script';
import Header from '../components/header/page';
import HeroSection from '../components/hero-section/page';
import Footer from '../components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  verification: {
    google: 'uvUB7etXYP6BqtpgFi6CMlca1qlL7V6RMLVWn3HzO8M',
  },
  title: 'What Should I Do - AI-Powered Task & Deadline Analyzer',
  description:
    'Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, highlight confusing parts, and get personalized recommendations. Instantly translate analysis to any language including Tagalog.',

  applicationName: 'What Should I Do',

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },

  openGraph: {
    type: 'website',
    url: 'https://whatshouldido.app/',
    title: 'What Should I Do - AI-Powered Task & Deadline Analyzer',
    description:
      'Transform your text/files into clear action plans with AI analysis. Get deadlines, urgency levels, and translations instantly.',
    images: [
      {
        url: 'https://whatshouldido.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'What Should I Do App Preview',
      },
    ],
    locale: 'en_US',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'What Should I Do - AI-Powered Task & Deadline Analyzer',
    description:
      'Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, and get translations.',
    images: ['https://whatshouldido.app/twitter-image.png'],
  },

  themeColor: '#3b82f6',

  alternates: {
    canonical: 'https://whatshouldido.app/',
  },
};

export default function Home() {
  return (
    <>
      {/* Google AdSense Script */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      
      {/* Structured Data: WebApplication */}
      <Script
        id="webapp-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'What Should I Do',
            url: 'https://whatshouldido.app/',
            description:
              'AI-powered tool that analyzes text and documents to extract actionable tasks, detect deadlines, and provide urgency classifications with multilingual support.',
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Action Extractor',
              'Deadline Detector',
              'Urgency Classifier',
              'Confusion Highlighter',
              'One-Sentence Guidance',
              'Multilingual Translation',
            ],
            author: {
              '@type': 'Organization',
              name: 'What Should I Do',
            },
          }),
        }}
      />

      {/* Structured Data: Feature List */}
      <Script
        id="feature-list-schema"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Action Extractor',
                description:
                  'Detects verbs like submit, attend, pay, respond and turns them into clear action items',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Deadline Detector',
                description:
                  'Converts relative dates to actual dates with clear visual indicators',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: 'Urgency Classifier',
                description:
                  'Visual color indicators (green/yellow/red) to show task urgency',
              },
              {
                '@type': 'ListItem',
                position: 4,
                name: 'Confusion Highlighter',
                description:
                  'Marks confusing sentences and explains them in simple words',
              },
              {
                '@type': 'ListItem',
                position: 5,
                name: 'One-Sentence Guidance',
                description:
                  'If you do only one thing, do this — clear next step recommendation',
              },
              {
                '@type': 'ListItem',
                position: 6,
                name: 'Tagalog Translation',
                description:
                  'One-click translation of analyzed results into Tagalog for Filipino users',
              },
            ],
          }),
        }}
      />

      <div className={`min-h-screen gradient-bg ${inter.className}`}>
        <Header />
        <HeroSection />
        <Footer />
      </div>
    </>
  );
}

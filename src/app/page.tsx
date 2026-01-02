import { Inter } from 'next/font/google';
import Head from 'next/head';
import Header from '../components/header/page';
import HeroSection from '../components/hero-section/page';
import Footer from '../components/Footer';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
        <title>What Should I Do - AI-Powered Task & Deadline Analyzer</title>
        <meta name="title" content="What Should I Do - AI-Powered Task & Deadline Analyzer" />
        <meta name="description" content="Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, highlight confusing parts, and get personalized recommendations. Instantly translate analysis to any language including Tagalog." />
        
        {/* Keywords for SEO */}
        <meta name="keywords" content="task analyzer, deadline detector, action extractor, AI productivity tool, text analysis, document processing, time management, Tagalog translator, urgency classifier, project management, Filipino language support" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://whatshouldido.app/" />
        <meta property="og:title" content="What Should I Do - AI-Powered Task & Deadline Analyzer" />
        <meta property="og:description" content="Transform your text/files into clear action plans with AI analysis. Get deadlines, urgency levels, and translations instantly." />
        <meta property="og:image" content="https://whatshouldido.app/og-image.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://whatshouldido.app/" />
        <meta property="twitter:title" content="What Should I Do - AI-Powered Task & Deadline Analyzer" />
        <meta property="twitter:description" content="Upload text or files to automatically extract actionable items, detect deadlines, classify urgency, and get translations." />
        <meta property="twitter:image" content="https://whatshouldido.app/twitter-image.png" />
        
        {/* Additional Important Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        
        {/* App Specific */}
        <meta name="application-name" content="What Should I Do" />
        <meta name="apple-mobile-web-app-title" content="What Should I Do" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
        {/* Language and Localization */}
        <meta name="language" content="English" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta property="og:locale" content="en_US" />
        
        {/* Structured Data for Rich Results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "What Should I Do",
              "url": "https://whatshouldido.app/",
              "description": "AI-powered tool that analyzes text and documents to extract actionable tasks, detect deadlines, and provide urgency classifications with multilingual support.",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "Any",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": [
                "Action Extractor",
                "Deadline Detector", 
                "Urgency Classifier",
                "Confusion Highlighter",
                "One-Sentence Guidance",
                "Multilingual Translation"
              ],
              "author": {
                "@type": "Organization",
                "name": "What Should I Do"
              }
            })
          }}
        />
        
        {/* Additional Schema for Features */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Action Extractor",
                  "description": "Detects verbs like submit, attend, pay, respond and turns them into clear action items"
                },
                {
                  "@type": "ListItem", 
                  "position": 2,
                  "name": "Deadline Detector",
                  "description": "Converts relative dates to actual dates with clear visual indicators"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Urgency Classifier",
                  "description": "Visual color indicators (green/yellow/red) to show task urgency"
                },
                {
                  "@type": "ListItem",
                  "position": 4,
                  "name": "Confusion Highlighter",
                  "description": "Marks confusing sentences and explains them in simple words"
                },
                {
                  "@type": "ListItem",
                  "position": 5,
                  "name": "One-Sentence Guidance",
                  "description": "\"If you do only one thing, do this\" - clear next step recommendation"
                },
                {
                  "@type": "ListItem",
                  "position": 6,
                  "name": "Tagalog Translation",
                  "description": "One-click translation of analyzed results into Tagalog for Filipino users"
                }
              ]
            })
          }}
        />
      </Head>

      <div className={`min-h-screen gradient-bg ${inter.className}`}>
        {/* Header/Navigation */}
        <Header />

        {/* Hero Section */}
        <HeroSection />

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
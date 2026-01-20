'use client';

import { useEffect, useState } from 'react';

interface AdConfig {
  enabled: boolean;
  adCode?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

interface AdUnit {
  id: string;
  name: string;
  slot: string;
  dimensions: {
    width: number;
    height: number;
  };
  networkCode?: string;
}

const adUnits: AdUnit[] = [
  {
    id: 'ad-1',
    name: 'Main Sidebar Ad',
    slot: '/12345678/sidebar-ad', // Replace with your AdSense slot
    dimensions: { width: 300, height: 250 }
  },
  {
    id: 'ad-2',
    name: 'Secondary Sidebar Ad',
    slot: '/12345678/sidebar-ad-2', // Replace with your AdSense slot
    dimensions: { width: 300, height: 200 }
  }
];

interface AdContainerProps {
  adUnit: AdUnit;
  className?: string;
}

export function AdContainer({ adUnit, className = '' }: AdContainerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    // Only load ads in production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' && window.adsbygoogle) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setAdLoaded(true);
      } catch (error) {
        console.error('AdSense error:', error);
        setAdError(true);
      }
    }
  }, [adUnit.id]);

  // Don't show ads in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="text-center text-gray-500 text-sm font-medium mb-2">Advertisement</div>
        <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height: adUnit.dimensions.height }}>
          <div className="text-gray-400 text-center">
            <p className="text-sm">Ad Space {adUnit.dimensions.width}x{adUnit.dimensions.height}</p>
            <p className="text-xs mt-1">{adUnit.name}</p>
            <p className="text-xs mt-2 text-blue-600">Development Mode</p>
          </div>
        </div>
      </div>
    );
  }

  if (adError) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="text-center text-gray-500 text-sm font-medium mb-2">Advertisement</div>
        <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height: adUnit.dimensions.height }}>
          <div className="text-gray-400 text-center">
            <p className="text-sm">Ad unavailable</p>
            <p className="text-xs mt-1">Please try again later</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="text-center text-gray-500 text-sm font-medium mb-2">Advertisement</div>
      <ins
        className="adsbygoogle block"
        style={{
          width: `${adUnit.dimensions.width}px`,
          height: `${adUnit.dimensions.height}px`
        }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Replace with your AdSense client ID
        data-ad-slot={adUnit.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

// Custom ad for direct advertising
interface CustomAdProps {
  title: string;
  description: string;
  imageUrl?: string;
  linkUrl: string;
  className?: string;
}

export function CustomAd({ title, description, imageUrl, linkUrl, className = '' }: CustomAdProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="text-center text-gray-500 text-sm font-medium mb-2">Sponsored</div>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:opacity-90 transition-opacity"
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            className="w-full rounded-lg mb-3"
            style={{ maxHeight: '200px', objectFit: 'cover' }}
          />
        )}
        <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
        <span className="inline-block text-xs text-blue-600 font-medium mt-2">Learn more →</span>
      </a>
    </div>
  );
}

// Newsletter signup component (non-ad but related revenue source)
interface NewsletterSignupProps {
  className?: string;
}

export function NewsletterSignup({ className = '' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Replace with your newsletter service API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSubscribed(true);
      setEmail('');
    } catch (error) {
      console.error('Newsletter subscription failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className={`bg-green-50 rounded-lg p-4 border border-green-200 ${className}`}>
        <div className="text-green-800 font-medium">✓ Successfully subscribed!</div>
        <div className="text-green-700 text-sm mt-1">Check your email for confirmation.</div>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 rounded-lg p-4 border border-blue-200 ${className}`}>
      <h3 className="font-medium text-blue-900 mb-2">Stay Updated</h3>
      <p className="text-sm text-blue-700 mb-3">Get productivity tips and updates</p>
      <form onSubmit={handleSubscribe} className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
    </div>
  );
}

export { adUnits };

// TypeScript declaration for AdSense
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}
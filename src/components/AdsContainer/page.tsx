"use client";

interface AdsContainerProps {
  showAd: boolean;
}

export default function AdsContainer({ showAd }: AdsContainerProps) {
  // Only render the ad container when results are available
  if (!showAd) return null;

  return (
    <div className="w-full h-[30vh] bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-6">
      {/* Google AdSense Container */}
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Replace with your AdSense Publisher ID
        data-ad-slot="XXXXXXXXXX" // Replace with your Ad Slot ID
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (adsbygoogle = window.adsbygoogle || []).push({});
          `,
        }}
      />
      
      {/* Fallback placeholder when ad is not loaded */}
      <div className="absolute text-gray-400 text-center">
        <p className="text-sm">Advertisement</p>
        <p className="text-xs mt-1">Ads will appear here</p>
      </div>
    </div>
  );
}
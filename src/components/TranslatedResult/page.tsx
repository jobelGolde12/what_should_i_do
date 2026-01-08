"use client";

import { useEffect, useState } from "react";
import { AnalysisResult } from "@/app/actions/analyzeText";
import { ChevronDown } from "lucide-react";

type Props = {
  result: AnalysisResult;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "tl", label: "Filipino" },
];

export default function TranslatedResult({ result }: Props) {
  const [language, setLanguage] = useState("en");
  const [translatedText, setTranslatedText] = useState(result.summary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    if (language === "en") {
      setTranslatedText(result.summary);
      setError(null);
      return;
    }

    const translate = async () => {
      setLoading(true);
      setError(null);

      try {
        const cleanText = result.summary.replace(/<[^>]*>/g, "");
        const encoded = encodeURIComponent(cleanText);

        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|${language}`
        );

        const data = await res.json();

        if (!data?.responseData?.translatedText) {
          throw new Error("No translation returned");
        }

        setTranslatedText(data.responseData.translatedText);
      } catch (err) {
        console.error(err);
        setError("Translation failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    translate();
  }, [language, result.summary]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-gray-900">Summary Translation</h3>
          <p className="text-sm text-gray-500">Select language to translate</p>
        </div>

        <div className="relative">
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setShowTranslation(true);
            }}
            className="appearance-none border border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {showTranslation && (
        <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Translated Text
                </span>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {LANGUAGES.find(l => l.code === language)?.label}
                </span>
              </div>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                {translatedText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
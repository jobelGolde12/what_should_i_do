"use client";

import { useState } from "react";
import { analyzeText, AnalysisResult } from "@/app/actions/analyzeText";

export default function MainInputArea() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    const res = await analyzeText(text);
    setResult(res);
    setLoading(false);
  }

  async function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-12">
        <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Paste your text here</h2>
            <div className="flex space-x-2">
              <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                Email
              </button>
              <button className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                Notice
              </button>
              <button className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                Message
              </button>
            </div>
          </div>

          <textarea
            className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Paste an email, school announcement, work memo, government notice, or long message here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* File Upload (non-intrusive) */}
          <div className="mt-4">
            <input
              type="file"
              accept=".txt"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
              className="text-sm text-gray-500"
            />
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-gray-500 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>We don&apos;t store your data</span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition flex items-center gap-2"
            >
              Analyze Text
            </button>
          </div>
        </div>
      </div>

      {/* Result Output (structured, expected output) */}
      {result && (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <strong>Urgency:</strong> {result.urgency}
          </div>

          <div>
            <strong>Actions:</strong>
            <ul className="list-disc ml-5">
              {result.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Deadlines:</strong>
            <ul className="list-disc ml-5">
              {result.deadlines.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          {result.confusingParts.length > 0 && (
            <div>
              <strong>Confusing Parts:</strong>
              {result.confusingParts.map((c, i) => (
                <div key={i} className="mt-2">
                  <p className="italic">“{c.sentence}”</p>
                  <p className="text-sm text-gray-600">{c.explanation}</p>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg font-semibold">
            {result.nextStep}
          </div>
        </div>
      )}
    </>
  );
}

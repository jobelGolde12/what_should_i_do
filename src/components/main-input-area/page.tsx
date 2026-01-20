"use client";

import { useState } from "react";
import { analyzeText, AnalysisResult } from "@/app/actions/analyzeText";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import TranslatedResult from "../TranslatedResult/page";
import ConfusingParts from "../ConfusingParts/page";

export default function MainInputArea() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleClearAll = () => {
    setText("");
    setResult(null);
    setUploadedFileName(null);
    // Clear file input value
    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  async function handleAnalyze(inputText?: string) {
    const finalText = inputText ?? text;
    if (!finalText.trim()) return;

    setLoading(true);
    try {
      const res = await analyzeText(finalText);
      setResult(res);
    } catch (error) {
      console.error('Analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Analysis failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setLoading(true);
    let extractedText = "";
    setUploadedFileName(file.name);

    try {
      // TXT
      if (file.type === "text/plain") {
        extractedText = await file.text();
      }

      // PDF (FIXED)
      else if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        type TextItem = {
          str: string;
        };
        type TextMarkedContent = {
          type: string;
        };

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          extractedText +=
            content.items
              .map((item: TextItem | TextMarkedContent) => 'str' in item ? item.str : '')
              .join(" ") + "\n";
        }
      }

      // DOCX
      else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        extractedText = result.value;
      }

      // IMAGE (OCR)
      else if (file.type.startsWith("image/")) {
        const ocrResult = await Tesseract.recognize(file, "eng", {
          logger: () => {},
        });
        extractedText = ocrResult.data.text;
      }

      setText(extractedText);
      await handleAnalyze(extractedText);
    } catch (err) {
      console.error("File processing failed:", err);
      setUploadedFileName(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-12" id="main-input-area">
        <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500" />
        
        {/* Clear All Header */}
        <div className="px-6 md:px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 truncate">
                Paste or Upload Text
              </h2>
              {(text || result || uploadedFileName) && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {uploadedFileName && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {uploadedFileName.length > 20 ? `${uploadedFileName.substring(0, 20)}...` : uploadedFileName}
                    </span>
                  )}
                  {text && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {text.length > 100 ? `${text.length} characters` : "Text entered"}
                    </span>
                  )}
                  {result && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Analysis ready
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {(text || result || uploadedFileName) && (
              <button
                onClick={handleClearAll}
                className="group flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95 shadow-sm hover:shadow"
              >
                <svg 
                  className="w-5 h-5 text-gray-500 group-hover:text-red-500 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="relative">
            <div className="p-[2px] rounded-xl focus-within:bg-gradient-to-r from-blue-500 to-purple-500">
          <div className="p-[1px] rounded-xl focus-within:bg-gradient-to-r from-blue-500 to-purple-500">
          <textarea
            className="w-full h-64 p-4 bg-white rounded-[11px] border border-gray-300 
                      focus:outline-none focus:ring-0 focus:border-transparent 
                      resize-none block transition-all"
            placeholder="Paste text..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
          </div>
            
            {text && (
              <button
                onClick={() => setText("")}
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Clear text"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6 items-center justify-between">
            <div className="w-full md:w-auto">
              <input
                id="file-upload"
                type="file"
                accept=".txt,.pdf,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleFileUpload(e.target.files[0])
                }
              />
              <label
                htmlFor="file-upload"
                className="group flex items-center gap-3 px-5 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
              >
                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    Upload file or image
                  </span>
                  <span className="text-xs text-gray-500">
                    TXT, PDF, DOCX, JPG, PNG
                  </span>
                </div>
              </label>
            </div>

            <button
              onClick={() => handleAnalyze()}
              disabled={loading || !text.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </span>
              ) : "Analyze Text"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="text-xl font-bold text-gray-800">Analysis Results</h3>
            <button
              onClick={() => setResult(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close results
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <strong className="text-gray-700">Urgency:</strong> 
              <span className="ml-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                {result.urgency}
              </span>
            </div>

            <div>
              <strong className="text-gray-700">Actions:</strong>
              <ul className="mt-2 ml-5 space-y-2">
                {result.actions.map((a, i) => (
                  <li key={i} className="flex items-start">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <strong className="text-gray-700">Deadlines:</strong>
              <ul className="mt-2 ml-5 space-y-2">
                {result.deadlines.map((d, i) => (
                  <li key={i} className="flex items-start">
                    <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {result.confusingParts.length > 0 && (
              <ConfusingParts data={result.confusingParts} />
            )}

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <strong className="text-blue-700">Next Step:</strong>
              <p className="mt-2 font-semibold text-gray-800">{result.nextStep}</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <strong className="text-green-700">Summary:</strong>
              <div
                className="mt-2 text-gray-800 leading-relaxed prose max-w-none"
                dangerouslySetInnerHTML={{ __html: result.summary }}
              />
            </div>
          </div>

          <TranslatedResult result={result} />
        </div>
      )}
    </>
  );
}
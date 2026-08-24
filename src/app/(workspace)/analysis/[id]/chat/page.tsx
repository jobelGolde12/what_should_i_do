import type { Metadata } from "next";
import AnalysisChatView from "@/components/chat/AnalysisChatView";

export const metadata: Metadata = {
  title: "Ask about this analysis",
  robots: { index: false, follow: false },
};

export default function AnalysisChatPage() {
  return <AnalysisChatView />;
}

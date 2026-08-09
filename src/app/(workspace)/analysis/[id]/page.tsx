import type { Metadata } from "next";
import AnalysisView from "@/components/analysis/AnalysisView";

export const metadata: Metadata = {
  title: "Analysis",
  robots: { index: false, follow: false },
};

export default function AnalysisPage() {
  return <AnalysisView />;
}

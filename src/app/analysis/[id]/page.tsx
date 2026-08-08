import type { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AnalysisView from "@/components/analysis/AnalysisView";

export const metadata: Metadata = {
  title: "Analysis - TaskMind",
  robots: { index: false, follow: false },
};

export default function AnalysisPage() {
  return (
    <DashboardLayout>
      <AnalysisView />
    </DashboardLayout>
  );
}

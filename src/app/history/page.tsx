import type { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HistoryView from "@/components/history/HistoryView";

export const metadata: Metadata = {
  title: "History - TaskMind",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <HistoryView />
    </DashboardLayout>
  );
}

import type { Metadata } from "next";
import HistoryView from "@/components/history/HistoryView";

export const metadata: Metadata = {
  title: "History",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return <HistoryView />;
}

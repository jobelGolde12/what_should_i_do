import type { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SavedView from "@/components/saved/SavedView";

export const metadata: Metadata = {
  title: "Saved templates - TaskMind",
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return (
    <DashboardLayout>
      <SavedView />
    </DashboardLayout>
  );
}

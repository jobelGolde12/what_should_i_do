import type { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SettingsView from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsView />
    </DashboardLayout>
  );
}

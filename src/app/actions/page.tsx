import type { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ActionsBoard from "@/components/board/ActionsBoard";

export const metadata: Metadata = {
  title: "My Actions - TaskMind",
  robots: { index: false, follow: false },
};

export default function ActionsPage() {
  return (
    <DashboardLayout>
      <ActionsBoard />
    </DashboardLayout>
  );
}

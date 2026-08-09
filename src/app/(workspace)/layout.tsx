import type { ReactNode } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * Shared workspace shell — persists across /, /history, /saved, /actions,
 * /settings, /analysis/[id], and /dashboard so TaskProvider + nav chrome
 * do not remount on every leaf route transition.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

"use client";

import type { ReactNode } from "react";
import { TaskProvider } from "@/context/TaskContext";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { AdsRail } from "./AdsRail";
import QuickSearch from "./QuickSearch";
import Logo from "./Logo";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <TaskProvider>
      <div className="flex min-h-screen bg-background text-ink">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-t-2 border-t-accent border-b border-line bg-background/90 px-4 backdrop-blur-sm lg:hidden">
            <Logo />
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:block">
              ⌘ K to search
            </p>
          </header>
          <div className="flex min-w-0 flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>
            <AdsRail />
          </div>
        </div>
        <BottomNav />
        <QuickSearch />
      </div>
    </TaskProvider>
  );
}

"use client";

import { type ReactNode } from "react";
import { Search } from "lucide-react";
import { TaskProvider } from "@/context/TaskContext";
import { DataCacheProvider } from "@/lib/data-cache";
import { NavigationProvider } from "@/lib/navigation";
import { SyncEngine } from "@/components/sync/SyncEngine";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { AdsRail } from "./AdsRail";
import QuickSearch from "./QuickSearch";
import Logo from "./Logo";
import SiteFooter from "./SiteFooter";
import RouteTransition from "@/components/navigation/RouteTransition";
import { RouteErrorBoundary } from "@/components/navigation/RouteErrorBoundary";

import UnverifiedBanner from "./UnverifiedBanner";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DataCacheProvider>
      <NavigationProvider>
        <TaskProvider>
          <SyncEngine />
          <div className="flex min-h-screen bg-background text-ink">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <UnverifiedBanner />
              <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-t-2 border-t-accent border-b border-line bg-background/90 px-4 backdrop-blur-sm lg:hidden">
                <Logo />
                <div className="flex items-center gap-3">
                  <p className="hidden font-mono text-xxs uppercase tracking-label text-muted sm:block">
                    ⌘ K to search
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("taskmind:open-search")
                      )
                    }
                    aria-label="Open search"
                    className="rounded-tm p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </header>
              <div className="flex min-w-0 flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                <main className="min-w-0 flex-1 pb-24 lg:pb-8">
                  <RouteErrorBoundary>
                    <RouteTransition>{children}</RouteTransition>
                  </RouteErrorBoundary>
                </main>
                <AdsRail />
              </div>
              <div className="pb-24 lg:pb-0">
                <SiteFooter />
              </div>
            </div>
            <BottomNav />
            <QuickSearch />
          </div>
        </TaskProvider>
      </NavigationProvider>
    </DataCacheProvider>
  );
}

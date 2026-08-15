"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { TaskProvider } from "@/context/TaskContext";
import { DataCacheProvider } from "@/lib/data-cache";
import { NavigationProvider } from "@/lib/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { AdsRail } from "./AdsRail";
import QuickSearch from "./QuickSearch";
import Logo from "./Logo";
import SiteFooter from "./SiteFooter";
import RouteTransition from "@/components/navigation/RouteTransition";
import { RouteErrorBoundary } from "@/components/navigation/RouteErrorBoundary";

import UnverifiedBanner from "./UnverifiedBanner";

// Background-only (renders null), pulls the sync/OAuth client code out of the
// initial workspace bundle. ssr:false is safe — it does no SSR work.
const SyncEngine = dynamic(
  () => import("@/components/sync/SyncEngine").then((m) => m.SyncEngine),
  { ssr: false }
);

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
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-tm focus:border focus:border-line focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink"
            >
              Skip to content
            </a>
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
                <main id="main-content" className="min-w-0 flex-1 pb-24 lg:pb-8">
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

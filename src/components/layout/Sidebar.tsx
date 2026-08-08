"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  SquareKanban,
  History,
  Folder,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
} from "lucide-react";
import Logo from "./Logo";

const NAV_ITEMS = [
  { name: "New Analysis", href: "/", icon: LayoutDashboard },
  { name: "My Actions", href: "/actions", icon: SquareKanban },
  { name: "History", href: "/history", icon: History },
  { name: "Saved", href: "/saved", icon: Folder },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-t-2 border-t-accent border-line bg-surface/70 backdrop-blur-sm lg:flex ${
        collapsed ? "w-16" : "w-60"
      } transition-[width] duration-200`}
      aria-label="Primary navigation"
    >
      <div
        className={`flex h-16 items-center border-b border-line ${
          collapsed ? "justify-center px-0" : "justify-between px-4"
        }`}
      >
        {!collapsed && <Logo />}
        {collapsed && (
          <span className="flex h-8 w-8 items-center justify-center bg-accent text-white">
            <span className="font-display text-sm font-bold">T</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-[3px] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`group flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-ink text-background"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "text-background" : "text-muted group-hover:text-ink"
                }`}
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        {!collapsed && (
          <div className="mb-3 rounded-[3px] border border-line bg-background p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Workspace
            </p>
            <p className="mt-1 text-sm font-medium text-ink">Free plan</p>
            <Link
              href="/settings"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark"
            >
              <Zap className="h-3.5 w-3.5" />
              Preferences
            </Link>
          </div>
        )}
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={`group flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Settings className="h-4 w-4 shrink-0 text-muted group-hover:text-ink" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}

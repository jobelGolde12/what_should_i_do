"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import Logo from "./Logo";
import SmartLink from "@/components/navigation/SmartLink";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/lib/pro/usePlan";
import { PRO_TIER_DISPLAY } from "@/lib/pro/plans";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, status, logout } = useAuth();
  const { tier } = usePlan();
  const loading = status === "loading";

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
          <span className="flex h-8 w-8 items-center justify-center bg-accent-btn text-white">
            <span className="font-display text-sm font-bold">T</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-tm p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <SmartLink
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.name : undefined}
              title={collapsed ? item.name : undefined}
              className={`group flex items-center gap-3 rounded-tm px-3 py-2.5 text-sm transition-colors ${
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
            </SmartLink>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        {!collapsed && (
          <div className="mb-3 rounded-tm border border-line bg-background p-3">
            <p className="text-2xs uppercase tracking-wide text-muted">
              Workspace
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {PRO_TIER_DISPLAY[tier]} plan
            </p>
          </div>
        )}

        {!loading &&
          (user ? (
            <div className="mb-3 flex items-center gap-2 rounded-tm border border-line bg-background p-3">
              <UserRound className="h-4 w-4 shrink-0 text-muted" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                  >
                    <LogOut className="h-3 w-3" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              aria-label={collapsed ? "Sign in" : undefined}
              title={collapsed ? "Sign in" : undefined}
              className={`group mb-3 flex items-center gap-3 rounded-tm border border-line bg-background px-3 py-2.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <LogIn className="h-4 w-4 shrink-0 text-muted group-hover:text-ink" />
              {!collapsed && <span>Sign in to sync</span>}
            </Link>
          ))}
      </div>
    </aside>
  );
}

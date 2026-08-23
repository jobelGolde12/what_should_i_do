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
      className={`
        sticky
        top-0
        hidden
        h-screen
        shrink-0
        flex-col
        border-r
        border-line
        bg-background
        lg:flex
        ${collapsed ? "w-16" : "w-60"}
        transition-[width]
        duration-200
      `}
      aria-label="Primary navigation"
    >
      {/* ---- Header ---- */}
      <div
        className={`
          flex
          h-14
          items-center
          border-b
          border-line
          ${collapsed ? "justify-center px-0" : "justify-between px-4"}
        `}
      >
        {!collapsed && <Logo />}
        {collapsed && (
          <span
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-lg
              bg-black
              text-white
            "
          >
            <span className="font-display text-xs font-bold">T</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={
            collapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          className="
            rounded-lg
            p-1.5
            text-muted
            transition-colors
            hover:bg-surface-2
            hover:text-ink
          "
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ---- Navigation ---- */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(
            item.href,
            pathname
          );
          const Icon = item.icon;

          return (
            <SmartLink
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.name : undefined}
              title={collapsed ? item.name : undefined}
              className={`
                group
                relative
                flex
                items-center
                gap-3
                rounded-lg
                px-3
                py-2
                text-[13px]
                font-medium
                transition-all
                duration-150
                ${collapsed ? "justify-center" : ""}
                ${
                  active
                    ? "bg-ink text-background"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }
              `}
            >
              {active && (
                <span
                  className="
                    absolute
                    -left-2
                    top-1/2
                    h-4
                    w-[3px]
                    -translate-y-1/2
                    rounded-full
                    bg-background
                  "
                />
              )}
              <Icon
                className={`
                  h-4
                  w-4
                  shrink-0
                  ${active ? "text-background" : "text-muted group-hover:text-ink"}
                `}
              />
              {!collapsed && <span>{item.name}</span>}
            </SmartLink>
          );
        })}
      </nav>

      {/* ---- Bottom section ---- */}
      <div className="        border-t border-line p-3">
        {!collapsed && (
          <div
            className="
              mb-3
              rounded-lg
              bg-surface
              px-3
              py-2.5
            "
          >
            <p
              className="
                text-[10px]
                font-semibold
                uppercase
                tracking-widest
                text-muted
              "
            >
              Workspace
            </p>
            <p
              className="
                mt-0.5
                text-[13px]
                font-medium
                text-ink
              "
            >
              {PRO_TIER_DISPLAY[tier]} plan
            </p>
          </div>
        )}

        {!loading &&
          (user ? (
            <div
              className={`
                mb-3
                flex
                items-center
                gap-2.5
                rounded-lg
                bg-surface
                px-3
                py-2.5
                ${collapsed ? "justify-center" : ""}
              `}
            >
              <div
                className="
                  flex
                  h-7
                  w-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-surface-2
                  text-muted
                "
              >
                <UserRound className="h-3.5 w-3.5" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p
                    className="
                    truncate
                    text-[13px]
                    font-medium
                    text-ink
                    "
                  >
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="
                      mt-0.5
                      inline-flex
                      items-center
                      gap-1
                      text-[11px]
                      text-muted
                      transition-colors
                      hover:text-ink
                    "
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
              className={`
                group
                mb-3
                flex
                items-center
                gap-3
                rounded-lg
                bg-surface
                px-3
                py-2.5
                text-[13px]
                font-medium
                text-muted
                transition-all
                duration-150
                hover:bg-ink
                hover:text-background
                ${collapsed ? "justify-center" : ""}
              `}
            >
              <LogIn
                className="
                  h-4
                  w-4
                  shrink-0
                  text-muted
                  group-hover:text-background
                "
              />
              {!collapsed && <span>Sign in</span>}
            </Link>
          ))}
      </div>
    </aside>
  );
}

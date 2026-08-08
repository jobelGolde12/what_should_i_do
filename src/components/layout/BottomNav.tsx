"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, SquareKanban, History, Folder, Settings } from "lucide-react";

const NAV_ITEMS = [
  { name: "New", href: "/", icon: LayoutDashboard },
  { name: "Actions", href: "/actions", icon: SquareKanban },
  { name: "History", href: "/history", icon: History },
  { name: "Saved", href: "/saved", icon: Folder },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 backdrop-blur-sm lg:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={`flex h-10 w-12 items-center justify-center rounded-[3px] ${
                  active ? "bg-accent-soft" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

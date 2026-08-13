"use client";

import { usePathname } from "next/navigation";
import SmartLink from "@/components/navigation/SmartLink";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 backdrop-blur-sm lg:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <SmartLink
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-xxs font-medium transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span
                className={`flex h-10 w-12 items-center justify-center rounded-tm ${
                  active ? "bg-accent-soft" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.name}
            </SmartLink>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import SmartLink from "@/components/navigation/SmartLink";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-sm lg:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-6">
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
              className={`
                flex
                flex-col
                items-center
                gap-1
                py-2
                text-[11px]
                font-medium
                transition-colors
                duration-150
                ${active ? "text-black" : "text-neutral-400"}
              `}
            >
              <span
                className={`
                  flex
                  h-9
                  w-12
                  items-center
                  justify-center
                  rounded-xl
                  transition-colors
                  duration-150
                  ${active ? "bg-black text-white" : ""}
                `}
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

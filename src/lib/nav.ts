import {
  LayoutDashboard,
  SquareKanban,
  Inbox,
  History,
  Folder,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { name: "New Analysis", href: "/", icon: LayoutDashboard },
  { name: "My Actions", href: "/actions", icon: SquareKanban },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "History", href: "/history", icon: History },
  { name: "Saved", href: "/saved", icon: Folder },
  { name: "Settings", href: "/settings", icon: Settings },
] as const;

export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

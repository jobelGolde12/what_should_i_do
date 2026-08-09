"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useNavigation } from "@/lib/navigation";

type Props = Omit<
  ComponentProps<typeof Link>,
  "href" | "onClick" | "onMouseEnter" | "onFocus" | "prefetch"
> & {
  href: string;
  children: ReactNode;
  /** When false, skips Navigation Service and uses plain Link behavior. */
  smart?: boolean;
};

/**
 * Smart navigation entry point: hover/focus prefetches JS + critical data;
 * click commits the transition (skeleton) then pushes the route.
 */
export default function SmartLink({
  href,
  children,
  smart = true,
  ...rest
}: Props) {
  const { prefetch, navigate, enabled } = useNavigation();
  const active = smart && enabled;

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => {
        if (active) prefetch(href);
      }}
      onFocus={() => {
        if (active) prefetch(href);
      }}
      onClick={(e) => {
        if (!active) return;
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          bottom-full
          left-1/2
          z-50
          mb-2
          -translate-x-1/2
          translate-y-1
          whitespace-nowrap
          rounded-tm
          bg-night
          px-2
          py-1
          font-mono
          text-xxs
          font-medium
          tracking-wide
          text-white
          opacity-0
          shadow-[0_8px_24px_rgba(0,0,0,0.18)]
          transition-all
          duration-150
          group-hover/tt:translate-y-0
          group-hover/tt:opacity-100
          group-focus-within/tt:translate-y-0
          group-focus-within/tt:opacity-100
        "
      >
        {label}
      </span>
    </span>
  );
}

type IconButtonProps = {
  label: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function IconButton({
  label,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        {...rest}
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-full
          text-muted
          transition-all
          duration-150
          hover:bg-surface-2
          hover:text-ink
          active:scale-90
          disabled:cursor-not-allowed
          disabled:opacity-40
          focus-visible:outline-2
          focus-visible:outline-offset-2
          focus-visible:outline-accent
        "
      >
        {children}
      </button>
    </Tooltip>
  );
}

type IconLinkProps = {
  label: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "aria-label">;

/** Same look as `IconButton`, but rendered as a real anchor so links can be
 *  opened in a new tab (target="_blank") via click or middle-click. */
export function IconLink({
  label,
  children,
  ...rest
}: IconLinkProps) {
  return (
    <Tooltip label={label}>
      <a
        aria-label={label}
        {...rest}
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-full
          text-muted
          transition-all
          duration-150
          hover:bg-surface-2
          hover:text-ink
          active:scale-90
          focus-visible:outline-2
          focus-visible:outline-offset-2
          focus-visible:outline-accent
        "
      >
        {children}
      </a>
    </Tooltip>
  );
}

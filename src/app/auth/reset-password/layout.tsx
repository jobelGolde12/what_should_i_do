import type { ReactNode } from "react";

export const metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscription & Billing",
  robots: { index: false, follow: false },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

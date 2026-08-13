import type { Metadata } from "next";
import InboxView from "@/components/inbox/InboxView";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default function InboxPage() {
  return <InboxView />;
}

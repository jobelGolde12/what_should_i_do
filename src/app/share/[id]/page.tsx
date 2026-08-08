import type { Metadata } from "next";
import ShareView from "@/components/share/ShareView";

export const metadata: Metadata = {
  title: "Shared analysis - TaskMind",
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return <ShareView />;
}

import type { Metadata } from "next";
import ActionsBoard from "@/components/board/ActionsBoard";

export const metadata: Metadata = {
  title: "My Actions",
  robots: { index: false, follow: false },
};

export default function ActionsPage() {
  return <ActionsBoard />;
}

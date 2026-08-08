import { ChevronRight } from "lucide-react";

export default function NextStepCard({ nextStep }: { nextStep: string }) {
  return (
    <div className="border-l-2 border-accent bg-accent-soft px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        If you do only one thing
      </p>
      <p className="mt-1.5 flex items-start gap-2 text-sm font-medium leading-relaxed text-ink">
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        {nextStep}
      </p>
    </div>
  );
}

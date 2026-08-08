export default function ActionList({ actions }: { actions: string[] }) {
  if (actions.length === 0) return null;
  return (
    <div>
      <ul className="space-y-3">
        {actions.map((action, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border border-line bg-surface font-mono text-[10px] text-muted">
              {i + 1}
            </span>
            <span className="min-w-0 text-sm leading-relaxed text-ink">
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

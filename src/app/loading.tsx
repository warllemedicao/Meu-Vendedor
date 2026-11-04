export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-48 rounded-lg bg-surface-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-surface-muted" />
      <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}

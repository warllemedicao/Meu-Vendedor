import Link from "next/link";

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-background"
      >
        MV
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Meu Vendedor</span>
        <span className="block text-xs text-muted">Viral Commerce AI</span>
      </span>
    </Link>
  );
}

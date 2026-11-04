import type { ReactNode } from "react";

type Tone = "demo" | "neutral" | "danger";

const tones: Record<Tone, string> = {
  demo: "bg-accent-soft text-accent",
  neutral: "bg-surface-muted text-muted",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

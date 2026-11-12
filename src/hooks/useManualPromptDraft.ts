"use client";
import { useSyncExternalStore } from "react";
import { MAX_MANUAL_PROMPT, promptDraftKey } from "@/lib/manual-chatgpt";
const empty = JSON.stringify({ text: "", applied: "" });
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function read(key: string) {
  if (memory.has(key)) return memory.get(key)!;
  try { return sessionStorage.getItem(key) ?? empty; } catch { return empty; }
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useManualPromptDraft(userId: string | undefined, context: string) {
  const key = promptDraftKey(userId, context);
  const raw = useSyncExternalStore(subscribe, () => read(key), () => empty);
  let data: { text: string; applied: string };
  try { const d = JSON.parse(raw); data = { text: typeof d.text === "string" ? d.text.slice(0, MAX_MANUAL_PROMPT) : "", applied: typeof d.applied === "string" ? d.applied.slice(0, MAX_MANUAL_PROMPT) : "" }; } catch { data = { text: "", applied: "" }; }
  function write(next: typeof data) {
    const value = JSON.stringify(next); memory.set(key, value);
    try { sessionStorage.setItem(key, value); } catch { /* A memória mantém o rascunho nesta navegação. */ }
    listeners.forEach(listener => listener());
  }
  return { ...data, setText: (text: string) => write({ ...data, text: text.slice(0, MAX_MANUAL_PROMPT) }), apply: () => write({ ...data, applied: data.text }), clearApplied: () => write({ ...data, applied: "" }) };
}

/** Private control channel; session IDs, commands and cookies never come from the client. */
export interface FlowExecutorResult {
  active: boolean;
  expires?: number;
  liveViewUrl?: string;
  observed?: { email?: unknown; credits?: unknown; editor?: unknown; loginRequired?: unknown };
  cookies?: unknown[];
}
export async function callFlowExecutor(env: { MV_FLOW_EXECUTOR_URL?: string; MV_FLOW_EXECUTOR_SECRET?: string },
  userKey: string, action: string, cookies?: unknown[], fetcher: typeof fetch = fetch): Promise<FlowExecutorResult> {
  const url = new URL(env.MV_FLOW_EXECUTOR_URL ?? "https://unconfigured.invalid");
  if (url.protocol !== "https:" || !url.hostname.endsWith(".modal.run") || url.username || url.password || !env.MV_FLOW_EXECUTOR_SECRET || env.MV_FLOW_EXECUTOR_SECRET.length < 32) throw new Error("flow_executor_not_configured");
  const response = await fetcher(url.href, { method: "POST", headers: { Authorization: `Bearer ${env.MV_FLOW_EXECUTOR_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userKey, action, ...(cookies ? { cookies } : {}) }), redirect: "manual", signal: AbortSignal.timeout(action === "start" ? 110_000 : 20_000) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(response.status >= 300 && response.status < 400 ? "flow_executor_redirect_denied" : response.status === 429 ? "flow_executor_rate_limited" : "flow_executor_unavailable"); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("flow_executor_invalid_response");
  let size = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 140000) throw new Error("flow_executor_response_limit"); chunks.push(chunk.value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const result = JSON.parse(new TextDecoder().decode(bytes)) as FlowExecutorResult;
  if (typeof result.active !== "boolean") throw new Error("flow_executor_invalid_response");
  return result;
}

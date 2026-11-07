// Contracts verified against Kaggle CLI 2.2.5 / kagglesdk 0.1.38.
const base = "https://api.kaggle.com/v1";
const rec = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const pilotSlug = "meu-vendedor-gpu-pilot";
export const gpuPilotCode = `import json
from pathlib import Path
import torch
report = {"cuda_available": torch.cuda.is_available(), "torch_version": torch.__version__, "devices": []}
for i in range(torch.cuda.device_count()):
    props = torch.cuda.get_device_properties(i)
    report["devices"].append({"name": props.name, "vram_bytes": props.total_memory})
Path("/kaggle/working/gpu-report.json").write_text(json.dumps(report))
print(json.dumps(report))
assert report["cuda_available"], "GPU not assigned"
`;
export function createKagglePilotClient(token: string, fetcher: typeof fetch = fetch) {
  async function call(service: string, method: string, payload: Record<string, unknown>) {
    let response: Response;
    try { response = await fetcher(`${base}/${service}/${method}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(30_000),
    }); } catch { throw new Error("kaggle_network_unavailable"); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`kaggle_http_${response.status}`); }
    const reader = response.body?.getReader(); if (!reader) throw new Error("kaggle_response_invalid");
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const p = await reader.read(); if (p.done) break; size += p.value.length; if (size > 262144) throw new Error("kaggle_response_too_large"); chunks.push(p.value); } }
    finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return rec(JSON.parse(new TextDecoder().decode(bytes))); } catch { throw new Error("kaggle_response_invalid"); }
  }
  async function owner() {
    const info = await call("security.OAuthService", "IntrospectToken", { token });
    if (info.active !== true || typeof info.username !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(info.username)) throw new Error("kaggle_token_invalid");
    return info.username;
  }
  return {
    async check() {
      await owner();
      const quota = await call("kernels.KernelsApiService", "GetAcceleratorQuotaStatistics", {});
      const gpu = rec(quota.gpuQuota);
      // Durations are protobuf seconds strings, never infer a 30-hour grant.
      const duration = (v: unknown) => typeof v === "string" && /^\d+(\.\d+)?s$/.test(v) ? Number(v.slice(0, -1)) : null;
      return { tokenValid: true, gpuTotalSeconds: duration(gpu.totalTimeAllowed), gpuUsedSeconds: duration(gpu.timeUsed), gpuReservedSeconds: duration(gpu.timeReserved), quotaRefreshTime: typeof quota.quotaRefreshTime === "string" ? quota.quotaRefreshTime : null };
    },
    async start() {
      const username = await owner();
      const result = await call("kernels.KernelsApiService", "SaveKernel", {
        slug: `${username}/${pilotSlug}`, newTitle: "Meu Vendedor GPU Pilot", text: gpuPilotCode,
        language: "python", kernelType: "script", isPrivate: true, enableGpu: true, enableInternet: false,
        machineShape: "NvidiaTeslaT4", sessionTimeoutSeconds: 300,
      });
      if (result.error) throw new Error("kaggle_pilot_rejected");
      if (!result.ref && !(typeof result.kernelId === "number" && result.kernelId > 0)) throw new Error("kaggle_submission_uncertain");
      return { submitted: true, kernel: `${username}/${pilotSlug}`, version: typeof result.versionNumber === "number" ? result.versionNumber : null };
    },
    async status() {
      const username = await owner();
      const result = await call("kernels.KernelsApiService", "GetKernelSessionStatus", { userName: username, kernelSlug: pilotSlug });
      const status = typeof result.status === "string" && /^[A-Z_]{1,40}$/.test(result.status) ? result.status : "UNKNOWN";
      const summary: { status: string; failed: boolean; outputFiles?: string[]; gpuReport?: Record<string, unknown> } = { status, failed: Boolean(result.failureMessage) };
      if (status === "COMPLETE" || status === "ERROR") {
        const output = await call("kernels.KernelsApiService", "ListKernelSessionOutput", { userName: username, kernelSlug: pilotSlug, pageSize: 20 });
        summary.outputFiles = (Array.isArray(output.files) ? output.files : []).map(f => rec(f).fileName).filter((s): s is string => typeof s === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(s));
        // Parse only our fixed notebook's structured GPU report; never return raw logs or URLs.
        const inspect = (value: unknown, depth = 0): void => {
          if (depth > 5 || summary.gpuReport) return;
          if (typeof value === "string") {
            for (const line of value.split("\n").slice(0, 200)) {
              try { inspect(JSON.parse(line), depth + 1); } catch { /* other runtime logs are ignored */ }
            }
          } else if (Array.isArray(value)) value.slice(0, 200).forEach(v => inspect(v, depth + 1));
          else {
            const row = rec(value);
            if (typeof row.cuda_available === "boolean") {
              summary.gpuReport = { cudaAvailable: row.cuda_available, devices: (Array.isArray(row.devices) ? row.devices : []).slice(0, 8).map(v => {
                const d = rec(v); return { name: typeof d.name === "string" ? d.name.slice(0, 100) : null, vramBytes: typeof d.vram_bytes === "number" ? d.vram_bytes : null };
              }) };
            } else Object.values(row).slice(0, 50).forEach(v => inspect(v, depth + 1));
          }
        };
        inspect(output.log);
      }
      return summary;
    },
  };
}

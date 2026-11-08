export const presenters = ["ana", "carla", "rafael", "lucas"] as const;
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
export function approvedCrop(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 4 && value.every(v => Number.isInteger(v) && v >= 0 && v <= 4096) && value[2] > value[0] && value[3] > value[1];
}
export function kernelSource(runner: string, config: Record<string, unknown>) {
  // JSON is data, never Python code, even if a URL contains quotes or newlines.
  return `import json\nHYBRID_CONFIG = json.loads(${JSON.stringify(JSON.stringify(config))})\n${runner}`;
}

export interface GenerationToolView { id: string; label: string; available: boolean; reason: string }
/** Pending integrations are offered separately and never determine existing providers' readiness. */
export function splitGenerationTools(tools: readonly GenerationToolView[]) {
  return { available: tools.filter((tool) => tool.available), pending: tools.filter((tool) => !tool.available) };
}

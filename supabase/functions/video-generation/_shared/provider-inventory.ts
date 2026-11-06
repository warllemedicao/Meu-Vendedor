export interface ProductionService {
  id: string;
  name: string;
  stage: "script" | "image" | "video" | "audio" | "unassigned";
  configured: boolean;
  integrated: boolean;
}

// Presença de credencial não equivale a saldo, licença ou adaptador implementado.
export function productionServiceInventory(has: (name: string) => boolean): ProductionService[] {
  const definitions = [
    { id: "google-gemini", name: "Gemini", stage: "script", keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], integrated: true },
    { id: "cloudflare-workers-ai", name: "Cloudflare", stage: "image", keys: ["CLOUDFLARE_AI_API_TOKEN"], integrated: true },
    { id: "magic-hour", name: "Magic Hour", stage: "video", keys: ["MAGIC_HOUR_API_KEY"], integrated: true },
    { id: "replicate", name: "Replicate", stage: "video", keys: ["REPLICATE_API_TOKEN"], integrated: true },
    { id: "runway", name: "Runway", stage: "video", keys: ["RUNWAYML_API_SECRET", "RUNWAY_API_KEY"], integrated: false },
    { id: "groq", name: "Groq", stage: "script", keys: ["GROQ_API_KEY"], integrated: true },
    { id: "openrouter", name: "OpenRouter", stage: "script", keys: ["OPENROUTER_API_KEY"], integrated: true },
    { id: "kaggle", name: "Kaggle", stage: "unassigned", keys: ["KAGGLE_API_TOKEN"], integrated: false },
    { id: "huggingface", name: "Hugging Face", stage: "unassigned", keys: ["HUGGINGFACE_API_KEY", "HUGGINGFACE_API_TOKEN", "HUGGINGFACE_TOKEN", "HUGGING_FACE_TOKEN", "HF_TOKEN"], integrated: false },
    { id: "modal", name: "Modal", stage: "unassigned", keys: ["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"], integrated: false },
  ] as const;
  return definitions.map(({ keys, ...service }) => ({ ...service, configured:
    service.id === "modal" ? keys.every(has) :
    service.id === "cloudflare-workers-ai" ? keys.some(has) && has("CLOUDFLARE_ACCOUNT_ID") : keys.some(has) }));
}

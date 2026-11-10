"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductVideoStudio } from "./ProductVideoStudio";
import { VideoStudio } from "./VideoStudio";

export function VideoWorkspace() {
  const [mode, setMode] = useState<"product" | "presenter">("product");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  return <div className="space-y-5">
    <div role="tablist" aria-label="Tipo de vídeo" className="flex flex-wrap gap-2">
      <button role="tab" aria-selected={mode === "product"} aria-controls="product-panel" id="product-tab" disabled={busy}
        onClick={() => setMode("product")} className={`rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50 ${mode === "product" ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted"}`}>Vídeo de produto</button>
      <button role="tab" aria-selected={mode === "presenter"} aria-controls="presenter-panel" id="presenter-tab" disabled={busy}
        onClick={() => setMode("presenter")} className={`rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50 ${mode === "presenter" ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted"}`}>Personagens · experimental</button>
    </div>
    <div role="tabpanel" id="product-panel" aria-labelledby="product-tab" hidden={mode !== "product"}>
      <ProductVideoStudio key={user?.id ?? "guest"} onBusyChange={setBusy} active={mode === "product"} />
    </div>
    {mode === "presenter" && <div role="tabpanel" id="presenter-panel" aria-labelledby="presenter-tab" className="space-y-4">
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Área experimental. O formato de foto falante está disponível; movimento corporal e interação fiel com produtos continuam em desenvolvimento.</p>
      <VideoStudio />
    </div>}
  </div>;
}

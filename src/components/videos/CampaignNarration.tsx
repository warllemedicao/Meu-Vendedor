"use client";
import { useEffect, useRef, useState } from "react";
import { campaignInvoke } from "@/lib/campaign-ai";
import { composeNarratedVideo } from "@/lib/compose-narrated-video";
import { renderProductVideo } from "@/lib/render-product-video";
const field = "mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm";
export function CampaignNarration({ source, speech, onReady, onBusy }: { source: { blob: Blob; filename: string }; speech: string; onReady: (value: { blob: Blob; filename: string } | null) => void; onBusy: (busy: boolean) => void }) {
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]), [voice, setVoice] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [existing, setExisting] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; void campaignInvoke("audio-generation", { action: "capabilities" }).then(data => { if (alive.current) { setVoices(data.voices ?? []); setVoice(data.voices?.[0]?.id ?? ""); } }).catch(failure => { if (alive.current) setError(failure instanceof Error ? failure.message : "Narração indisponível."); }); return () => { alive.current = false; }; }, []);
  async function generate() {
    if (lock.current || !voice || !speech.trim()) return;
    lock.current = true; setBusy(true); onBusy(true); setError(""); onReady(null); setReady(false);
    const context = typeof AudioContext === "undefined" ? undefined : new AudioContext();
    const resumed = context?.resume();
    let local: string | undefined;
    try {
      if (!context) throw new Error("Seu navegador não suporta aplicar narração. Use Chrome, Edge ou Safari atualizados.");
      await resumed;
      const audio = await campaignInvoke("audio-generation", { action: "generate", text: speech, voiceId: voice, purpose: "commercial" });
      if (audio.commercial !== true || typeof audio.url !== "string") throw new Error("A narração não foi liberada para divulgação comercial.");
      const response = await fetch(audio.url, { redirect: "error" }); if (!response.ok) throw new Error("Não foi possível carregar a narração.");
      let video = source.blob;
      if (source.blob.type.startsWith("image/")) {
        local = URL.createObjectURL(source.blob); const file = new File([source.blob], source.filename, { type: source.blob.type });
        video = await renderProductVideo([{ id: "photo", file, kind: "image", url: local }], { format: "9:16", secondsPerScene: 3, transition: "fade", zoom: true, title: "", price: "", callToAction: "" }, new AbortController().signal, () => {});
      }
      const output = await composeNarratedVideo(video, await response.blob(), context);
      if (alive.current) { onReady({ blob: new Blob([output], { type: output.type.split(";")[0] }), filename: `divulgacao-${crypto.randomUUID()}.${output.type.startsWith("video/mp4") ? "mp4" : "webm"}` }); setReady(true); }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Não foi possível aplicar a narração."); }
    finally { if (context && context.state !== "closed") await context.close(); if (local) URL.revokeObjectURL(local); lock.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  return <div className="space-y-4">
    <h3 className="font-semibold">Voz do anúncio</h3><p className="text-sm text-muted">A voz escolhida vai falar o roteiro aprovado. O áudio original é substituído pela narração; se ela durar mais, o vídeo mantém o último quadro até terminar a fala.</p>
    {source.blob.type.startsWith("video/") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={existing} disabled={busy} onChange={e => { setExisting(e.target.checked); setReady(e.target.checked); onReady(e.target.checked ? source : null); }} />Meu vídeo já tem a narração que quero usar</label>}
    {!existing && <><label className="block text-sm">Narrador<select value={voice} disabled={busy} onChange={e => { setVoice(e.target.value); setReady(false); onReady(null); }} className={field}>{!voices.length && <option value="">Consultando vozes…</option>}{voices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="rounded-xl bg-background p-4 text-sm">{speech || "Volte à primeira etapa para criar ou preencher a fala."}</div><button type="button" disabled={busy || !voice || !speech.trim() || speech.length > 1500} onClick={() => void generate()} className="w-full rounded-xl bg-primary px-4 py-3 text-white disabled:opacity-50">{busy ? "Gerando voz e preparando vídeo narrado…" : ready ? "Gerar novamente com esta voz" : "Gerar narração e aplicar ao vídeo"}</button></>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {ready && <p role="status" className="text-sm text-primary">Vídeo pronto para conferir abaixo.</p>}
  </div>;
}

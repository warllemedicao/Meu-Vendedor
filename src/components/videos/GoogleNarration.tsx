"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { createVideoAssetUrl } from "@/lib/video-assets";
import { filterAlternativeVoices } from "@/lib/video-submission";

type Voice = { id: string; name: string; gender: string; language: string };
type Capabilities = { available: boolean; tier: string; remaining: number | null; commercial: boolean; voices: Voice[]; presenterVoices: Record<string, string> };
type Result = { id: string; url: string; commercial: boolean; tier: string; text?: string };

async function invoke(body: Record<string, unknown>) {
  const client = getSupabase();
  if (!client) throw new Error("Entre na sua conta para usar narração.");
  const { data, error } = await client.functions.invoke("audio-generation", { body });
  if (error) {
    if (error.context instanceof Response) {
      const failure = await error.context.json().catch(() => null);
      if (typeof failure?.error?.message === "string") throw new Error(failure.error.message);
    }
    throw new Error("Não foi possível acessar a narração Google agora. A geração de vídeo continua disponível.");
  }
  if (data?.error?.message) throw new Error(data.error.message);
  return data;
}

export function GoogleNarration({ script, voiceGender, presenterId, videoResults }: {
  script: string; voiceGender: string; presenterId: string; videoResults: { id: string; path: string }[];
}) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [voice, setVoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storedResult, setResult] = useState<Result | null>(null);
  const result = storedResult && (!storedResult.text || storedResult.text === script) ? storedResult : null;
  const [refresh, setRefresh] = useState(0);
  const [videoId, setVideoId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<{ id: string; tier: string; commercial: boolean; created_at: string }[]>([]);
  const effectiveText = script;
  const filteredVoices = filterAlternativeVoices(capabilities?.voices ?? [], voiceGender);
  const fixedVoice = capabilities?.presenterVoices?.[presenterId] ?? "";
  const selectedVoice = filteredVoices.some(v => v.id === voice) ? voice : fixedVoice;
  const voiceName = capabilities?.voices.find(v => v.id === fixedVoice)?.name;
  useEffect(() => {
    let active = true;
    void invoke({ action: "capabilities" }).then((value: Capabilities) => {
      if (!active) return;
      setCapabilities(value);
      setVoice(current => value.voices.some(v => v.id === current) ? current : "");
      setError("");
    }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : "Narração indisponível."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, voiceGender]);
  useEffect(() => {
    let active = true;
    const client = getSupabase();
    if (client) void client.from("mv_audio_generations").select("id,tier,commercial,created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => { if (active) setHistory(data ?? []); });
    return () => { active = false; };
  }, [result?.id]);
  async function generate() {
    setBusy(true); setError("");
    try {
      const value = await invoke({ action: "generate", text: effectiveText, voiceId: selectedVoice, purpose: "commercial" });
      setResult({ ...value, text: effectiveText });
      setRefresh(v => v + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível gerar a narração."); }
    finally { setBusy(false); }
  }
  async function getAudio(current: Result): Promise<Blob> {
    const updated = await invoke({ action: "result", id: current.id });
    const response = await fetch(updated.url, { redirect: "error" });
    if (!response.ok) throw new Error("Não foi possível baixar o áudio.");
    return response.blob();
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function exportResult(withVideo: boolean) {
    if (!result) return;
    // Resume in the button event, before awaiting signed URLs and downloads.
    const context = withVideo && typeof AudioContext !== "undefined" ? new AudioContext() : undefined;
    const resumed = context?.resume();
    setExporting(true); setError("");
    try {
      await resumed;
      const audio = await getAudio(result);
      if (!withVideo) { download(audio, `narracao-${result.id}.mp3`); return; }
      const selected = videoResults.find(v => v.id === videoId) ?? videoResults[0];
      const client = getSupabase();
      const { data } = await client!.auth.getUser();
      if (!selected || !data.user) throw new Error("Selecione um vídeo concluído.");
      const url = await createVideoAssetUrl(client!, data.user.id, selected.path);
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok) throw new Error("Não foi possível abrir o vídeo.");
      const { composeNarratedVideo } = await import("@/lib/compose-narrated-video");
      const output = await composeNarratedVideo(await response.blob(), audio, context);
      download(output, `video-narrado-${result.id}.${output.type.startsWith("video/mp4") ? "mp4" : "webm"}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível exportar."); }
    finally { if (context && context.state !== "closed") await context.close(); setExporting(false); }
  }
  return <div className="block text-sm font-medium">
    <label htmlFor="alternative-voice">Voz Google do personagem</label>
    <select id="alternative-voice" aria-label="Voz Google do personagem" value={voice && selectedVoice === voice ? voice : ""}
      onChange={e => { setVoice(e.target.value); setResult(null); setError(""); }}
      className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm font-normal">
      <option value="">Voz fixa{voiceName ? ` · ${voiceName}` : " do personagem"}</option>
      {filteredVoices.length > 0 && <optgroup label="Google · alternativas em português brasileiro">
        {filteredVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </optgroup>}
    </select>
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-normal text-muted">
      <span>{loading ? "Consultando vozes…" : `${filteredVoices.length} vozes compatíveis com o tipo selecionado`}</span>
      <button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setRefresh(v => v + 1); }} className="text-primary underline">Atualizar vozes</button>
    </div>
    {selectedVoice && <div className="mt-2 space-y-2 text-xs font-normal">
      <p className="text-muted">Narração em português brasileiro com voz fixa por personagem. Ouça e exporte com o roteiro. A geração de vídeo atual ainda usa o áudio da ferramenta; sincronização labial automática está em preparação.</p>
      {capabilities?.remaining != null && <p className="text-muted">{capabilities.remaining.toLocaleString("pt-BR")} caracteres disponíveis no limite mensal do aplicativo. Outros usos do projeto Google são contabilizados separadamente.</p>}
      <button type="button" disabled={busy || !capabilities?.available || effectiveText.trim().length < 2 || effectiveText.length > 1500}
        onClick={() => void generate()} className="text-primary underline disabled:opacity-50">{busy ? "Preparando voz…" : "Ouvir esta voz com o roteiro"}</button>
      {result && <>
        <audio key={result.url} controls preload="metadata" src={result.url} className="h-9 w-full" />
        <button type="button" disabled={exporting} onClick={() => void exportResult(false)} className="text-primary underline">Baixar narração</button>
        {videoResults.length > 0 && <details>
          <summary className="cursor-pointer text-muted">Exportar vídeo com esta narração</summary>
          <div className="mt-2 space-y-2">
            <select aria-label="Vídeo para narração" value={videoId || videoResults[0].id} onChange={e => setVideoId(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2">
              {videoResults.map((v,i) => <option key={v.id} value={v.id}>Vídeo concluído {i+1}</option>)}
            </select>
            <button type="button" disabled={exporting} onClick={() => void exportResult(true)} className="text-primary underline">{exporting ? "Preparando arquivo…" : "Baixar vídeo com esta voz"}</button>
            <p className="text-muted">Substitui o áudio na exportação; preserva o original. MP4 ou WebM conforme o navegador. Não sincroniza os lábios.</p>
          </div>
        </details>}
      </>}
      {history.length > 0 && <details><summary className="cursor-pointer text-muted">Narrações salvas</summary><ul className="mt-2 space-y-1">{history.map(item => <li key={item.id}><button type="button" onClick={() => { setError(""); void invoke({ action: "result", id: item.id }).then(setResult).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Não foi possível abrir o áudio.")); }} className="text-primary underline">{new Date(item.created_at).toLocaleString("pt-BR")}</button></li>)}</ul></details>}
    </div>}
    {error && <p role="status" className="mt-2 text-xs font-normal text-muted">{error} A voz original do vídeo continua disponível.</p>}
  </div>;
}

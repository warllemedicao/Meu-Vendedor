"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type BrowserResponse = { status?: string; viewUrl?: string; error?: string };

export function PrivateBrowserConnection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function invoke(action: string, extra: Record<string, unknown> = {}) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Autenticação indisponível.");
    const { data, error } = await supabase.functions.invoke<BrowserResponse>("private-browser", {
      body: { action, ...extra },
    });
    if (error || !data || data.error) throw new Error(data?.error ?? "Não foi possível acessar o Chrome.");
    return data;
  }

  async function openChrome() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await invoke("start");
      const data = await invoke("view");
      const url = new URL(data.viewUrl ?? "");
      if (url.protocol !== "https:" || !url.pathname.endsWith("/viewer") || !url.searchParams.has("ticket")) {
        throw new Error("Endereço de visualização inválido.");
      }
      setViewUrl(url.toString());
      setMessage("Chrome conectado. Use a sessão do Google Flow para os testes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao abrir o Chrome.");
    } finally {
      setBusy(false);
    }
  }

  function onFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length > 3) {
      setMessage("Selecione no máximo 3 imagens.");
      if (fileInput.current) fileInput.current.value = "";
      setImages([]);
      return;
    }
    if (selected.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage("Use imagens PNG, JPG ou WebP de até 5 MB cada.");
      if (fileInput.current) fileInput.current.value = "";
      setImages([]);
      return;
    }
    setMessage("");
    setImages(selected);
  }

  return <article className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:col-span-2">
    <h3 className="font-semibold">Google Flow · Chrome próprio</h3>
    <p className="text-sm text-muted">Abra seu Chrome no Modal usando a sessão persistente do Google Flow.</p>
    <button type="button" disabled={busy} onClick={() => void openChrome()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
      {busy ? "Abrindo..." : "Chrome"}
    </button>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label htmlFor="flow-test-prompt" className="block text-sm font-medium">Prompt para treinamento do robô</label>
      <textarea id="flow-test-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
        maxLength={4000} rows={5} placeholder="Descreva o vídeo que deseja testar no Flow..."
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm" />
      <label htmlFor="flow-test-images" className="block text-sm font-medium">Imagens de referência (até 3)</label>
      <input ref={fileInput} id="flow-test-images" type="file" multiple accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onFiles(event.target.files)} className="block w-full text-sm" />
      <p className="text-xs text-muted">{images.length} de 3 imagens selecionadas. O prompt e os anexos ficam somente nesta página nesta etapa; o envio automático ao Flow será habilitado após validar a integração do robô.</p>
      <button type="button" onClick={() => void navigator.clipboard.writeText(prompt).then(
        () => setMessage("Prompt copiado. Cole no Chrome para testar."),
        () => setMessage("Não foi possível copiar o prompt.")
      )} disabled={!prompt.trim()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        Copiar prompt
      </button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {viewUrl && <div className="space-y-2">
      <iframe title="Tela privada do Chrome" src={viewUrl} referrerPolicy="no-referrer" className="h-[480px] w-full rounded-lg border border-border" />
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Abrir Chrome em tela cheia</a>
    </div>}
  </article>;
}

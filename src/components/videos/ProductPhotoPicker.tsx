"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { edgeFunctionMessage } from "@/lib/video-submission";
import { PRODUCT_VIDEO_BUCKET, validateProductMedia } from "@/lib/product-video";
import type { PhotoAssessment } from "@/lib/product-photo-filter";

type Candidate = { file: File; url: string; hash: string; assessment: PhotoAssessment; selected: boolean };
const button = "rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";
const labels = { photo: "Foto sugerida", specification: "Possível especificação", description: "Muito texto", review: "Revisar" };
const unread = (): PhotoAssessment => ({ decision: "review", reason: "Sem análise automática. Confira a foto antes de incluir.", text: "", confidence: 0 });
const fingerprint = async (file: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");

export function ProductPhotoPicker({ userId, productId, existingFiles, available, disabled, onAdd, onBusyChange }: {
  userId?: string; productId: string; existingFiles: File[]; available: number; disabled: boolean;
  onAdd(files: File[], title?: string): boolean; onBusyChange(busy: boolean): void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""); const [warning, setWarning] = useState(""); const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const fileInput = useRef<HTMLInputElement>(null); const urls = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null); const alive = useRef(true); const locked = useRef(false);
  const previousProduct = useRef(productId);
  useEffect(() => { alive.current = true; const resources = urls.current; return () => { alive.current = false; controller.current?.abort(); resources.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  // Changing the selected offer invalidates its candidate gallery, including an in-flight response.
  useEffect(() => {
    if (previousProduct.current === productId) return;
    previousProduct.current = productId; controller.current?.abort();
    const timer = setTimeout(() => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setCandidates([]); setWarning(""); setError(""); setTitle(""); }, 0);
    return () => clearTimeout(timer);
  }, [productId]);

  async function analyze(files: File[], signal: AbortSignal) {
    const current: Candidate[] = []; const hashes = new Set(await Promise.all(existingFiles.filter(file => file.type.startsWith("image/")).map(fingerprint)));
    let duplicates = 0, skipped = 0;
    for (const file of files) {
      try { if (validateProductMedia(file) !== "image") { skipped++; continue; } } catch { skipped++; continue; }
      const hash = await fingerprint(file); if (hashes.has(hash)) { duplicates++; continue; } hashes.add(hash);
      const url = URL.createObjectURL(file); urls.current.add(url);
      current.push({ file, url, hash, assessment: unread(), selected: false });
    }
    if (!alive.current || signal.aborted) return;
    setCandidates(current);
    if (duplicates || skipped) setWarning(old => [old, duplicates ? `${duplicates} foto(s) repetida(s) ignorada(s).` : "", skipped ? `${skipped} arquivo(s) inválido(s) ignorado(s).` : ""].filter(Boolean).join(" "));
    if (!current.length) { setStatus("Nenhuma foto nova para analisar."); return; }
    let analyzer: Awaited<ReturnType<typeof import("@/lib/analyze-product-photos").createPhotoAnalyzer>> | undefined;
    try {
      setStatus("Preparando a leitura de texto nas fotos…");
      const { createPhotoAnalyzer } = await import("@/lib/analyze-product-photos");
      analyzer = await createPhotoAnalyzer(signal); let selected = 0;
      for (let i = 0; i < current.length; i++) {
        if (signal.aborted || !alive.current) return;
        setStatus(`Analisando foto ${i + 1} de ${current.length}…`);
        const assessment = await analyzer.analyze(current[i].file);
        if (signal.aborted || !alive.current) return;
        current[i] = { ...current[i], assessment, selected: assessment.decision === "photo" && selected < available };
        if (current[i].selected) selected++;
        setCandidates([...current]);
      }
      setStatus("Análise concluída. Confira as fotos selecionadas antes de adicionar.");
    } catch {
      if (alive.current && !signal.aborted) {
        setWarning(old => `${old} A leitura automática não foi concluída. As fotos sem análise ficaram desmarcadas para revisão manual.`.trim());
        setStatus("Revise as fotos e marque as que deseja usar.");
      }
    } finally { await analyzer?.dispose(); }
  }
  function begin() {
    if (locked.current || disabled) return null;
    locked.current = true; const next = new AbortController(); controller.current = next;
    urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setCandidates([]); setError(""); setWarning(""); setTitle(""); setBusy(true);
    return next;
  }
  function finish(signal: AbortSignal) {
    locked.current = false; if (!alive.current) return; setBusy(false);
    if (signal.aborted) setStatus("Análise cancelada. As fotos já carregadas podem ser revisadas manualmente.");
  }
  async function fromFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = ""; if (!files.length) return;
    const next = begin(); if (!next) return;
    try {
      if (files.length > 12 || files.reduce((sum, file) => sum + file.size, 0) > 60 * 1024 * 1024) throw new Error("Analise até 12 fotos e 60 MB por vez.");
      await analyze(files, next.signal);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Não foi possível analisar as fotos."); }
    finally { finish(next.signal); }
  }
  async function fromListing() {
    const client = getSupabase(); if (!client || !userId || !productId) return;
    const next = begin(); if (!next) return;
    try {
      setStatus("Buscando fotos do anúncio…");
      const { data, error } = await client.functions.invoke("product-gallery", { body: { productId }, signal: next.signal, timeout: 75000 });
      if (error) throw new Error(await edgeFunctionMessage(error, "Não foi possível buscar as fotos do anúncio."));
      if (data?.error) throw new Error(data.message || "Não foi possível buscar as fotos do anúncio.");
      if (!Array.isArray(data?.photos) || data.photos.length > 12) throw new Error("A lista de fotos recebida é inválida.");
      const files: File[] = [];
      for (const [index, photo] of data.photos.entries()) {
        if (!alive.current || next.signal.aborted) return;
        if (typeof photo.path !== "string" || !new RegExp(`^${userId}/inputs/gallery-${productId}-[a-f0-9]{64}\\.(jpg|png|webp)$`).test(photo.path)) throw new Error("Uma foto recebida não pertence a este produto e conta.");
        const { data: blob, error: downloadError } = await client.storage.from(PRODUCT_VIDEO_BUCKET).download(photo.path);
        if (downloadError || !blob || blob.size > 5 * 1024 * 1024) continue;
        files.push(new File([blob], `foto-do-anuncio-${index + 1}.${photo.path.split(".").pop()}`, { type: blob.type }));
      }
      if (!alive.current || next.signal.aborted) return;
      setTitle(typeof data.productTitle === "string" ? data.productTitle.slice(0, 80) : "");
      setWarning([typeof data.warning === "string" ? data.warning : "", data.failed ? "Algumas fotos não puderam ser carregadas." : ""].filter(Boolean).join(" "));
      if (!files.length) throw new Error("Não foi possível abrir as fotos. Tente selecionar os arquivos salvos no dispositivo.");
      await analyze(files, next.signal);
    } catch (failure) { if (alive.current && !next.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível buscar as fotos."); }
    finally { finish(next.signal); }
  }
  const selected = candidates.filter(item => item.selected);
  return <div className="space-y-3 rounded-xl border border-border bg-background p-3">
    <p className="text-sm font-semibold">Fotos do anúncio · seleção com filtro de texto</p>
    <p className="text-xs text-muted">Busque as fotos do produto escolhido no catálogo ou selecione fotos salvas do anúncio. Imagens com medidas, especificações ou muito texto ficam fora da seleção sugerida.</p>
    <div className="flex flex-wrap gap-2">
      {userId && <button type="button" disabled={disabled || busy || !productId || available < 1} onClick={() => void fromListing()} className={button}>Buscar fotos do anúncio</button>}
      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Selecionar fotos do anúncio para análise" onChange={event => void fromFiles(event)} className="sr-only" />
      <button type="button" disabled={disabled || busy || available < 1} onClick={() => fileInput.current?.click()} className={button}>Analisar fotos do dispositivo</button>
    </div>
    {busy && <button type="button" onClick={() => controller.current?.abort()} className="text-xs text-primary underline">Cancelar análise</button>}
    {status && <p role="status" className="text-xs text-muted">{status}</p>}
    {warning && <p role="status" className="rounded-lg border border-border p-2 text-xs text-muted">{warning}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    {candidates.length > 0 && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{candidates.map(item => <div key={item.hash} className={`min-w-0 rounded-xl border p-2 ${item.selected ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}>
        <label className="block cursor-pointer"><input type="checkbox" aria-label={`Usar ${item.file.name}`} checked={item.selected} disabled={busy || disabled || !item.selected && selected.length >= available} onChange={e => setCandidates(old => old.map(candidate => candidate.hash === item.hash ? { ...candidate, selected: e.target.checked } : candidate))} className="mr-2" /><span className="text-xs font-medium">{labels[item.assessment.decision]}</span><PhotoThumbnail url={item.url} name={item.file.name} /></label>
        <p className="mt-1 text-xs text-muted">{item.assessment.reason}</p>
        {item.assessment.text && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Texto identificado</summary><p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words">{item.assessment.text}</p></details>}
      </div>)}</div>
      <p className="text-xs text-muted">{selected.length} foto(s) selecionada(s) · {available} vaga(s) no vídeo. O filtro é uma sugestão: confira o produto, a cor e a variante em cada foto.</p>
      <button type="button" disabled={busy || disabled || !selected.length || selected.length > available} onClick={() => { if (!onAdd(selected.map(item => item.file), title)) { setError("As fotos não puderam ser adicionadas. Confira o limite de cenas e tamanho do vídeo."); return; } urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setCandidates([]); setStatus("Fotos adicionadas às cenas. Você pode ajustar a ordem."); }} className={`${button} border-primary text-primary`}>Adicionar {selected.length} foto(s) ao vídeo</button>
    </>}
  </div>;
}

function PhotoThumbnail({ url, name }: { url: string; name: string }) {
  // Local object URLs are created from validated image files and cannot use Next image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className="mt-2 aspect-square w-full rounded-lg bg-white object-contain" />;
}

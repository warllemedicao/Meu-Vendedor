"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, Copy, Download, ExternalLink, Film, ImagePlus, LoaderCircle, Play, Save, Square, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { importVideoProductImage } from "@/lib/video-submission";
import { MAX_PRODUCT_MEDIA_BYTES, MAX_PRODUCT_SCENES, PRODUCT_VIDEO_BUCKET, ownedProductVideoPath, productVideoFilename, validateProductMedia, type ProductVideoOptions } from "@/lib/product-video";
import { createProductPlayer, productRecordingType, renderProductVideo, type ProductMedia, type ProductPlayer } from "@/lib/render-product-video";
import type { CampaignProduct } from "@/lib/product-campaign";
import { ManualChatGPTPrompt } from "./ManualChatGPTPrompt";
import { useManualPromptDraft } from "@/hooks/useManualPromptDraft";
import { ProductPhotoPicker } from "./ProductPhotoPicker";
import { PublicationCenter } from "./PublicationCenter";

const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";
type Product = { id: string; title: string };
type SavedVideo = { name: string; created_at: string | null };
type Result = { blob: Blob; url: string; filename: string; saved: boolean };
const defaults: ProductVideoOptions = { format: "9:16", secondsPerScene: 3, transition: "fade", zoom: true, title: "", price: "", callToAction: "Confira os detalhes do produto" };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function ProductVideoStudio({ onBusyChange, active, initialProduct, onResult, embedded = false }: { onBusyChange: (busy: boolean) => void; active: boolean; initialProduct?: CampaignProduct; onResult?: (blob: Blob, filename: string) => void; embedded?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const manualPrompt = useManualPromptDraft(user?.id, "product-studio:" + (initialProduct?.id ?? "manual"));
  const [briefDetails, setBriefDetails] = useState("");
  const [items, setItems] = useState<ProductMedia[]>([]);
  const [options, setOptions] = useState<ProductVideoOptions>({ ...defaults, title: initialProduct?.title.slice(0, 80) ?? "", price: initialProduct?.price ?? "" });
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const [importing, setImporting] = useState(false); const [saving, setSaving] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [progress, setProgress] = useState(0); const [supported, setSupported] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ items: ProductMedia[]; options: ProductVideoOptions } | null>(null);
  const ready = prepared?.items === items && prepared?.options === options;
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [products, setProducts] = useState<Product[]>(initialProduct?.owned ? [{ id: initialProduct.id, title: initialProduct.title }] : []); const [productId, setProductId] = useState(initialProduct?.owned ? initialProduct.id : "");
  const [library, setLibrary] = useState<SavedVideo[]>([]); const [libraryError, setLibraryError] = useState(""); const [libraryLoading, setLibraryLoading] = useState(false);
  const [openedVideo, setOpenedVideo] = useState<{ name: string; url: string } | null>(null);
  const [libraryBusy, setLibraryBusy] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null); const player = useRef<ProductPlayer | null>(null);
  const frame = useRef(0); const abort = useRef<AbortController | null>(null); const locked = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resources = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true; const urls = resources.current;
    const check = requestAnimationFrame(() => setSupported(productRecordingType()));
    return () => { mounted.current = false; cancelAnimationFrame(check); abort.current?.abort(); cancelAnimationFrame(frame.current); player.current?.dispose(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  useEffect(() => { onBusyChange(busy || saving || importing || galleryBusy); }, [busy, saving, importing, galleryBusy, onBusyChange]);
  const stopPreview = useCallback(() => { cancelAnimationFrame(frame.current); player.current?.pause(); setPlaying(false); }, []);
  useEffect(() => { if (!active) { const task = requestAnimationFrame(stopPreview); return () => cancelAnimationFrame(task); } }, [active, stopPreview]);
  useEffect(() => {
    if (!items.length || !canvas.current) return;
    const controller = new AbortController(); let current: ProductPlayer | null = null;
    cancelAnimationFrame(frame.current); player.current?.pause();
    void createProductPlayer(canvas.current, items, options, controller.signal).then(value => {
      if (controller.signal.aborted) { value.dispose(); return; }
      current = value; player.current = value; value.draw(0); setPrepared({ items, options }); setPlaying(false);
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível preparar a prévia."); });
    return () => { controller.abort(); cancelAnimationFrame(frame.current); current?.dispose(); if (player.current === current) player.current = null; };
  }, [items, options, stopPreview]);
  const refreshLibrary = useCallback(async () => {
    const client = getSupabase(); if (!client || !user) return;
    setLibraryLoading(true); setLibraryError("");
    try {
      const { data, error } = await client.storage.from(PRODUCT_VIDEO_BUCKET).list(`${user.id}/product-videos`, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      if (mounted.current) setLibrary((data ?? []).filter(row => /^[a-z0-9-]{1,40}--[a-f0-9-]{36}\.(mp4|webm)$/.test(row.name)).map(row => ({ name: row.name, created_at: row.created_at })));
    } catch { if (mounted.current) setLibraryError("Não foi possível carregar seus vídeos salvos. Tente atualizar a biblioteca."); }
    finally { if (mounted.current) setLibraryLoading(false); }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const client = getSupabase(); let alive = true;
    void client?.from("mv_products").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50).then(({ data }) => { if (alive) setProducts(initialProduct?.owned ? [{ id: initialProduct.id, title: initialProduct.title }, ...(data ?? []).filter(p => p.id !== initialProduct.id)] : data ?? []); });
    void Promise.resolve().then(() => { if (alive) return refreshLibrary(); }); return () => { alive = false; };
  }, [user, refreshLibrary, initialProduct?.id, initialProduct?.title, initialProduct?.owned]);

  function addFiles(files: File[]): boolean {
    if (locked.current) return false;
    try {
      if (!files.length) return false;
      if (items.length + files.length > MAX_PRODUCT_SCENES) throw new Error("Use no máximo 8 fotos ou clipes por vídeo.");
      if ([...items.map(item => item.file), ...files].reduce((sum, file) => sum + file.size, 0) > MAX_PRODUCT_MEDIA_BYTES) throw new Error("Os arquivos devem somar até 150 MB.");
      const kinds = files.map(validateProductMedia);
      const added = files.map((file, index) => { const url = URL.createObjectURL(file); resources.current.add(url); return { id: crypto.randomUUID(), file, url, kind: kinds[index] }; });
      setItems(old => [...old, ...added]); setError(""); setNotice("");
      return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível adicionar os arquivos."); return false; }
  }
  function selectFiles(event: ChangeEvent<HTMLInputElement>) { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }
  function move(index: number, delta: number) { const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setItems(next); }
  function remove(id: string) { const item = items.find(item => item.id === id); if (item) { URL.revokeObjectURL(item.url); resources.current.delete(item.url); } setItems(old => old.filter(item => item.id !== id)); }
  async function importProduct() {
    const client = getSupabase(); if (!client || !user || !productId || locked.current) return;
    if (items.length >= MAX_PRODUCT_SCENES) { setError("Use no máximo 8 cenas."); return; }
    setImporting(true); setError("");
    try {
      const path = await importVideoProductImage(client, user.id, productId);
      const { data, error } = await client.storage.from(PRODUCT_VIDEO_BUCKET).download(path);
      if (error || !data) throw new Error("Não foi possível carregar a foto do produto.");
      if (!mounted.current) return;
      const file = new File([data], "produto-do-catalogo", { type: data.type }); addFiles([file]);
      const selected = products.find(product => product.id === productId);
      if (selected) setOptions(old => ({ ...old, title: old.title || selected.title.slice(0, 80) }));
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Falha ao importar produto."); }
    finally { if (mounted.current) setImporting(false); }
  }
  async function preview() {
    if (playing) { stopPreview(); return; }
    const current = player.current; if (!current) return;
    setError("");
    try {
      await current.prepare(0); setPlaying(true); const start = performance.now();
      const tick = () => { const elapsed = (performance.now() - start) / 1000; current.draw(Math.min(elapsed, current.duration - 0.001)); if (elapsed < current.duration) frame.current = requestAnimationFrame(tick); else stopPreview(); };
      tick();
    } catch { stopPreview(); setError("Não foi possível reproduzir um dos clipes. Tente outro arquivo."); }
  }
  async function generate() {
    if (locked.current || !items.length) return;
    locked.current = true; stopPreview(); setBusy(true); setError(""); setNotice(""); setProgress(0);
    abort.current = new AbortController();
    try {
      const blob = await renderProductVideo(items, options, abort.current.signal, setProgress);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob); resources.current.add(url);
      const filename = productVideoFilename(options.title, crypto.randomUUID(), blob.type.startsWith("video/mp4") ? "mp4" : "webm");
      onResult?.(blob, filename);
      setResult(previous => { if (previous) { URL.revokeObjectURL(previous.url); resources.current.delete(previous.url); } return { blob, url, filename, saved: false }; });
      setNotice("Vídeo pronto. Confira o resultado e baixe ou salve na sua conta.");
    } catch (failure) {
      if (mounted.current) { if (failure instanceof DOMException && failure.name === "AbortError") setNotice("Exportação cancelada. Suas cenas continuam aqui."); else setError(failure instanceof Error ? failure.message : "Não foi possível exportar o vídeo."); }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function saveResult() {
    const client = getSupabase(); if (!client || !user || !result || result.saved || locked.current) return;
    const current = result; locked.current = true; setSaving(true); setError("");
    try {
      const path = ownedProductVideoPath(user.id, current.filename);
      const { error } = await client.storage.from(PRODUCT_VIDEO_BUCKET).upload(path, current.blob, { contentType: current.blob.type, upsert: false, cacheControl: "3600" });
      if (error) {
        // An uncertain upload may already exist. Compare bytes instead of creating a second result.
        const { data } = await client.storage.from(PRODUCT_VIDEO_BUCKET).download(path);
        if (!data || data.size !== current.blob.size) throw error;
        const digest = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).join(",");
        if (await digest(data) !== await digest(current.blob)) throw error;
      }
      if (!mounted.current) return;
      setResult(old => old?.filename === current.filename ? { ...old, saved: true } : old); setNotice("Vídeo salvo na sua biblioteca privada."); await refreshLibrary();
    } catch { if (mounted.current) setError("Não foi possível salvar na conta. O vídeo continua disponível para download; você pode tentar salvar novamente."); }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  }
  async function openSaved(item: SavedVideo, saveToDevice = false) {
    const client = getSupabase(); if (!client || !user || libraryBusy) return;
    setLibraryBusy(item.name); setLibraryError("");
    try {
      const path = ownedProductVideoPath(user.id, item.name);
      if (saveToDevice) {
        const { data, error } = await client.storage.from(PRODUCT_VIDEO_BUCKET).download(path);
        if (error || !data) throw error; if (mounted.current) download(data, item.name);
      } else {
        const { data, error } = await client.storage.from(PRODUCT_VIDEO_BUCKET).createSignedUrl(path, 300);
        if (error || !data) throw error; if (mounted.current) setOpenedVideo({ name: item.name, url: data.signedUrl });
      }
    } catch { if (mounted.current) setLibraryError("Não foi possível abrir este arquivo. Atualize a biblioteca e tente novamente."); }
    finally { if (mounted.current) setLibraryBusy(""); }
  }
  const blocked = busy || saving || importing || galleryBusy;
  async function copyFlowPrompt() {
    if (!manualPrompt.applied) return;
    try {
      await navigator.clipboard.writeText(manualPrompt.applied);
      setNotice("Prompt copiado. Cole no Google Flow para gerar seu vídeo.");
      setError("");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie o texto do prompt acima.");
    }
  }
  return <div className="space-y-5">
    {!embedded && <div className="rounded-xl border border-primary/20 bg-primary-soft p-4 text-sm">
      <p className="font-semibold text-primary">Seu produto em destaque, sem personagem</p>
      <p className="mt-1 text-muted">Monte um vídeo com fotos de diferentes ângulos ou clipes reais do produto sendo usado. Escolha as transições, confira a prévia e exporte.</p>
    </div>}
    {!embedded && <>
      <label className="block text-sm">Descrição e características confirmadas (opcional)<textarea value={briefDetails} onChange={e => setBriefDetails(e.target.value)} maxLength={5000} rows={3} className={field} /></label>
      <ManualChatGPTPrompt draft={manualPrompt} brief={{ name: options.title || initialProduct?.title, description: briefDetails, store: initialProduct?.platform, videoType: "Montagem de fotos/clipes ou vídeo externo no Flow", duration: `${Math.max(1,items.length) * options.secondsPerScene} segundos (${options.secondsPerScene} por cena)`, format: options.format, character: "Sem personagem na montagem local", presentationStyle: options.transition }} />
      {manualPrompt.applied && <section className="space-y-3 rounded-xl border border-primary p-4"><h3 className="font-semibold">Prompt em uso para criação externa</h3><textarea aria-label="Prompt em uso no Flow" readOnly value={manualPrompt.applied} rows={6} className={field} /><button type="button" onClick={() => void copyFlowPrompt()} className={button}><Copy className="h-4 w-4" />Copiar prompt para o Flow</button><p className="text-sm text-muted">Copie o prompt, abra o Google Flow na seção Gerar vídeo abaixo e cole-o lá. Depois, baixe o vídeo no Flow e volte ao Meu Vendedor para adicioná-lo como clipe. A montagem local não interpreta instruções de texto.</p></section>}
    </>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <div className="min-w-0 space-y-5">
        <Card titulo="1. Fotos e clipes do produto">
          <fieldset disabled={blocked} className="min-w-0 space-y-4 disabled:opacity-60">
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={selectFiles} className="sr-only" aria-label="Adicionar fotos ou clipes" />
            <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm hover:border-primary">
              <ImagePlus className="h-7 w-7 text-primary" /><span className="font-medium">Adicionar fotos ou clipes</span><span className="text-xs text-muted">Até 8 cenas · foto até 10 MB · clipe até 50 MB</span>
            </button>
            {user && products.length > 0 && <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">Ou escolha do seu catálogo<select value={productId} disabled={Boolean(initialProduct)} onChange={e => setProductId(e.target.value)} className={field}><option value="">Selecione um produto</option>{products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
              <button type="button" disabled={!productId || importing} onClick={() => void importProduct()} className={button}>{importing ? "Importando…" : "Usar foto principal"}</button>
            </div>}
            {items.length > 0 && <ol className="space-y-2">{items.map((item, index) => <li key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-2">
              <span className="w-5 shrink-0 text-center text-xs text-muted">{index + 1}</span>
              {/* Files are local object URLs; next/image does not process them. */}
              {item.kind === "image" ? <LocalImage url={item.url} index={index} /> : <Film className="h-14 w-14 shrink-0 rounded-lg bg-background p-4 text-primary" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm">{item.file.name}</p><p className="text-xs text-muted">{item.kind === "image" ? "Foto" : `Clipe · primeiros ${options.secondsPerScene} s`}</p></div>
              <div className="flex shrink-0 gap-1"><button type="button" aria-label={`Subir cena ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Descer cena ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label={`Remover cena ${index + 1}`} onClick={() => remove(item.id)} className="rounded-lg p-2 text-muted"><Trash2 className="h-4 w-4" /></button></div>
            </li>)}</ol>}
            <p className="text-xs text-muted">Para mostrar outros lados, adicione fotos reais desses ângulos. Para mostrar mãos usando o produto, envie um clipe já gravado. Fotos recebem movimento de aproximação; novos ângulos e mãos não são inventados.</p>
          </fieldset>
          <div className="mt-4"><ProductPhotoPicker userId={user?.id} productId={productId} productUrl={initialProduct?.productUrl} existingFiles={items.map(item => item.file)} available={MAX_PRODUCT_SCENES - items.length}
            disabled={busy || saving || importing} onBusyChange={setGalleryBusy} onAdd={(files, title) => { const added = addFiles(files); if (added && title) setOptions(old => ({ ...old, title: old.title || title })); return added; }} /></div>
        </Card>
        <Card titulo="2. Aparência do vídeo">
          <fieldset disabled={blocked} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">Formato<select className={field} value={options.format} onChange={e => setOptions(old => ({ ...old, format: e.target.value as ProductVideoOptions["format"] }))}><option value="9:16">Vertical · 9:16</option><option value="1:1">Quadrado · 1:1</option><option value="16:9">Horizontal · 16:9</option></select></label>
              <label className="text-sm">Tempo por cena<select className={field} value={options.secondsPerScene} onChange={e => setOptions(old => ({ ...old, secondsPerScene: Number(e.target.value) }))}>{[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} segundos</option>)}</select></label>
              <label className="text-sm">Transição<select className={field} value={options.transition} onChange={e => setOptions(old => ({ ...old, transition: e.target.value as ProductVideoOptions["transition"] }))}><option value="fade">Suave</option><option value="slide">Deslizar</option><option value="cut">Corte direto</option></select></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.zoom} onChange={e => setOptions(old => ({ ...old, zoom: e.target.checked }))} />Aproximação suave nas fotos</label>
            <label className="block text-sm">Nome ou título (opcional)<input className={field} maxLength={80} value={options.title} onChange={e => setOptions(old => ({ ...old, title: e.target.value }))} placeholder="Ex.: Garrafa térmica 500 ml" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Preço ou destaque (opcional)<input className={field} maxLength={40} value={options.price} onChange={e => setOptions(old => ({ ...old, price: e.target.value }))} placeholder="Ex.: R$ 49,90" /></label><label className="text-sm">Chamada final (opcional)<input className={field} maxLength={60} value={options.callToAction} onChange={e => setOptions(old => ({ ...old, callToAction: e.target.value }))} /></label></div>
          </fieldset>
        </Card>
        <div className="space-y-3" aria-busy={busy}>
          <button type="button" disabled={blocked || !ready || !supported || !items.length} onClick={() => void generate()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}{busy ? `Exportando · ${progress}%` : "Gerar vídeo do produto"}</button>
          {!embedded && <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Ou criar com Google Flow (externo)</p>
            <p className="mt-1 text-xs text-muted">Use seu prompt no Google Flow, em outra aba. A geração e os créditos são gerenciados pelo próprio Google, não pelo Meu Vendedor.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {manualPrompt.applied && <button type="button" onClick={() => void copyFlowPrompt()} className={button}><Copy className="h-4 w-4" />Copiar prompt</button>}
              <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" className={button}><ExternalLink className="h-4 w-4" />Abrir Google Flow</a>
            </div>
            <p className="mt-2 text-xs text-muted">Depois de baixar o vídeo no Flow, volte aqui e use “Adicionar fotos ou clipes” para incluir o arquivo. Não é necessário conectar o Flow à sua conta do Meu Vendedor.</p>
          </div>}
          {busy && <><progress aria-label="Progresso da exportação" value={progress} max={100} className="w-full" /><button type="button" onClick={() => abort.current?.abort()} className={button}>Cancelar exportação</button></>}
          <p className="text-xs text-muted">{items.length * options.secondsPerScene} segundos · {embedded ? "narração na próxima etapa" : "sem áudio"} · {supported?.startsWith("video/mp4") ? "MP4" : "MP4 ou WebM conforme o navegador"}. A exportação leva aproximadamente a duração do vídeo. Mantenha esta aba aberta. Sem consumo de créditos de IA.</p>
          {supported === "" && <p role="alert" className="text-sm text-muted">Seu navegador não suporta exportação. Tente uma versão atual do Chrome, Edge ou Safari.</p>}
          {error && <p role="alert" className="rounded-xl border border-border p-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        </div>
      </div>
      <div className="min-w-0 space-y-5 xl:sticky xl:top-5">
        <Card titulo="Prévia">
          {items.length ? <><canvas ref={canvas} aria-label="Prévia do vídeo de produto" className="mx-auto max-h-[420px] w-full rounded-xl bg-background object-contain" style={{ aspectRatio: options.format.replace(":", "/") }} /><button type="button" disabled={!ready || blocked} onClick={() => void preview()} className={`${button} mt-3 w-full`}>{playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Parar prévia" : "Reproduzir prévia"}</button></> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl bg-background p-6 text-center text-sm text-muted"><Film className="h-10 w-10" />Adicione a primeira foto para montar seu vídeo.</div>}
        </Card>
        {result && !embedded && <Card titulo="Vídeo pronto">
          <video key={result.url} src={result.url} controls playsInline preload="metadata" className="mx-auto max-h-[420px] w-full rounded-xl bg-background" />
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => download(result.blob, result.filename)} className={button}><Download className="h-4 w-4" />Baixar {result.filename.endsWith(".mp4") ? "MP4" : "WebM"}</button>{user && <button type="button" disabled={saving || result.saved || busy} onClick={() => void saveResult()} className={button}><Save className="h-4 w-4" />{result.saved ? "Salvo na conta" : saving ? "Salvando…" : "Salvar na conta"}</button>}</div>
          {!authLoading && !user && <p className="mt-3 text-xs text-muted">Você pode baixar agora. <Link href="/entrar" className="text-primary underline">Entre na conta</Link> antes de montar o vídeo para também salvá-lo na biblioteca.</p>}
          <p className="mt-2 text-xs text-muted">Este resultado corresponde às cenas e aos textos usados na última exportação.</p>
        </Card>}
      </div>
    </div>
    {!embedded && <PublicationCenter generated={result ? { blob: result.blob, filename: result.filename } : null} defaultTitle={options.title || initialProduct?.title || ""} />}
    {user && !embedded && <Card titulo="Meus vídeos de produto" acao={<button type="button" disabled={libraryLoading} onClick={() => void refreshLibrary()} className="text-xs text-primary underline">{libraryLoading ? "Carregando…" : "Atualizar"}</button>}>
      <p className="mb-3 text-xs text-muted">Seus 20 vídeos mais recentes, salvos de forma privada na conta.</p>
      {!library.length && !libraryLoading && !libraryError && <p className="text-sm text-muted">Depois de gerar, use “Salvar na conta” para guardar seu primeiro vídeo.</p>}
      <ul className="grid gap-3 md:grid-cols-2">{library.map(item => <li key={item.name} className="min-w-0 rounded-xl border border-border p-3"><p className="truncate text-sm font-medium">{item.name.split("--")[0].replace(/-/g, " ")}</p><p className="mt-1 text-xs text-muted">{item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "Vídeo salvo"} · {item.name.endsWith("mp4") ? "MP4" : "WebM"}</p><div className="mt-2 flex gap-3"><button type="button" disabled={Boolean(libraryBusy)} onClick={() => void openSaved(item)} className="text-sm text-primary underline disabled:opacity-50">Abrir vídeo</button><button type="button" disabled={Boolean(libraryBusy)} onClick={() => void openSaved(item, true)} className="text-sm text-primary underline disabled:opacity-50">Baixar</button></div></li>)}</ul>
      {openedVideo && <video key={openedVideo.url} src={openedVideo.url} controls playsInline preload="metadata" onError={() => setLibraryError("O acesso ao vídeo pode ter expirado. Clique em Abrir vídeo novamente.")} className="mx-auto mt-4 max-h-[480px] w-full rounded-xl bg-background" />}
      {libraryError && <p role="alert" className="mt-3 text-sm text-muted">{libraryError}</p>}
    </Card>}
  </div>;
}

function LocalImage({ url, index }: { url: string; index: number }) {
  // next/image cannot optimize object URLs selected from the user's device.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Cena ${index + 1}`} className="h-14 w-14 shrink-0 rounded-lg bg-background object-contain" />;
}

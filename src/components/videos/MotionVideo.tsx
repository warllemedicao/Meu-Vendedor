"use client";
import Image from "next/image";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { motionActive, motionMessages, motionPhases, motionStates, validateMotionFile, type MotionJob } from "@/lib/motion-video";
type Engine = { id: string; label: string; available: boolean; reason: string };
type Asset = { id: string; presenter_id: string; name: string };
export type MotionVideoHandle = { generate: () => Promise<void> };
async function invoke(body: Record<string, unknown>) {
 const client = getSupabase(); if (!client) throw new Error("Entre na sua conta.");
 const { data, error } = await client.functions.invoke("motion-generation", { body });
 let payload = data;
 if (error?.context instanceof Response) { try { payload = await error.context.json(); } catch { /* Transport error. */ } }
 if (payload?.id && ["failed", "uncertain"].includes(payload.status)) return payload;
 if (error || payload?.error) throw new Error(motionMessages[payload?.error] ?? "Não foi possível concluir esta etapa. Atualize o histórico antes de reenviar.");
 return payload;
}
async function upload(file: File, kind: "image" | "video") {
 const extension = await validateMotionFile(file, kind);
 const client = getSupabase(); if (!client) throw new Error("Entre na sua conta.");
 const { data, error: authError } = await client.auth.getUser(); if (authError || !data.user) throw new Error("Entre novamente na sua conta.");
 const bytes = await file.arrayBuffer();
 const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), v => v.toString(16).padStart(2, "0")).join("");
 const path = `${data.user.id}/inputs/motion-${hash}.${extension}`;
 const contentType = kind === "video" ? extension === "mp4" ? "video/mp4" : "video/webm" : `image/${extension === "jpg" ? "jpeg" : extension}`;
 const { error } = await client.storage.from("mv-video-assets").upload(path, bytes, { contentType, upsert: false });
 if (error && error.message !== "The resource already exists") throw new Error("Não foi possível enviar o arquivo privado.");
 return path;
}
function Result({ job, refresh, onReference }: { job: MotionJob; refresh: () => void; onReference?: (path: string) => void }) {
 const [error, setError] = useState("");
 async function action(action: string) { try { setError(""); await invoke({ action, id: job.id }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar tarefa."); } }
 return <div className="mt-3 rounded-lg border border-border p-3">
  <p className="text-sm font-medium">{job.engine} · {motionStates[job.status] ?? job.status}</p>
  {job.phase && <p className="mt-1 text-xs text-muted">{motionPhases[job.phase] ?? "Processando"}{job.elapsed ? ` · ${Math.round(job.elapsed)} s` : ""}</p>}
  {job.stepsTotal && <p className="mt-1 text-xs text-muted">Passos do modelo: {job.stepsCompleted ?? 0}/{job.stepsTotal}</p>}
  {job.error && <p role="status" className="mt-2 text-xs text-muted">{motionMessages[job.error] ?? "O executor encontrou uma falha técnica. Consulte esta tarefa antes de repetir."}</p>}
  {job.url && (job.kind === "image" ? <Image unoptimized width={576} height={864} src={job.url} alt="Prévia da roupa aplicada ao personagem, para revisão" className="mt-3 max-h-96 w-full object-contain" /> : <video controls playsInline preload="metadata" src={job.url} className="mt-3 max-h-96 w-full" />)}
  {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Abrir arquivo</a>}
  {job.kind === "image" && job.status === "completed" && job.resultPath && onReference && <button type="button" onClick={() => onReference(job.resultPath!)} className="ml-3 mt-2 text-xs text-primary underline">Usar esta imagem na animação</button>}
  <button type="button" onClick={refresh} className="ml-3 mt-2 text-xs text-primary underline">Atualizar acesso</button>
  {(motionActive(job) || job.status === "expired") && <button type="button" onClick={() => void action("recover")} className="ml-3 mt-2 text-xs text-primary underline">Verificar entrega</button>}
  {motionActive(job) && job.status !== "cancelling" && <button type="button" onClick={() => void action("cancel")} className="ml-3 mt-2 text-xs text-primary underline">Cancelar</button>}
  {job.status === "cancelling" && <p className="mt-2 text-xs text-muted">Interrompe na próxima comunicação do executor; a cota já usada permanece consumida.</p>}
  {error && <p role="alert" className="mt-2 text-xs text-muted">{error}</p>}
 </div>;
}
export function MotionLibrary() {
 const [jobs, setJobs] = useState<MotionJob[]>([]), [error, setError] = useState("");
 const refresh = useCallback(() => { void invoke({ action: "list" }).then(r => { setJobs(r.jobs ?? []); setError(""); }).catch(e => setError(e.message)); }, []);
 useEffect(() => { refresh(); }, [refresh]);
 useEffect(() => { if (!jobs.some(motionActive)) return; const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [jobs, refresh]);
 return <div className="mt-4 text-sm"><p className="font-semibold">Movimento e roupa da sua conta</p><button type="button" onClick={refresh} className="mt-2 text-xs text-primary underline">Atualizar histórico</button>{jobs.map(j => <Result key={j.id} job={j} refresh={refresh} />)}{error && <p role="status" className="mt-2 text-xs text-muted">{error}</p>}</div>;
}
export function MotionVideo({ presenterId, productKey, sourceProductId, prepareProduct, onBusyChange, ref }: { presenterId: string; productKey: string; sourceProductId?: string; prepareProduct: () => Promise<string>; onBusyChange: (busy: boolean) => void; ref?: Ref<MotionVideoHandle> }) {
 const [engines, setEngines] = useState<Engine[]>([]), [assets, setAssets] = useState<Asset[]>([]);
 const [engine, setEngine] = useState("fashn"), [mode, setMode] = useState("animate"), [category, setCategory] = useState("tops");
 const [driver, setDriver] = useState<File | null>(null), [mask, setMask] = useState<File | null>(null), [reference, setReference] = useState<File | null>(null);
 const [preparedJobId, setPreparedJobId] = useState<string | undefined>();
 const [review, setReview] = useState<{ input: Record<string, unknown>; productUrl: string; referenceUrl: string; approvedReferenceUrl: string; selectionKey: string } | null>(null);
 const [reviewed, setReviewed] = useState(false);
 const [referencePath, setReferencePath] = useState(""), [videoUrl, setVideoUrl] = useState("");
 const [prompt, setPrompt] = useState("Preserve the character identity and clothing. Follow the reference performance with natural, small movements and stable hands. Keep the product shape unchanged.");
 const [seconds, setSeconds] = useState(2), [seed, setSeed] = useState(42), [busy, setBusy] = useState(false), [error, setError] = useState("");
 const [jobs, setJobs] = useState<MotionJob[]>([]); const locked = useRef(false);
 const refresh = useCallback(() => { void invoke({ action: "list" }).then(r => setJobs(r.jobs ?? [])).catch(e => setError(e.message)); }, []);
 useEffect(() => { void invoke({ action: "capabilities" }).then(r => { setEngines(r.engines ?? []); setAssets(r.assets ?? []); }).catch(e => setError(e.message)); refresh(); }, [refresh]);
 useEffect(() => { if (!jobs.some(motionActive)) return; const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [jobs, refresh]);
 const selectionKey = JSON.stringify([productKey, presenterId, engine, mode, category, prompt, seconds, seed, reference?.name, reference?.size, reference?.lastModified, referencePath, preparedJobId, driver?.name, driver?.size, driver?.lastModified, mask?.name, mask?.size, mask?.lastModified, videoUrl]);
 const currentSelection = useRef(selectionKey);
 useLayoutEffect(() => { currentSelection.current = selectionKey; }, [selectionKey]);
 const activeReview = review?.selectionKey === selectionKey ? review : null;
 async function inspectInputs() {
  const inspectedSelection = currentSelection.current;
  if (locked.current) return;
  if (jobs.some(motionActive)) { setError("Acompanhe a tarefa em andamento antes de enviar outra."); return; }
  if (engine !== "fashn" && !driver && !videoUrl.trim()) { setError("Envie um vídeo-base ou um link direto de vídeo."); return; }
  if (engine === "vace" && !mask) { setError(motionMessages.mask_required); return; }
  if (engine === "wan-animate" && mode === "replace") { setError("Escolha SCAIL-2 ou VACE para substituir o apresentador no vídeo."); return; }
  locked.current = true; setBusy(true); onBusyChange(true); setError("");
  try {
   const capability = await invoke({ action: "capabilities" }); setEngines(capability.engines ?? []); setAssets(capability.assets ?? []);
   const selected = capability.engines?.find((e: Engine) => e.id === engine);
   const asset = capability.assets?.find((a: Asset) => a.presenter_id === presenterId);
   if (!selected?.available || !asset) throw new Error(selected?.reason ?? "Esta base ainda não foi aprovada.");
   const custom = reference ? await upload(reference, "image") : referencePath;
   const productPath = await prepareProduct();
   const driverPath = engine !== "fashn" ? driver ? await upload(driver, "video") : (await invoke({ action: "import-video", url: videoUrl.trim() })).path : undefined;
   const maskPath = engine === "vace" && mask ? await upload(mask, "video") : undefined;
   const input = { engine, assetId: asset.id, referencePath: custom || undefined, productPath, driverPath, maskPath, mode, category, prompt, seconds, seed, sourceProductId, preparedJobId: custom === referencePath ? preparedJobId : undefined };
   const inspection = await invoke({ action: "inspect-inputs", input });
   if (inspectedSelection !== currentSelection.current) throw new Error("As opções mudaram durante a conferência. Confira novamente as imagens.");
   setReview({ selectionKey: inspectedSelection, approvedReferenceUrl: inspection.approvedReferenceUrl, input: { ...input, reviewedProductSha256: inspection.productSha256, reviewedReferenceSha256: inspection.referenceSha256 }, productUrl: inspection.productUrl, referenceUrl: inspection.referenceUrl });
   setReviewed(false);
  } catch (e) { setError(e instanceof Error ? e.message : "Falha ao preparar o teste."); }
  finally { locked.current = false; setBusy(false); onBusyChange(false); }
 }
 async function generate() {
  if (!review || !reviewed || review.selectionKey !== currentSelection.current) { setError("Confira as duas imagens e confirme os detalhes antes de gerar."); return; }
  if (locked.current || jobs.some(motionActive)) return;
  locked.current = true; setBusy(true); onBusyChange(true); setError("");
  try {
   const job = await invoke({ action: "generate", input: review.input });
   setJobs(current => [job, ...current.filter(j => j.id !== job.id)]); refresh();
   setReview(null); setReviewed(false);
  } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar tarefa."); }
  finally { locked.current = false; setBusy(false); onBusyChange(false); }
 }
 useImperativeHandle(ref, () => ({ generate }));
 const inputClass = "mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm";
 return <div id="motion-video-production" className="mt-4 rounded-xl border border-border p-4 text-sm">
  <p className="font-semibold">Movimento e produto · experimental</p>
  <p className="mt-2 text-xs text-muted">Use uma atuação curta para orientar o personagem. Revise rosto, mãos e produto antes de usar o resultado. Animações deste modo saem sem áudio; a fala sincronizada continua disponível no modo de voz fixa.</p>
  <p className="mt-2 text-xs text-muted">Para um objeto como barbeador, use um vídeo-base mostrando o produto real e o modo VACE com máscara para preservá-lo, ou envie uma imagem do personagem já preparado com o objeto. A foto isolada de um objeto não cria automaticamente a interação com a mão.</p>
  <fieldset disabled={busy} className="mt-3 grid gap-3 disabled:opacity-60">
   <label>Ferramenta<select className={inputClass} value={engine} onChange={e => setEngine(e.target.value)}>{engines.length ? engines.map(e => <option key={e.id} value={e.id} disabled={!e.available}>{e.label}{!e.available ? " · indisponível" : ""}</option>) : <option value="wan-animate">Consultando ferramentas…</option>}</select></label>
   <p className="text-xs text-muted">{engines.find(e => e.id === engine)?.reason}</p>
   {engines.some(e => !e.available) && <details className="text-xs text-muted"><summary className="cursor-pointer">Outras ferramentas pesquisadas</summary><ul className="mt-2 space-y-2">{engines.filter(e => !e.available).map(e => <li key={e.id}><strong>{e.label}:</strong> {e.reason}</li>)}</ul></details>}
   {engine === "fashn" ? <><label>Tipo da peça<select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}><option value="tops">Camisa, blusa ou casaco</option><option value="bottoms">Calça, saia ou shorts</option><option value="one-pieces">Vestido ou macacão</option></select></label><p className="text-xs text-muted">Use no produto uma foto da peça isolada em fundo simples. Para calça ou peça inteira, envie abaixo uma imagem do personagem com pernas e corpo visíveis. Este teste cria uma imagem para revisão, sem vestir uma pessoa quadro a quadro.</p></> : <>
    <label>Vídeo-base · MP4 ou WebM até 40 MB<input className={inputClass} type="file" accept="video/mp4,video/webm" onChange={e => setDriver(e.target.files?.[0] ?? null)} /></label>
    <label>Ou link direto do vídeo<input className={inputClass} type="url" placeholder="https://videos.pexels.com/…/video.mp4" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} /></label>
    <p className="text-xs text-muted">O arquivo enviado tem prioridade. Links de páginas YouTube, TikTok e anúncios precisam ser baixados com autorização e enviados como arquivo.</p>
    {engine !== "wan-animate" && <label>Uso do vídeo<select className={inputClass} value={mode} onChange={e => setMode(e.target.value)}><option value="animate">Copiar a atuação</option><option value="replace">Substituir o apresentador</option></select></label>}
    {engine === "vace" && <label>Vídeo de máscara · branco edita, preto preserva<input className={inputClass} type="file" accept="video/mp4,video/webm" onChange={e => setMask(e.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs text-muted">Use a mesma duração e enquadramento do vídeo-base. Mantenha o produto na região preta para preservá-lo.</span></label>}
    <label>Duração do teste<select className={inputClass} value={seconds} onChange={e => setSeconds(Number(e.target.value))}><option value={2}>2 segundos</option><option value={3}>3 segundos</option><option value={4}>4 segundos</option></select></label>
   </>}
   <label>Imagem do personagem preparado · opcional<input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setReference(e.target.files?.[0] ?? null); setReferencePath(""); setPreparedJobId(undefined); }} /><span className="mt-1 block text-xs text-muted">Sem envio, usa a foto aprovada do personagem. Para roupa, você pode usar aqui uma imagem já revisada.</span></label>
   {referencePath && <p className="text-xs text-primary">Imagem vestida selecionada para a próxima animação. <button type="button" className="underline" onClick={() => { setReferencePath(""); setPreparedJobId(undefined); }}>Usar foto original</button></p>}
   {engine !== "fashn" && <label>Direção da atuação<textarea className={inputClass} rows={3} maxLength={1200} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>}
   <label>Variação<input className={inputClass} type="number" min={0} max={2147483647} value={seed} onChange={e => setSeed(Number(e.target.value))} /><span className="mt-1 block text-xs text-muted">O mesmo pedido reutiliza a tarefa. Troque a variação para um novo teste após revisar o resultado.</span></label>
   <button type="button" disabled={!assets.some(a => a.presenter_id === presenterId) || jobs.some(motionActive)} onClick={() => void inspectInputs()} className="rounded-lg border border-border px-3 py-2">Conferir imagens antes de gerar · sem GPU</button>
   {activeReview && <div className="rounded-lg border border-border p-3">
    <p className="font-medium">Confira o produto exato e o personagem que serão enviados</p>
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><div><p>Foto do produto</p><Image unoptimized src={activeReview.productUrl} alt="Imagem exata do produto selecionado para este pedido" width={320} height={400} className="h-56 w-full object-contain" /></div><div><p>Personagem cadastrado</p><Image unoptimized src={activeReview.approvedReferenceUrl} alt="Foto aprovada do personagem selecionado" width={320} height={400} className="h-56 w-full object-contain" /></div><div><p>Referência enviada ao modelo</p><Image unoptimized src={activeReview.referenceUrl} alt="Referência exata do personagem para este pedido" width={320} height={400} className="h-56 w-full object-contain" /></div></div>
    <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Conferi personagem, produto, cores, emblemas e detalhes. Se esta imagem já está vestida, conferi também a fidelidade da roupa antes de animar.</label>
   </div>}
   <button type="button" disabled={!activeReview || !reviewed || jobs.some(motionActive)} onClick={() => void generate()} className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50">{busy ? "Preparando teste…" : "Gerar teste de movimento ou roupa"}</button>
  </fieldset>
  {error && <p role="alert" className="mt-3 text-xs text-muted">{error}</p>}
  {jobs.slice(0, 5).map(j => <Result key={j.id} job={j} refresh={refresh} onReference={path => { setPreparedJobId(j.id); setReferencePath(path); setReference(null); setEngine("scail"); setMode("animate"); setError(""); }} />)}
 </div>;
}

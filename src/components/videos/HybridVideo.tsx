"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { completedNarrationId, hybridActive, hybridMessages, hybridStatus, type HybridJob } from "@/lib/hybrid-video";
type Asset = { id: string; presenter_id: string; name: string; scene: string; kind: string };
type Profile = { id: string; google_voice: string };
async function invoke(name: string, body: Record<string, unknown>) {
  const client = getSupabase();
  if (!client) throw new Error("Entre na sua conta.");
  const { data, error } = await client.functions.invoke(name, { body });
  let payload = data;
  if (error?.context instanceof Response) {
    try { payload = await error.context.json(); } catch { /* Transport failure. */ }
  }
  // Preserve a durable job returned with HTTP 503: submission can be uncertain.
  if (payload?.id && ["failed", "uncertain"].includes(payload.status)) return payload;
  if (error || payload?.error) {
    const code = typeof payload?.error === "string" ? payload.error : payload?.error?.code;
    const message = typeof payload?.error?.message === "string" ? payload.error.message : hybridMessages[code];
    throw new Error(message ?? "Não foi possível concluir esta etapa. Consulte o histórico antes de tentar novamente.");
  }
  return payload;
}
function JobResult({ job, refresh }: { job: HybridJob; refresh: () => void }) {
  return <div className="mt-3 rounded-lg border border-border p-3">
    <p className="text-xs text-muted">{job.presenterId ? `${job.presenterId} · ` : ""}{hybridStatus[job.status] ?? "Consultando"}{job.report?.total_seconds ? ` · ${Math.round(job.report.total_seconds)} s` : ""}</p>
    {job.status === "uncertain" && <p className="mt-2 text-xs text-muted">Aguardando confirmação do serviço. Esta tarefa não será reenviada automaticamente.</p>}
    {job.status === "expired" && <p className="mt-2 text-xs text-muted">O serviço não entregou o resultado no prazo. Solicite a verificação desta tarefa antes de um novo pedido.</p>}
    {job.error && <p className="mt-2 text-xs text-muted">{hybridMessages[job.error] ?? "O processamento não foi concluído."}</p>}
    {job.url && <><video controls playsInline preload="metadata" src={job.url} className="mt-2 max-h-96 w-full" /><a className="mt-2 inline-block text-primary underline" href={job.url} target="_blank" rel="noreferrer">Abrir MP4 final</a></>}
    {(hybridActive(job) || job.status === "expired") && <button type="button" className="ml-3 mt-2 text-xs text-primary underline" onClick={() => { void invoke("hybrid-video", { action: "recover", id: job.id }).then(refresh).catch(refresh); }}>Verificar entrega</button>}
    {hybridActive(job) && job.status !== "cancelling" && <button type="button" className="ml-3 mt-2 text-xs text-primary underline" onClick={() => { void invoke("hybrid-video", { action: "cancel", id: job.id }).then(refresh).catch(refresh); }}>Solicitar cancelamento</button>}
    {job.status === "cancelling" && <p className="mt-2 text-xs text-muted">A tarefa será interrompida na próxima comunicação do executor. A cota já consumida permanece contabilizada.</p>}
    <button type="button" className="ml-3 mt-2 text-xs text-primary underline" onClick={refresh}>Atualizar acesso e estado</button>
  </div>;
}
export function HybridLibrary() {
  const [jobs, setJobs] = useState<HybridJob[]>([]), [error, setError] = useState("");
  const refresh = useCallback(() => {
    void invoke("hybrid-video", { action: "list" }).then(r => { setJobs(r.jobs ?? []); setError(""); }).catch(() => setError("Não foi possível carregar os vídeos sincronizados."));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!jobs.some(hybridActive)) return; const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [jobs, refresh]);
  return <div className="mt-4 text-sm"><p className="font-semibold">Vídeos sincronizados da sua conta</p><button type="button" onClick={refresh} className="mt-2 text-xs text-primary underline">Atualizar histórico</button>{jobs.map(job => <JobResult key={job.id} job={job} refresh={refresh} />)}{error && <p role="status" className="mt-2 text-xs text-muted">{error}</p>}</div>;
}
export type HybridVideoHandle = { generate: () => Promise<void> };
export function HybridVideo({ presenterId, script, prepareProduct, ref, onBusyChange }: { presenterId: string; script: string; prepareProduct: () => Promise<string>; ref?: Ref<HybridVideoHandle>; onBusyChange?: (busy: boolean) => void }) {
  const [available, setAvailable] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]), [profiles, setProfiles] = useState<Profile[]>([]), [asset, setAsset] = useState("");
  const [job, setJob] = useState<HybridJob | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const refresh = useCallback(() => {
    void invoke("hybrid-video", { action: "list" }).then(r => { setJob((r.jobs as HybridJob[]).find(j => hybridActive(j)) ?? (r.jobs as HybridJob[]).find(j => j.presenterId === presenterId) ?? null); setError(""); }).catch(() => setError("Consulta interrompida. Consulte o histórico antes de reenviar."));
  }, [presenterId]);
  useEffect(() => {
    let active = true;
    void invoke("hybrid-video", { action: "capabilities" }).then(r => { if (active) { setAvailable(r.available === true); setAssets(r.assets ?? []); setProfiles(r.profiles ?? []); } }).catch(() => { if (active) setError("Não foi possível consultar as bases aprovadas."); });
    return () => { active = false; };
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!hybridActive(job)) return; const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [job, refresh]);
  const choices = assets.filter(a => a.presenter_id === presenterId);
  const selected = choices.find(a => a.id === asset) ?? choices[0];
  const profile = profiles.find(p => p.id === presenterId);
  async function generate() {
    if (submitting.current) return;
    if (hybridActive(job)) { setError("Há uma tarefa em andamento. Acompanhe o histórico antes de iniciar outra."); return; }
    if (script.trim().length < 2 || script.length > 180) { setError("Use um roteiro de 2 a 180 caracteres, com fala de até 15 segundos."); return; }
    submitting.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      // Revalidate on each main-button click; a page opened before approval must recover.
      const capability = await invoke("hybrid-video", { action: "capabilities" });
      const currentAssets = (capability.assets ?? []) as Asset[];
      const currentProfiles = (capability.profiles ?? []) as Profile[];
      setAssets(currentAssets); setProfiles(currentProfiles); setAvailable(capability.available === true);
      const base = currentAssets.find(a => a.id === asset && a.presenter_id === presenterId) ?? currentAssets.find(a => a.presenter_id === presenterId);
      const voice = currentProfiles.find(p => p.id === presenterId);
      if (!capability.available || !base || !voice) throw new Error("A base deste personagem ainda não foi liberada. Confira o aviso de disponibilidade acima.");
      const productPath = await prepareProduct();
      const audio = await invoke("audio-generation", { action: "generate", text: script, voiceId: voice.google_voice, purpose: "commercial" });
      const audioId = completedNarrationId(audio);
      const next = await invoke("hybrid-video", { action: "generate", assetId: base.id, audioId, productPath });
      setJob(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no processamento."); } finally { submitting.current = false; setBusy(false); onBusyChange?.(false); }
  }
  useImperativeHandle(ref, () => ({ generate }));
  return <div id="hybrid-video-production" className="mt-4 rounded-xl border border-border p-4 text-sm">
    <p className="font-semibold">Vídeo com voz fixa · piloto Kaggle</p>
    <p className="mt-2 text-xs text-muted">Aplica a fala Google a uma base aprovada. Roupa, cenário e gestos são os da base escolhida. A foto enviada do produto aparece em um cartão na parte inferior do vídeo. Voz fixa por personagem. Fala de até 15 segundos; as preferências de troca de cenário, roupa e gestos ficam no briefing.</p>
    {choices.length === 0 ? <p className="mt-2 text-xs text-muted">A referência visual está disponível. A base de vídeo deste personagem ainda aguarda validação de sincronização e qualidade.</p> : <>
      <select aria-label="Base do personagem" className="mt-2 w-full rounded-lg border border-border bg-background p-2" value={selected?.id ?? ""} onChange={e => setAsset(e.target.value)}>{choices.map(a => <option key={a.id} value={a.id}>{a.name} · {a.scene}</option>)}</select>
      <button type="button" disabled={busy || hybridActive(job) || !available || !profile || script.trim().length < 2 || script.length > 180} onClick={() => void generate()} className="mt-2 text-primary underline disabled:opacity-50">{busy ? "Preparando voz e tarefa…" : hybridActive(job) ? "Processando vídeo…" : "Gerar voz e sincronizar personagem"}</button>
      {script.length > 180 && <p className="mt-2 text-xs text-muted">Reduza o roteiro a até 180 caracteres. O áudio final deve ter no máximo 15 segundos.</p>}
    </>}
    {job && <JobResult job={job} refresh={refresh} />}
    {error && <p role="status" className="mt-2 text-xs text-muted">{error}</p>}
  </div>;
}

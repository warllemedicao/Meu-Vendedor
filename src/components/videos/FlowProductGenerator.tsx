"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { uploadVideoResult, createVideoAssetUrl, MAX_VIDEO_RESULT_BYTES } from "@/lib/video-assets";

type BrowserResponse = {
  error?: string; status?: string; viewUrl?: string; generationStarted?: boolean;
  failed?: boolean; reason?: string; ready?: boolean;
  video?: { id?: string }; downloadUrl?: string; bytes?: number;
};
type Props = {
  prompt: string; productImageUrl?: string; photo?: File;
  presenterImageUrl?: string; presenterMode: boolean;
  onVideo: (file: File) => void;
};
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function invoke(action: string, extra: Record<string, unknown> = {}): Promise<BrowserResponse> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Entre no Meu Vendedor para usar o Google Flow.");
  const { data, error } = await supabase.functions.invoke<BrowserResponse>("private-browser", {
    body: { action, ...extra },
  });
  if (error || data?.error || !data) {
    let code = data?.error;
    if (!code && error && "context" in error && error.context instanceof Response) {
      const result = await error.context.clone().json().catch(() => null) as { error?: string } | null;
      code = result?.error;
    }
    const descriptions: Record<string, string> = {
      browser_not_running: "A sessão do Chrome não foi iniciada.",
      browser_unavailable: "O navegador do Flow não respondeu. Confira sua conexão Google em Contas.",
      flow_page_not_active: "O Google Flow não abriu corretamente. Confira a conta em Contas.",
      flow_upload_incomplete: "As imagens não terminaram de carregar. A geração não foi iniciada.",
      flow_reference_selection_unavailable: "O Flow não conseguiu selecionar as imagens de referência.",
      flow_generate_button_unverified: "O botão Gerar não foi confirmado. A geração não foi iniciada.",
      flow_interaction_failed: "O Flow não concluiu a preparação do vídeo.",
    };
    throw new Error(descriptions[code ?? ""] ?? (code ? "Falha do Google Flow: " + code : "Não foi possível acessar o navegador."));
  }
  return data;
}
async function toReference(file: File): Promise<{ mime: string; data: string }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
  if (file.size > 2_500_000) throw new Error("As referências do Flow devem somar até 2,5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { mime: file.type, data: btoa(binary) };
}
async function fromUrl(url: string, filename: string): Promise<File> {
  const u = new URL(url, window.location.origin);
  if (u.protocol !== "https:" && u.origin !== window.location.origin) throw new Error("Endereço da imagem inválido.");
  const response = await fetch(u.toString(), { credentials: "omit", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Imagem não disponível para envio.");
  const blob = await response.blob();
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type) || blob.size > 2_500_000)
    throw new Error("Imagem de referência incompatível ou muito grande.");
  return new File([blob], filename, { type: blob.type });
}
export function FlowProductGenerator({ prompt, productImageUrl, photo, presenterImageUrl, presenterMode, onVideo }: Props) {
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [problem, setProblem] = useState("");
  const [ready, setReady] = useState<File | null>(null);
  const [imageOverride, setImageOverride] = useState<File>();
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [savedPath, setSavedPath] = useState("");
  useEffect(() => { if (prompt) { setReady(null); setSavedPath(""); } }, [prompt]);

  async function generate() {
    if (working || !prompt.trim()) return;
    if (!rightsConfirmed) { setProblem("Confirme que você pode utilizar as imagens de referência."); return; }
    setWorking(true); setReady(null); setProblem(""); setProgress(0); setStage("Preparando referências...");
    let generationStarted = false;
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Entre na sua conta do Meu Vendedor.");
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user?.id) throw new Error("Faça login no Meu Vendedor.");
      const refs: File[] = [];
      if (presenterMode) {
        if (!presenterImageUrl) throw new Error("O personagem selecionado não possui imagem de referência.");
        refs.push(await fromUrl(presenterImageUrl, "personagem.png"));
      }
      if (photo || imageOverride) refs.push(photo ?? imageOverride!);
      else if (productImageUrl) {
        try { refs.push(await fromUrl(productImageUrl, "produto.jpg")); }
        catch { throw new Error("Não consegui transferir a foto do produto. Escolha a foto no campo de referência abaixo e tente novamente."); }
      } else throw new Error("Adicione uma foto do produto para gerar no Flow.");
      if (refs.reduce((sum, file) => sum + file.size, 0) > 2_500_000)
        throw new Error("As imagens somadas ultrapassam 2,5 MB. Reduza o tamanho antes de gerar.");
      const images = await Promise.all(refs.map(toReference));
      setStage("Preparando o navegador oculto do Google Flow...");
      await invoke("start", { purpose: "flow" });
      setStage("Enviando prompt e imagens ao robô treinado...");
      const result = await invoke("stage", {
        prompt, images, imageRightsConfirmed: true, configureAndGenerate: true,
      });
      if (!result.generationStarted) throw new Error("O Flow não confirmou o início da geração.");
      generationStarted = true; setStage("Google Flow gerando seu vídeo...");
      // This percentage is an elapsed-time estimate, NOT Google Flow's real progress.
      for (let elapsed = 0; elapsed < 110; elapsed += 5) {
        const check = await invoke("video_generation_error");
        if (check.failed || check.reason === "flow_try_again")
          throw new Error("O Google Flow exibiu 'Tentar de novo'. Nenhuma repetição automática foi feita. Verifique a conta e clique em Gerar novamente.");
        setProgress(Math.min(72, Math.round(((elapsed + 5) / 180) * 100)));
        await delay(5000);
      }
      let confirmed = false;
      for (let attempt = 0; attempt <= 7; attempt++) {
        if (attempt > 0) await delay(10000);
        const check = await invoke("video_generated_ready");
        if (check.failed || check.reason === "flow_try_again")
          throw new Error("O Google Flow exibiu 'Tentar de novo'. Confirme a conta e pressione Gerar para uma nova tentativa.");
        setProgress(Math.min(92, 74 + attempt * 2));
        if (check.ready) { confirmed = true; break; }
      }
      if (!confirmed) throw new Error("A geração não foi confirmada no prazo de monitoramento. Nenhum vídeo antigo foi baixado.");
      setStage("Baixando o novo MP4 720p...");
      const downloaded = await invoke("video_train");
      if (!downloaded.video?.id) throw new Error("O download 720p não retornou um vídeo confirmado.");
      setProgress(94); setStage("Transferindo e salvando no Meu Vendedor...");
      const view = await invoke("view");
      const viewerUrl = new URL(view.viewUrl ?? "");
      const prepared = await invoke("video_download", { downloadId: downloaded.video.id });
      const transferUrl = new URL(prepared.downloadUrl ?? "");
      if (viewerUrl.protocol !== "https:" || transferUrl.protocol !== "https:" ||
          transferUrl.origin !== viewerUrl.origin || transferUrl.pathname !== "/session/video/file" ||
          !transferUrl.searchParams.has("ticket") || !prepared.bytes || prepared.bytes > MAX_VIDEO_RESULT_BYTES)
        throw new Error("O endereço de transferência do MP4 não foi validado.");
      const response = await fetch(transferUrl.toString(), {
        mode: "cors", credentials: "omit", cache: "no-store",
      });
      if (!response.ok) throw new Error("Falha ao baixar o MP4 do navegador.");
      const blob = await response.blob();
      const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
      if (blob.size !== prepared.bytes || blob.size > MAX_VIDEO_RESULT_BYTES ||
          signature.length !== 12 || String.fromCharCode(...signature.slice(4, 8)) !== "ftyp")
        throw new Error("O MP4 recebido está incompleto ou não é válido.");
      const file = new File([blob], "google-flow-produto.mp4", { type: "video/mp4" });
      const path = await uploadVideoResult(supabase, auth.user.id, file);
      await createVideoAssetUrl(supabase, auth.user.id, path);
      setSavedPath(path); setReady(file); setProgress(100); onVideo(file);
      setStage("MP4 salvo no Meu Vendedor. O vídeo está pronto para compartilhar.");
      try { await invoke("stop"); }
      catch { setProblem("Vídeo salvo, mas não foi possível encerrar o Chrome. Feche-o na área Contas."); }
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : "A geração falhou. Tente novamente.");
      if (generationStarted) setStage("Execução interrompida; sem nova tentativa automática.");
      setProgress(0);
    } finally { setWorking(false); }
  }
  return <section aria-label="Geração do produto no Google Flow" className="space-y-4 rounded-xl border border-border p-4">
    <h4 className="font-semibold">Google Flow · robô integrado</h4>
    <p className="text-sm text-muted">O Chrome remoto utiliza a conta selecionada e funciona sem abrir uma janela na tela. Para trocar de conta ou aceitar termos, use a área Contas.</p>
    <label className="block text-sm">Foto de referência do produto (opcional se a imagem do produto carregar)
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        setImageOverride(e.target.files?.[0]); setReady(null);
      }} className="mt-2 block w-full text-sm" disabled={working}/>
    </label>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} disabled={working}/>
      Confirmo que tenho autorização para utilizar as imagens e referências na geração.
    </label>
    <button type="button" disabled={working || !prompt.trim()} onClick={() => void generate()}
      className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">
      {working ? "Gerando no Google Flow..." : "Gerar vídeo no Google Flow"}
    </button>
    {(working || progress > 0) && <div className="mx-auto flex aspect-[9/16] w-full max-w-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-background p-4 text-center">
      <div className="text-3xl font-semibold tabular-nums">{progress}%</div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
        aria-label="Progresso estimado da geração" className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-muted">{working ? "Estimativa de etapas, não percentual real do Google." : "Processo concluído"}</p>
    </div>}
    {stage && <p role="status" className="text-sm text-muted">{stage}</p>}
    {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    {ready && <p className="text-xs text-muted">Vídeo salvo em armazenamento privado: {savedPath}. A prévia e o compartilhamento estão disponíveis abaixo.</p>}
  </section>;
}

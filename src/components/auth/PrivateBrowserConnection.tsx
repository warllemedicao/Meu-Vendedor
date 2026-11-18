"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { createVideoAssetUrl, uploadVideoResult, MAX_VIDEO_RESULT_BYTES } from "@/lib/video-assets";

type DownloadedVideo = { id: string; name: string; bytes: number; modifiedAt: number };

type DownloadDiagnostic = { stage?: string; reason?: string; flowProjectTabs?: number | null; videoCandidates?: number | null; toolbarCandidates?: number | null; resolutionCandidates?: number | null; previewClicked?: boolean; editorOpen?: boolean; downloadMenuClicked?: boolean; resolutionClicked?: boolean; frames?: { frame?: number | null; eligible?: number | null; raw?: number | null; visible?: number | null; rejectedSize?: number | null; rejectedPosition?: number | null }[] };
type BrowserResponse = { diagnostic?: DownloadDiagnostic; video?: DownloadedVideo; videos?: DownloadedVideo[]; downloadUrl?: string; bytes?: number; status?: string; viewUrl?: string; error?: string; promptStaged?: boolean; imagesSubmitted?: number; active?: boolean; recorded?: number; imageDirectory?: string; imagesAvailable?: number; events?: { kind?: string; role?: string; state?: Record<string,string>; attribute?: string; holdMs?: number | null }[]; projectOpen?: boolean; promptCandidates?: number; fileInputs?: number; uploadControls?: number; generationStarted?: boolean; ready?: boolean; failed?: boolean; reason?: string; settingsApplied?: boolean };

export function PrivateBrowserConnection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [savedVideoPath, setSavedVideoPath] = useState("");
  const [savedVideoUrl, setSavedVideoUrl] = useState("");
  const [downloadedVideos, setDownloadedVideos] = useState<DownloadedVideo[]>([]);
  const [selectedDownloadId, setSelectedDownloadId] = useState("");

  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generateAuthorized, setGenerateAuthorized] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function explainVideoDiagnostic(d: DownloadDiagnostic | undefined) {
    if (!d) return "O serviço não retornou os detalhes da falha. Verifique a versão do Modal e do Supabase.";
    const stages: Record<string, string> = {
      initializing: "Início", browser_check: "Verificar Chrome", project_check: "Encontrar projeto Flow",
      start: "Iniciar robô", find_video_preview: "Encontrar primeiro vídeo",
      click_video_preview: "Clicar na miniatura", wait_for_editor: "Aguardar editor",
      editor_check: "Confirmar editor", editor_open: "Editor aberto",
      find_download_button: "Identificar botão de download", find_720p: "Identificar 720p",
      wait_for_mp4: "Aguardar arquivo MP4", completed: "Concluído",
    };
    const reasons: Record<string, string> = {
      not_started: "O processo não iniciou.", chrome_not_running: "O Chrome está fechado.",
      project_tab_count_not_one: "Nenhuma aba do projeto Flow, ou mais de uma, foi identificada.",
      no_eligible_video: "Não encontrei miniatura de vídeo que passe nos filtros de visibilidade e tamanho.",
      no_video_dom_elements: "O Flow não apresentou nenhum elemento de vídeo no DOM analisado; a biblioteca pode usar imagens de capa.",
      video_filtered_out: "Foram encontrados elementos de vídeo, mas todos foram descartados pelos filtros; consulte as contagens abaixo.",
      verified: "Controles identificados; falha posterior.",
      click_not_dispatched: "A miniatura foi escolhida, mas o clique ainda não foi confirmado.",
      editor_navigation_pending: "O clique foi enviado, mas a navegação ao editor não terminou.",
      editor_url_not_confirmed: "O endereço do editor não foi confirmado.",
      already_in_editor: "O editor já estava aberto.", toolbar_button_count_not_one: "O botão de download não foi encontrado de forma única.",
      resolution_not_verified: "A opção 720p não foi encontrada ou não estava habilitada.",
      mp4_not_confirmed: "O arquivo MP4 ainda não foi confirmado.",
      download_timeout: "Nenhum MP4 novo ficou pronto dentro do prazo.",
      mp4_confirmed: "MP4 confirmado.",
    };
    const counts = [
      d.flowProjectTabs == null ? "" : `Abas do Flow: ${d.flowProjectTabs}`,
      d.videoCandidates == null ? "" : `Vídeos candidatos: ${d.videoCandidates}`,
      d.toolbarCandidates == null ? "" : `Botões de download candidatos: ${d.toolbarCandidates}`,
      d.resolutionCandidates == null ? "" : `Opções 720p: ${d.resolutionCandidates}`,
    ].filter(Boolean).join(" | ");
    const frames = d.frames?.length ? ` | Quadros analisados: ${d.frames.map(f => `${f.frame ?? "?"}: encontrados=${f.raw ?? "?"}, visíveis=${f.visible ?? "?"}, aptos=${f.eligible ?? "erro"}, pequenos=${f.rejectedSize ?? "?"}, posição=${f.rejectedPosition ?? "?"}`).join(" | ")}` : "";
    return `Etapa: ${stages[d.stage ?? ""] ?? "Não identificada"}. Motivo: ${reasons[d.reason ?? ""] ?? "Falha não classificada"}. ${counts}${frames}`;
  }

  async function invoke(action: string, extra: Record<string, unknown> = {}) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Autenticação indisponível.");
    const { data, error } = await supabase.functions.invoke<BrowserResponse>("private-browser", {
      body: { action, ...extra },
    });
    if (error || !data || data.error) {
      const code = data?.error ?? (error && "context" in error && typeof error.context === "object" && error.context !== null
        ? (await (error.context as Response).clone().json().catch(() => null))?.error : null);
      const labels: Record<string, string> = {
        browser_not_running: "O Chrome não está iniciado. Clique em Chrome para abrir novamente.",
        flow_page_not_active: "Abra o Google Flow no Chrome antes de enviar.",
        flow_project_not_active: "O projeto do Google Flow não abriu. Confira a tela.",
        new_project_button_not_found: "O robô não encontrou o botão de novo projeto.",
        prompt_field_not_unique: "O robô não identificou com segurança o campo do prompt.",
        flow_upload_action_not_found: "O prompt foi preenchido, mas o robô não encontrou o envio de imagens. Confira a tela do Flow.",
        flow_interaction_failed: "O Flow não concluiu a preparação. O Chrome permanece aberto; confira o prompt e as imagens.",
        browser_unavailable: "O serviço do Chrome não respondeu ou retornou uma falha não identificada. Consulte o status.",
        flow_upload_incomplete: "As imagens ainda não terminaram de carregar no Flow. O robô parou sem gerar com referências incompletas.",
        flow_add_elements_not_found: "O robô não encontrou Adicionar elementos junto ao prompt.",
        flow_add_elements_ambiguous: "O robô encontrou mais de um botão Adicionar elementos e interrompeu para evitar um clique incorreto.",
        flow_reference_selection_unavailable: "As imagens foram enviadas, mas a biblioteca não permitiu identificar todas para seleção.",
        flow_reference_include_unavailable: "O robô não encontrou Incluir no comando para as imagens selecionadas.",
        flow_image_rights_unresolved: "O Flow solicitou confirmação de direitos e o robô não conseguiu concluir essa etapa.",
        flow_settings_button_not_found: "As referências foram preparadas, mas o robô não encontrou o botão Configurações.",
        flow_settings_panel_not_found: "O botão Configurações foi clicado, mas o painel não abriu corretamente.",
        flow_settings_option_not_found: "O painel abriu, mas uma opção de configuração não foi identificada.",
        flow_generate_button_unverified: "As configurações foram concluídas, mas o botão Gerar não foi identificado com segurança.",
      };
      const baseMessage = typeof code === "string" ? (labels[code] ?? code) : "Não foi possível acessar o Chrome.";
      const diagnostic = data?.diagnostic ?? (error && "context" in error && error.context instanceof Response
        ? (await error.context.clone().json().catch(() => null))?.diagnostic : undefined);
      throw new Error(action === "video_train"
        ? `${baseMessage}\n${explainVideoDiagnostic(diagnostic)}`
        : baseMessage);
    }
    return data;
  }

  async function refreshChromeDownloads() {
    if (busy || videoBusy) return;
    setVideoBusy(true);
    setMessage("Consultando MP4s concluídos no Chromium...");
    try {
      const data = await invoke("video_list");
      const videos = Array.isArray(data.videos) ? data.videos : [];
      setDownloadedVideos(videos);
      setSelectedDownloadId((selected) => videos.some((item) => item.id === selected)
        ? selected : videos[0]?.id ?? "");
      setMessage(videos.length
        ? `Encontrados ${videos.length} MP4(s). Escolha o vídeo para importar.`
        : "Nenhum MP4 concluído encontrado. Baixe 720p no Chromium e atualize a lista.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar os downloads.");
    } finally {
      setVideoBusy(false);
    }
  }

  async function downloadReadyFlowVideo(downloadIdOverride?: string, automatic = false): Promise<boolean> {
    const downloadId = downloadIdOverride || selectedDownloadId;
    if ((busy && !automatic) || videoBusy || !downloadId) return false;
    setVideoBusy(true);
    setMessage("Preparando o MP4 escolhido na pasta de downloads...");
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Entre na sua conta do Meu Vendedor.");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) throw new Error("Sua sessão expirou. Entre novamente.");
      const data = await invoke("video_download", { downloadId });
      const downloadUrl = new URL(data.downloadUrl ?? "");
      const viewerOrigin = new URL(viewUrl).origin;
      if (downloadUrl.protocol !== "https:" || downloadUrl.origin !== viewerOrigin
          || downloadUrl.pathname !== "/session/video/file"
          || !downloadUrl.searchParams.has("ticket")) {
        throw new Error("O endereço de transferência não foi validado.");
      }
      if (!data.bytes || data.bytes > MAX_VIDEO_RESULT_BYTES) {
        throw new Error("O vídeo ultrapassa o limite de 100 MB.");
      }
      setMessage("Vídeo encontrado. Transferindo para o armazenamento privado...");
      const response = await fetch(downloadUrl.toString(), {
        method: "GET", mode: "cors", cache: "no-store", credentials: "omit",
      });
      if (!response.ok) throw new Error("Falha ao receber o MP4 do Chromium.");
      const blob = await response.blob();
      if (blob.size !== data.bytes || blob.size > MAX_VIDEO_RESULT_BYTES) {
        throw new Error("A transferência do vídeo ficou incompleta.");
      }
      const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
      if (signature.length !== 12 ||
          String.fromCharCode(...signature.slice(4, 8)) !== "ftyp") {
        throw new Error("O arquivo recebido não é um MP4 válido.");
      }
      const file = new File([blob], "google-flow-video.mp4", { type: "video/mp4" });
      const savedPath = await uploadVideoResult(supabase, userId, file);
      const videoUrl = await createVideoAssetUrl(supabase, userId, savedPath);
      setSavedVideoPath(savedPath);
      setSavedVideoUrl(videoUrl);
      setMessage("MP4 salvo no armazenamento privado do Meu Vendedor. Confira a prévia abaixo.");
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const labels: Record<string, string> = {
        flow_download_file_not_found: "O arquivo não está mais disponível ou ainda está sendo gravado. Atualize a lista.",
        invalid_download_selection: "Seleção inválida. Atualize a lista de downloads.",
        flow_video_invalid_mp4: "O Flow não entregou um arquivo MP4 válido.",
        flow_video_download_failed: "O download do Flow falhou; confira o vídeo na tela.",
      };
      setMessage(labels[code] ?? (code || "Não foi possível salvar o vídeo."));
      return false;
    } finally {
      setVideoBusy(false);
    }
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

  async function closeChrome() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await invoke("stop");
      setViewUrl("");
      setDownloadedVideos([]);
      setSelectedDownloadId("");
      setGenerateAuthorized(false);
      setMessage("Sessão encerrada: Chrome remoto fechado e automação interrompida. O login salvo no perfil foi preservado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível encerrar o Chrome.");
    } finally {
      setBusy(false);
    }
  }

  async function diagnose() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await invoke("diagnose");
      setMessage(result.status === "flow_not_open"
        ? "Diagnóstico: abra o Google Flow no Chrome para verificar os controles."
        : `Diagnóstico sem gerar vídeo: projeto ${result.projectOpen ? "aberto" : "não aberto"}; campos candidatos a prompt: ${result.promptCandidates ?? 0}; entradas de arquivo: ${result.fileInputs ?? 0}; controles de upload: ${result.uploadControls ?? 0}. Nenhum vídeo foi gerado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no diagnóstico.");
    } finally {
      setBusy(false);
    }
  }

  async function stageDraft() {
    if (busy || !prompt.trim()) return;
    if (images.length && !rightsConfirmed) {
      setMessage("Confirme os direitos de uso das imagens.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const encoded = await Promise.all(images.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 8192) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
        }
        return { mime: file.type, data: btoa(binary) };
      }));
      const result = await invoke("stage", { prompt: prompt.trim(), images: encoded, imageRightsConfirmed: rightsConfirmed, configureAndGenerate: generateAuthorized });
      setGenerateAuthorized(false);
      if (result.generationStarted) {
        // No new Generate clicks here. Poll the exact project created by the
        // successful stage, and never download an old existing thumbnail.
        setMessage("Geração acionada. Monitorando o Flow durante os 110 segundos...");
        // The old single 110s sleep hid a visible "Tentar de novo" failure.
        // Poll for failure only; do not download before the 110s checkpoint.
        for (let elapsed = 0; elapsed < 110; elapsed += 5) {
          const check = await invoke("video_generated_ready");
          if (check.failed || check.reason === "flow_try_again") {
            setMessage("O Google Flow exibiu 'Tentar de novo'. A geração foi interrompida e o robô não aguardará nem fará download. Verifique sua conexão e o estado do Flow; depois clique novamente em Enviar prompt e imagens ao Flow para iniciar uma nova tentativa.");
            return;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
        }
        let ready = false;
        for (let attempt = 0; attempt <= 7; attempt += 1) {
          if (attempt > 0) {
            setMessage(`Vídeo ainda não confirmado. Nova verificação ${attempt}/7 em 10 segundos...`);
            await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
          }
          const check = await invoke("video_generated_ready");
          if (check.failed || check.reason === "flow_try_again") {
            setMessage("O Flow exibiu 'Tentar de novo'. Processo interrompido sem download. Confira sua conexão e tente gerar novamente pelo botão do Meu Vendedor.");
            return;
          }
          if (check.ready === true) {
            ready = true;
            break;
          }
        }
        if (!ready) {
          setMessage("O vídeo ainda não foi identificado após 110 segundos e 7 verificações adicionais. Nenhum vídeo antigo foi baixado.");
          return;
        }
        setMessage("Novo vídeo identificado. Baixando MP4 720p do Google Flow...");
        const downloaded = await invoke("video_train");
        if (!downloaded.video?.id) throw new Error("O download não retornou um MP4 validado.");
        setDownloadedVideos((current) => [downloaded.video!, ...current.filter((item) => item.id !== downloaded.video!.id)]);
        setSelectedDownloadId(downloaded.video.id);
        setMessage("MP4 baixado. Enviando automaticamente ao armazenamento privado do Meu Vendedor...");
        const imported = await downloadReadyFlowVideo(downloaded.video.id, true);
        if (!imported) throw new Error("O MP4 foi baixado, mas a importação não foi concluída.");
      } else {
        setMessage(result.promptStaged
          ? `Prompt inserido no Flow; ${result.imagesSubmitted ?? 0} imagem(ns) enviada(s). Nenhuma nova geração foi confirmada.`
          : "O Flow não confirmou a preparação do rascunho.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao preparar o Flow.");
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
    if (selected.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_500_000)) {
      setMessage("Use imagens PNG, JPG ou WebP de até 2,5 MB no total.");
      if (fileInput.current) fileInput.current.value = "";
      setImages([]);
      return;
    }
    if (selected.reduce((total, file) => total + file.size, 0) > 2_500_000) {
      setMessage("As imagens juntas devem ter até 2,5 MB.");
      setImages([]);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setMessage("");
    setRightsConfirmed(false);
    setImages(selected);
  }

  return <article className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:col-span-2">
    <h3 className="font-semibold">Google Flow · Chrome próprio</h3>
    <p className="text-sm text-muted">Abra seu Chrome no Modal usando a sessão persistente do Google Flow.</p>
    <button type="button" disabled={busy} onClick={() => void openChrome()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
      {busy ? "Abrindo..." : "Chrome"}
    </button>
    <button type="button" disabled={busy || !viewUrl} onClick={() => void closeChrome()}
      className="rounded-lg border border-red-600 px-4 py-2 text-sm text-red-600 disabled:opacity-50">
      Encerrar Chrome e robô
    </button>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Importar MP4 baixado no Chromium</p>
      <p className="text-xs text-muted">Esta seção permite recuperar manualmente um MP4 já baixado. Depois de Gerar pelo formulário abaixo, o download e o envio são automáticos.</p>
      <button type="button" disabled={busy || videoBusy}
        onClick={() => void refreshChromeDownloads()}
        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        {videoBusy ? "Consultando..." : "Procurar downloads do Chrome"}
      </button>
      {downloadedVideos.length > 0 && <div className="space-y-2">
        <label htmlFor="chrome-downloaded-video" className="block text-xs font-medium">Escolher MP4 concluído</label>
        <select id="chrome-downloaded-video" value={selectedDownloadId}
          onChange={(event) => setSelectedDownloadId(event.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          {downloadedVideos.map((item) => <option value={item.id} key={item.id}>
            {item.name} ({(item.bytes / 1024 / 1024).toFixed(1)} MB)
          </option>)}
        </select>
        <button type="button" disabled={busy || videoBusy || !selectedDownloadId}
          onClick={() => void downloadReadyFlowVideo()}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
          {videoBusy ? "Importando vídeo..." : "Enviar MP4 escolhido ao Meu Vendedor"}
        </button>
      </div>}
      {savedVideoUrl && <div className="space-y-2">
        <p className="text-xs">MP4 salvo: <code className="break-all">{savedVideoPath}</code></p>
        <video controls playsInline preload="metadata" src={savedVideoUrl}
          className="max-h-[360px] w-full max-w-[250px] rounded-lg" />
        <a href={savedVideoUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm underline">Visualizar ou baixar MP4 salvo</a>
        <p className="text-xs text-muted">O link expira em 5 minutos, mas o MP4 permanece privado no Supabase.</p>
      </div>}
    </div>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label htmlFor="flow-test-prompt" className="block text-sm font-medium">Prompt para gerar vídeo no Flow</label>
      <textarea id="flow-test-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
        maxLength={4000} rows={5} placeholder="Descreva o vídeo que deseja gerar no Flow..."
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm" />
      <label htmlFor="flow-test-images" className="block text-sm font-medium">Imagens de referência (até 3)</label>
      <input ref={fileInput} id="flow-test-images" type="file" multiple accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onFiles(event.target.files)} className="block w-full text-sm" />
      <p className="text-xs text-muted">{images.length} de 3 imagens selecionadas (máximo de 2,5 MB somadas). Após Gerar, o robô verifica o novo vídeo em 110 segundos e depois a cada 10 segundos (até 7 vezes), baixa o MP4 720p e envia ao Meu Vendedor.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> Confirmo que tenho direito de usar as imagens selecionadas.</label>
      <button type="button" disabled={busy || !viewUrl} onClick={() => void diagnose()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        Diagnosticar Flow automaticamente
      </button>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={generateAuthorized} onChange={(event) => setGenerateAuthorized(event.target.checked)} /> Configurar o Flow (Nunca confirmar, imagens 9:16, x1, vídeo 9:16) e clicar em Gerar. Entendo que isso pode consumir créditos automaticamente.</label>
      <button type="button" disabled={busy || !viewUrl || !prompt.trim() || (images.length > 0 && !rightsConfirmed)} onClick={() => void stageDraft()} className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Preparando..." : "Enviar prompt e imagens ao Flow"}</button>
      <button type="button" onClick={() => void navigator.clipboard.writeText(prompt).then(
        () => setMessage("Prompt copiado. Cole no Chrome para testar."),
        () => setMessage("Não foi possível copiar o prompt.")
      )} disabled={!prompt.trim()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        Copiar prompt
      </button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {viewUrl && <div className="space-y-2">
      <iframe title="Tela privada do Chrome" src={viewUrl} referrerPolicy="no-referrer" className="h-[min(80vh,900px)] w-full rounded-lg border border-border" />
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Abrir Chrome em tela cheia</a>
    </div>}
  </article>;
}

"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { createVideoAssetUrl, uploadVideoResult, MAX_VIDEO_RESULT_BYTES } from "@/lib/video-assets";

type BrowserResponse = { downloadUrl?: string; bytes?: number; status?: string; viewUrl?: string; error?: string; promptStaged?: boolean; imagesSubmitted?: number; active?: boolean; recorded?: number; imageDirectory?: string; imagesAvailable?: number; events?: { kind?: string; role?: string; state?: Record<string,string>; attribute?: string; holdMs?: number | null }[]; projectOpen?: boolean; promptCandidates?: number; fileInputs?: number; uploadControls?: number; generationStarted?: boolean; settingsApplied?: boolean };

export function PrivateBrowserConnection() {
  const [busy, setBusy] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learningBusy, setLearningBusy] = useState(false);
  const [learningResult, setLearningResult] = useState("");
  const [message, setMessage] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [savedVideoPath, setSavedVideoPath] = useState("");
  const [savedVideoUrl, setSavedVideoUrl] = useState("");

  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generateAuthorized, setGenerateAuthorized] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
      throw new Error(typeof code === "string" ? (labels[code] ?? code) : "Não foi possível acessar o Chrome.");
    }
    return data;
  }

  async function downloadReadyFlowVideo() {
    if (busy || videoBusy || !viewUrl) return;
    setVideoBusy(true);
    setMessage("Procurando o vídeo concluído no Google Flow...");
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Entre na sua conta do Meu Vendedor.");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) throw new Error("Sua sessão expirou. Entre novamente.");
      const data = await invoke("video_download");
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
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const labels: Record<string, string> = {
        flow_video_project_not_unique: "Deixe aberto somente o projeto do Google Flow com o vídeo pronto.",
        flow_video_not_unique: "Deixe somente um vídeo visível no projeto do Flow antes de baixar.",
        flow_video_download_control_not_unique: "Não foi possível identificar com segurança o botão Baixar do Flow. Abra o menu do vídeo pronto e tente novamente.",
        flow_video_download_not_started: "O Flow não iniciou o download pelo botão identificado. Confira os controles do vídeo na tela.",
        flow_video_invalid_mp4: "O Flow não entregou um arquivo MP4 válido.",
        flow_video_download_failed: "O download do Flow falhou; confira o vídeo na tela.",
      };
      setMessage(labels[code] ?? (code || "Não foi possível salvar o vídeo."));
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
      setLearning(false);
      setLearningResult("");
      setGenerateAuthorized(false);
      setMessage("Sessão encerrada: Chrome remoto fechado e automação interrompida. O login salvo no perfil foi preservado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível encerrar o Chrome.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLearning() {
    if (learningBusy || busy) return;
    setLearningBusy(true);
    setMessage("");
    try {
      // Diagnostics do not need image uploads. Images are submitted by the
      // existing stage action or manually inside the private Chrome.
      const result = await invoke(learning ? "learning_stop" : "learning_start",
        learning ? {} : { images: [], imageRightsConfirmed: false });
      setLearning(result.active === true);
      if (result.active) {
        setLearningResult("");
        setMessage("Diagnóstico ativo. Envie o prompt normalmente ou clique manualmente no Chrome. Finalize a captura depois da operação.");
      } else {
        setLearningResult(`Interações capturadas: ${result.recorded ?? 0}. Eventos estruturais (sem conteúdo de campos):\n${JSON.stringify(result.events ?? [], null, 2)}`);
        setMessage("Captura encerrada. Confira os eventos abaixo.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na captura.");
    } finally {
      setLearningBusy(false);
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
      setMessage(result.promptStaged
        ? `Prompt inserido no Flow; ${result.imagesSubmitted ?? 0} imagem(ns) enviada(s). ${result.generationStarted ? "Geração acionada; confira os créditos e a confirmação no Flow." : "Confira no Chrome antes de gerar."}`
        : "O Flow não confirmou a preparação do rascunho.");
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
      <p className="text-sm font-medium">Download manual do vídeo pronto</p>
      <p className="text-xs text-muted">Deixe aberto no Chromium o projeto do Google Flow com um único vídeo concluído. Este botão não executa o robô nem inicia outra geração. Ele tenta usar o botão oficial Baixar e guarda o MP4 no armazenamento privado do Meu Vendedor.</p>
      <button type="button" disabled={busy || videoBusy || !viewUrl}
        onClick={() => void downloadReadyFlowVideo()}
        className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
        {videoBusy ? "Transferindo vídeo..." : "Baixar vídeo pronto do Chrome"}
      </button>
      {savedVideoUrl && <div className="space-y-2">
        <p className="text-xs">Vídeo salvo no Meu Vendedor: <code className="break-all">{savedVideoPath}</code></p>
        <video controls playsInline preload="metadata" src={savedVideoUrl}
          className="max-h-[360px] w-full max-w-[250px] rounded-lg" />
        <a href={savedVideoUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm underline">Abrir vídeo salvo</a>
        <p className="text-xs text-muted">Link temporário de 5 minutos; o MP4 permanece no armazenamento privado.</p>
      </div>}
    </div>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label htmlFor="flow-test-prompt" className="block text-sm font-medium">Prompt para treinamento do robô</label>
      <textarea id="flow-test-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
        maxLength={4000} rows={5} placeholder="Descreva o vídeo que deseja testar no Flow..."
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm" />
      <label htmlFor="flow-test-images" className="block text-sm font-medium">Imagens de referência (até 3)</label>
      <input ref={fileInput} id="flow-test-images" type="file" multiple accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onFiles(event.target.files)} className="block w-full text-sm" />
      <p className="text-xs text-muted">{images.length} de 3 imagens selecionadas (máximo de 2,5 MB somadas). O envio prepara o rascunho, sem clicar em Gerar.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> Confirmo que tenho direito de usar as imagens selecionadas.</label>
      <button type="button" disabled={busy || !viewUrl} onClick={() => void diagnose()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        Diagnosticar Flow automaticamente
      </button>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={generateAuthorized} onChange={(event) => setGenerateAuthorized(event.target.checked)} /> Configurar o Flow (Nunca confirmar, imagens 9:16, x1, vídeo 9:16) e clicar em Gerar. Entendo que isso pode consumir créditos automaticamente.</label>
      <button type="button" disabled={busy || !prompt.trim() || (images.length > 0 && !rightsConfirmed)} onClick={() => void stageDraft()} className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Preparando..." : "Enviar prompt e imagens ao Flow"}</button>
      <button type="button" onClick={() => void navigator.clipboard.writeText(prompt).then(
        () => setMessage("Prompt copiado. Cole no Chrome para testar."),
        () => setMessage("Não foi possível copiar o prompt.")
      )} disabled={!prompt.trim()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
        Copiar prompt
      </button>
    </div>
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Diagnóstico do navegador — manual ou acompanhando o robô</p>
      <p className="text-xs text-muted">Ative a captura, depois envie o prompt normalmente ou faça os cliques manualmente no Chrome. Ao terminar, finalize para consultar duração dos cliques e alterações estruturais do navegador. Não grava senhas, textos ou imagens.</p>
      <button type="button" disabled={busy || learningBusy || !viewUrl} onClick={() => void toggleLearning()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{learningBusy ? "Aguarde..." : learning ? "Finalizar captura e ver logs" : "Iniciar diagnóstico de cliques"}</button>
      {learning && <p className="text-xs" role="status">Diagnóstico ativo: você pode enviar o prompt e as imagens com o botão acima.</p>}
      {learningResult && <div className="space-y-2"><button type="button" onClick={() => void navigator.clipboard.writeText(learningResult).then(() => setMessage("Relatório copiado.")).catch(() => setMessage("Não foi possível copiar automaticamente. Selecione o texto abaixo."))} className="rounded-lg border border-border px-3 py-2 text-sm">Copiar relatório para análise</button><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border border-border p-3 text-xs" role="status">{learningResult}</pre></div>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {viewUrl && <div className="space-y-2">
      <iframe title="Tela privada do Chrome" src={viewUrl} referrerPolicy="no-referrer" className="h-[min(80vh,900px)] w-full rounded-lg border border-border" />
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Abrir Chrome em tela cheia</a>
    </div>}
  </article>;
}

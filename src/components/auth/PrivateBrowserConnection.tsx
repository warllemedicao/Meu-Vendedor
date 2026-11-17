"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type BrowserResponse = { status?: string; viewUrl?: string; error?: string; promptStaged?: boolean; imagesSubmitted?: number; active?: boolean; recorded?: number; events?: { role: string; type: string }[]; imageDirectory?: string; imagesAvailable?: number; events?: { kind?: string; role?: string; state?: Record<string,string>; attribute?: string; holdMs?: number | null }[]; projectOpen?: boolean; promptCandidates?: number; fileInputs?: number; uploadControls?: number; generationStarted?: boolean; settingsApplied?: boolean };

export function PrivateBrowserConnection() {
  const [busy, setBusy] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learningResult, setLearningResult] = useState("");
  const [message, setMessage] = useState("");
  const [viewUrl, setViewUrl] = useState("");
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
    if (busy) return;
    if (!learning && images.length && !rightsConfirmed) {
      setMessage("Confirme os direitos de uso das imagens antes de iniciar a captura.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const encoded = learning ? [] : await Promise.all(images.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let index = 0; index < bytes.length; index += 8192) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
        }
        return { mime: file.type, data: btoa(binary) };
      }));
      const result = await invoke(learning ? "learning_stop" : "learning_start",
        learning ? {} : { images: encoded, imageRightsConfirmed: rightsConfirmed });
      setLearning(result.active === true);
      if (result.active) {
        setLearningResult("");
        setMessage(`Captura iniciada. ${result.imagesAvailable ?? 0} imagem(ns) disponível(is) na pasta ${result.imageDirectory ?? "/tmp/meu-vendedor/treinamento/"} do Chrome. Finalize para apagar os arquivos temporários.`);
      } else {
        setLearningResult(`Interações capturadas: ${result.recorded ?? 0}. Diagnóstico estrutural (sem senhas ou conteúdo):\n${JSON.stringify(result.events ?? [], null, 2)}`);
        setMessage("Captura encerrada.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na captura.");
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
      <p className="text-sm font-medium">Modo aprendizado experimental</p>
      <p className="text-xs text-muted">Captura somente tipos de controles clicados no Flow, sem conteúdo digitado. Não grava um procedimento permanente nem executa ações sozinho.</p>
      <button type="button" disabled={busy || !viewUrl} onClick={() => void toggleLearning()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{learning ? "Finalizar captura" : "Iniciar captura de cliques"}</button>
      {learningResult && <p className="text-xs" role="status">{learningResult}</p>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {viewUrl && <div className="space-y-2">
      <iframe title="Tela privada do Chrome" src={viewUrl} referrerPolicy="no-referrer" className="h-[min(80vh,900px)] w-full rounded-lg border border-border" />
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Abrir Chrome em tela cheia</a>
    </div>}
  </article>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { STORY_STAGES, PLATFORM_GUIDES, makeEmptyStoryScenes, makeLocalPromptDrafts, makeStoryFlowAgentInstructions, countStoryPromptCharacters, countStoryWords, parseStoryDialogueDraft, STORY_CHARACTER_STYLES, type StoryCharacterStyle, type StoryStage } from "@/lib/stories/workflow";

type Genre = "geral" | "comedia" | "suspense" | "educativo" | "aventura" | "drama";
type Platform = "youtube-create" | "google-flow" | "dreamina";
type Topic = { id: string; user_id: string; subject: string; title: string; synopsis: string; genre: string; character_style: StoryCharacterStyle; saved: boolean };
type TopicDraft = Pick<Topic, "subject" | "title" | "synopsis" | "genre" | "character_style"> & { localId: string };
type Character = { name: string; role: string; visual: string; voice: string; referenceImagePath?: string; referenceImagePrompt?: string };
type Dialogue = { speaker: string; text: string };
type Scene = { number: number; durationSeconds: 10; title: string; setting: string; action: string; characters: string[]; dialogue: Dialogue[]; transition: string };
type Project = { id: string; user_id: string; title: string; status: string; genre?: string; topic_id?: string | null; character_style: StoryCharacterStyle; characters: Character[]; scenes: Scene[] };
type Prompt = { scene: number; text: string; platform: Platform };
type Clip = { id: string; scene_number: number; storage_path: string; approved: boolean };
type LibraryCharacter = { id: string; user_id: string; name: string; description: string; voice: string; image_prompt: string; storage_path: string };

const genres: { value: Genre; label: string }[] = [
  { value: "geral", label: "Todos os gêneros" }, { value: "comedia", label: "Comédia" },
  { value: "suspense", label: "Suspense" }, { value: "educativo", label: "Educativo" },
  { value: "aventura", label: "Aventura" }, { value: "drama", label: "Drama" },
];
const platformOptions: { value: Platform; label: string; maximum: number | null }[] = [
  { value: "youtube-create", label: "YouTube Create", maximum: 900 },
  { value: "google-flow", label: "Google Flow", maximum: 1600 },
  { value: "dreamina", label: "Dreamina", maximum: 1200 },
];
const starterCharacterPresets = [
  { name: "Limão Eletricista", prompt: "Personagem original de limão verde-claro antropomórfico, óculos redondos pretos, capacete branco, camisa verde-clara, calça azul e botas de segurança. Animação 3D estilizada, corpo inteiro, mesma roupa e traços em todas as cenas." },
  { name: "Maçã Mecânica", prompt: "Personagem original de maçã vermelha antropomórfica, sobrancelhas expressivas, capacete branco, macacão industrial azul com faixas refletivas e botas pretas. Animação 3D estilizada, corpo inteiro, identidade consistente." },
  { name: "Banana Aventureira", prompt: "Personagem original de banana amarela antropomórfica, óculos pequenos escuros e colete jeans azul, expressão confiante e divertida. Animação 3D estilizada, corpo inteiro, roupas e cores consistentes." },
  { name: "Beterraba Inventora", prompt: "Personagem original de beterraba vermelha antropomórfica, faixa branca na cabeça, uniforme de trabalho cinza e luvas azuis, expressão curiosa. Animação 3D estilizada, corpo inteiro, identidade visual fixa." },
] as const;
const button = "rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold disabled:opacity-40";
const field = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";
const panel = "rounded-2xl border border-border bg-surface p-4 space-y-4";
const plainError = (error: unknown): string => error instanceof Error ? error.message : "Não foi possível concluir a operação.";
const modelCooldowns = new Map<"topics" | "script", number>();
function generationScope(action: string): "topics" | "script" | null {
  if (action === "topics") return "topics";
  if (action === "script_block" || action === "prompts" || action === "prompt_scene") return "script";
  return null;
}


async function invokeStory(action: string, payload: Record<string, unknown>) {
  const scope = generationScope(action);
  if (scope) {
    const remaining = (modelCooldowns.get(scope) || 0) - Date.now();
    if (remaining > 0) throw new Error("Gemini" + " apresentou instabilidade nesta ferramenta. Aguarde " +
      Math.ceil(remaining / 1000) + " segundos antes de uma nova solicitação; a tentativa não foi enviada.");
  }
  const client = getSupabase();
  if (!client) throw new Error("O Supabase não está configurado neste navegador.");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Faça login em Conta e conexões antes de continuar.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(url + "/functions/v1/story-studio", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token, apikey: key || "", "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data === "object" && data && "error" in data ? String(data.error) : String(res.status);
    if (scope && (code === "gemini_service_unavailable" || code === "gemini_timeout" || code === "gemini_service_unavailable" || code === "gemini_timeout")) {
      modelCooldowns.set(scope, Date.now() + (code.endsWith("_timeout") ? 120_000 : 90_000));
    }
    if (code === "gemini_not_configured") throw new Error("Cadastre HIST_ROTEIRO_GEMINI_API_KEY para roteiros e HIST_TEMA_GEMINI_API_KEY para temas no Supabase.");
    if (code === "gemini_invalid_key") throw new Error("A chave Gemini foi rejeitada. Confira a chave exclusiva da função no Supabase.");
    if (code === "gemini_quota_exceeded") throw new Error("Cota gratuita do Gemini atingida. Blocos anteriores permanecem salvos; confira os limites no Google AI Studio.");
    if (code === "gemini_billing_required") throw new Error("O Gemini exigiu cobrança. Nenhuma repetição foi feita.");
    if (code === "gemini_service_unavailable" || code === "gemini_timeout" || code === "gemini_network_error")
      throw new Error("Gemini indisponível. Blocos anteriores continuam salvos; não repita sem verificar os registros.");
    if (code === "gemini_output_truncated") throw new Error("Gemini atingiu o limite de saída antes de concluir o bloco. As cenas anteriores permanecem salvas.");
    if (code === "gemini_invalid_json") throw new Error("Gemini retornou JSON inválido. O bloco não foi salvo; confira o diagnóstico.");
    if (code === "image_paid_api_not_authorized") throw new Error("Geração de imagem bloqueada: a API do Nano Banana pode cobrar. É necessária autorização explícita da geração paga no backend.");
    if (code === "image_api_not_configured") throw new Error("A chave exclusiva do Nano Banana ainda não foi configurada no Supabase. Use o envio manual por enquanto.");
    if (code === "image_generation_failed") throw new Error("Nano Banana não retornou uma imagem válida; não repita sem consultar a cota.");
    if (code === "gemini_quota_exceeded") {
      throw new Error("O limite de requisições da API Gemini foi atingido. Verifique as cotas no Google AI Studio antes de tentar novamente.");
    }
    throw new Error("Serviço de Histórias: " + code);
  }
  if (scope) modelCooldowns.delete(scope);
  return data;
}
export function StoriesStudio() {
  const { user } = useAuth();
  const [stage, setStage] = useState<StoryStage>("temas");
  const [subject, setSubject] = useState("");
  const [genre, setGenre] = useState<Genre>("geral");
  const [characterStyle, setCharacterStyle] = useState<Exclude<StoryCharacterStyle, "nao_definido"> | null>(null);
  const [requested, setRequested] = useState(5);
  const [query, setQuery] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState<Genre>("geral");
  const [characterStyleFilter, setCharacterStyleFilter] = useState<StoryCharacterStyle | "todos">("todos");
  const [draftTopics, setDraftTopics] = useState<TopicDraft[]>([]);
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [destination, setDestination] = useState<"youtube" | "tiktok" | "kwai">("youtube");
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [deletingTopics, setDeletingTopics] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [platform, setPlatform] = useState<Platform>("youtube-create");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sceneProgress, setSceneProgress] = useState("");
  const [characterLibrary, setCharacterLibrary] = useState<LibraryCharacter[]>([]);
  const [selectedCastIds, setSelectedCastIds] = useState<string[]>([]);
  const [newCastName, setNewCastName] = useState("");
  const [newCastDescription, setNewCastDescription] = useState("");
  const [newCastFile, setNewCastFile] = useState<File | null>(null);
  const [libraryImageUrls, setLibraryImageUrls] = useState<Record<string,string>>({});
  const [characterImageUrls, setCharacterImageUrls] = useState<Record<string,string>>({});
  const [imageNames, setImageNames] = useState<Record<number,string>>({});
  const [characterNameDrafts, setCharacterNameDrafts] = useState<Record<string,string>>({});
  const [libraryNameDrafts, setLibraryNameDrafts] = useState<Record<string,string>>({});
  const [renamingLibraryId, setRenamingLibraryId] = useState<string | null>(null);
  const [imagePrompts, setImagePrompts] = useState<Record<number,string>>({});
  const [imageConfigured, setImageConfigured] = useState(false);
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null);
  const [addingCharacterImageIndex, setAddingCharacterImageIndex] = useState<number | null>(null);
  const [selectedPlatformByScene, setSelectedPlatformByScene] = useState<Record<number,Platform>>({});
  const [scenePromptDrafts, setScenePromptDrafts] = useState<Record<string,string>>({});
  const [sceneDialogueDrafts, setSceneDialogueDrafts] = useState<Record<string,string>>({});
  const [expandedScene, setExpandedScene] = useState(1);
  const [sceneWorkbenchStep, setSceneWorkbenchStep] = useState<"roteiro"|"personagens"|"prompt">("roteiro");
  const [copiedScenePrompt, setCopiedScenePrompt] = useState<string | null>(null);
  const stopSceneQueue = useRef(false);
  const startingScriptRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadTopics = useCallback(async () => {
    if (!user) { setTopics([]); return; }
    const client = getSupabase();
    if (!client) return;
    const { data, error: dbError } = await client.from("mv_story_topics").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1500);
    if (dbError) { setError("Não foi possível carregar os temas. Verifique a migração do Histórias."); return; }
    setTopics((data || []) as Topic[]);
  }, [user]);
  const loadProjects = useCallback(async () => {
    if (!user) { setProjects([]); return; }
    const client = getSupabase(); if (!client) return;
    const { data } = await client.from("mv_story_projects").select("id,user_id,topic_id,genre,character_style,title,status,characters,scenes")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
    setProjects((data || []) as Project[]);
  }, [user]);

  const loadCharacterLibrary = useCallback(async () => {
    if (!user) { setCharacterLibrary([]); setLibraryImageUrls({}); return; }
    const client = getSupabase(); if (!client) return;
    const { data, error: dbError } = await client.from("mv_story_characters").select("*")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
    if (dbError) { setError("Não foi possível carregar a biblioteca de personagens."); return; }
    const entries = (data || []) as LibraryCharacter[];
    setCharacterLibrary(entries);
    const signed = await Promise.all(entries.map(async entry => {
      const { data: signedImage } = await client.storage.from("mv-story-images")
        .createSignedUrl(entry.storage_path, 600);
      return [entry.storage_path, signedImage?.signedUrl || ""] as const;
    }));
    setLibraryImageUrls(Object.fromEntries(signed.filter(([,url])=>url)));
  }, [user]);
  useEffect(() => { void Promise.resolve().then(() => Promise.all([loadTopics(), loadProjects(), loadCharacterLibrary()])); }, [loadTopics, loadProjects, loadCharacterLibrary]);
  useEffect(() => {
    if (!user) return;
    void invokeStory("image_config", {}).then(result => {
      const config = result as { configured?: boolean };
      setImageConfigured(Boolean(config.configured));
    }).catch(() => setImageConfigured(false));
  }, [user]);
  const promptKey = (sceneNumber: number, provider: Platform) => provider + ":" + sceneNumber;
  function downloadTextFile(filename: string, contents: string) {
    const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function downloadReference(storagePath: string, name: string) {
    const client = getSupabase(); if (!client) return;
    const { data, error: fetchError } = await client.storage.from("mv-story-images").download(storagePath);
    if (fetchError || !data) return setError("Não foi possível baixar a referência privada.");
    const extension = storagePath.split(".").at(-1)?.toLowerCase() || "png";
    const safeName = name.replace(/[^a-z0-9_-]/gi, "_").slice(0,70);
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = safeName + "." + extension;
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function persistCharacterImage(characterIndex: number, storagePath: string, prompt: string, libraryName?: string) {
    if (!project || !user) throw new Error("Selecione um projeto antes de associar a imagem.");
    const client = getSupabase(); if (!client) throw new Error("Supabase indisponível.");
    const character = project.characters[characterIndex];
    if (!character) throw new Error("Personagem não encontrado.");
    const characters = project.characters.map((entry, i) =>
      i === characterIndex ? { ...entry, referenceImagePath: storagePath, referenceImagePrompt: prompt.trim().slice(0,1200) } : entry);
    const name = (libraryName || character.name).trim();
    if (!name || name.length > 100) throw new Error("Informe um nome de até 100 caracteres para a imagem.");
    // New image uploads must not overwrite an existing library record with the same name.
    const { error: libraryError } = await client.from("mv_story_characters").insert({
      user_id: user.id, name, description: character.visual, voice: character.voice,
      image_prompt: prompt.trim().slice(0,1600), storage_path: storagePath,
      updated_at: new Date().toISOString(),
    });
    if (libraryError) throw new Error("Não foi possível salvar o nome da imagem. Verifique se outra imagem já utiliza esse nome.");
    const { error: saveError } = await client.from("mv_story_projects")
      .update({ characters, updated_at: new Date().toISOString() })
      .eq("id", project.id).eq("user_id", user.id);
    if (saveError) throw new Error("Imagem salva na biblioteca, mas não foi possível vinculá-la ao roteiro.");
    const { data: imageData } = await client.storage.from("mv-story-images").createSignedUrl(storagePath, 600);
    if (imageData?.signedUrl) setCharacterImageUrls(prev => ({ ...prev, [storagePath]: imageData.signedUrl }));
    setProject({ ...project, characters });
    await loadCharacterLibrary();
    setImageNames(old => { const next = { ...old }; delete next[characterIndex]; return next; });
    setMessage("Imagem associada e salva na biblioteca: " + name);
  }
  async function chooseLibraryImage(characterIndex: number, entry: LibraryCharacter) {
    if (!project || !user || project.status !== "draft") return;
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const characters = project.characters.map((ch, i) => i === characterIndex
        ? { ...ch, referenceImagePath: entry.storage_path, referenceImagePrompt: entry.image_prompt } : ch);
      const { error: saveError } = await client.from("mv_story_projects")
        .update({ characters, updated_at: new Date().toISOString() })
        .eq("id", project.id).eq("user_id", user.id);
      if (saveError) throw new Error("Não foi possível vincular a imagem selecionada.");
      setProject({ ...project, characters });
      if (libraryImageUrls[entry.storage_path])
        setCharacterImageUrls(prev => ({ ...prev, [entry.storage_path]: libraryImageUrls[entry.storage_path] }));
      setMessage("Imagem de " + entry.name + " associada ao personagem " + project.characters[characterIndex].name + ".");
    } catch(e) { setError(plainError(e)); } finally { setBusy(false); }
  }
  async function renameLibraryCharacter(entry: LibraryCharacter, name: string) {
    if (!user) return;
    const nextName = name.trim();
    if (!nextName || nextName.length > 100) return setError("Informe um nome de até 100 caracteres para a imagem.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const { error: dbError } = await client.from("mv_story_characters")
        .update({ name: nextName, updated_at: new Date().toISOString() })
        .eq("id", entry.id).eq("user_id", user.id);
      if (dbError) throw new Error("Não foi possível salvar o nome da imagem. Confira se já existe outra imagem com esse nome.");
      await loadCharacterLibrary();
      setRenamingLibraryId(null);
      setLibraryNameDrafts(old => { const next = { ...old }; delete next[entry.id]; return next; });
      setMessage("Nome da imagem salvo: " + nextName);
    } catch (error) { setError(plainError(error)); }
    finally { setBusy(false); }
  }
  async function checkImageNameAvailable(name: string) {
    if (!user) throw new Error("Faça login para salvar uma imagem.");
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error("Informe um nome de até 100 caracteres para a imagem.");
    const client = getSupabase(); if (!client) throw new Error("Supabase indisponível.");
    const { data, error } = await client.from("mv_story_characters")
      .select("id").eq("user_id", user.id).eq("name", trimmed).limit(1).maybeSingle();
    if (error) throw new Error("Não foi possível consultar os nomes salvos. Tente novamente antes de enviar.");
    if (data) throw new Error("Já existe uma imagem com esse nome. Escolha outro nome antes de enviar.");
  }
  async function generateCharacterReference(characterIndex: number) {
    if (!project || !user || busy) return;
    const character = project.characters[characterIndex];
    if (!character || !imageConfigured) return setError("Configure HIST_IMAGEM_GEMINI_API_KEY antes de gerar imagens. O envio manual já está disponível.");
    // Every generated image is a new library entry; no extra name field is required.
    const name = (character.name.slice(0, 87) + " " + crypto.randomUUID().slice(0, 8)).slice(0, 100);
    const prompt = imagePrompts[characterIndex]?.trim() || character.visual;
    if (prompt.length < 15) return setError("Descreva o personagem com pelo menos 15 caracteres.");
    setBusy(true); setError(""); setSceneProgress("Solicitando uma imagem ao Nano Banana...");
    try {
      await checkImageNameAvailable(name);
      const result = await invokeStory("image_character", { name, prompt }) as { data: string; mimeType: string };
      if (!result.data || !["image/png","image/jpeg","image/webp"].includes(result.mimeType))
        throw new Error("O gerador não retornou uma imagem válida.");
      const raw = atob(result.data);
      const imageBuffer = new ArrayBuffer(raw.length);
      const bytes = new Uint8Array(imageBuffer);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const extension = result.mimeType === "image/png" ? "png" : result.mimeType === "image/webp" ? "webp" : "jpg";
      const file = new File([imageBuffer], name + "." + extension, { type: result.mimeType });
      if (file.size > 10 * 1024 * 1024) throw new Error("A imagem excedeu 10 MB.");
      const client = getSupabase(); if (!client) throw new Error("Supabase indisponível.");
      const path = user.id + "/library/" + (project.character_style || "nao_definido") + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await client.storage.from("mv-story-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("A imagem foi gerada, mas falhou o armazenamento privado.");
      await persistCharacterImage(characterIndex, path, prompt, name);
    } catch(e) { setError(plainError(e)); }
    finally { setBusy(false); setSceneProgress(""); }
  }
  function invalidDialogueMessage(sceneNumber: number): string | null {
    if (!project) return null;
    const draft = sceneDialogueDrafts[project.id + ":" + sceneNumber];
    if (draft === undefined) return null;
    const invalid = parseStoryDialogueDraft(draft).invalidLines;
    return invalid.length
      ? "Corrija a(s) linha(s) " + invalid.join(", ") + " das falas da cena " + sceneNumber + ". Use Nome: texto antes de continuar."
      : null;
  }
  async function prepareScenePrompt(sceneNumber: number, useGemini: boolean) {
    if (!project || !user || busy) return;
    const dialogueIssue = invalidDialogueMessage(sceneNumber);
    if (dialogueIssue) return setError(dialogueIssue);
    const scene = project.scenes.find(s => s.number === sceneNumber);
    if (!scene?.setting.trim() || !scene.action.trim())
      return setError("Gere ou preencha esta cena antes de preparar o prompt.");
    const provider = selectedPlatformByScene[sceneNumber] || platform;
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError(""); setCopiedScenePrompt(null); setSceneProgress(useGemini ? "Gerando prompt da cena " + sceneNumber : "");
    try {
      const key = promptKey(sceneNumber, provider);
      const { data: existing, error: readError } = await client.from("mv_story_prompts").select("prompt")
        .eq("project_id", project.id).eq("user_id", user.id)
        .eq("scene_number", sceneNumber).eq("platform", provider).maybeSingle();
      if (readError) throw new Error("Falha ao consultar prompt anterior. Nenhum crédito de IA foi utilizado.");
      if (existing?.prompt && useGemini) {
        setScenePromptDrafts(old => ({ ...old, [key]: existing.prompt }));
        setSceneWorkbenchStep("prompt");
        if (!window.confirm("Já existe um prompt salvo nesta cena. Gerar uma nova versão com Gemini? Isso pode consumir créditos. O anterior continuará salvo até você aprovar e salvar o novo.")) {
          setMessage("Prompt salvo recuperado sem gastar créditos de IA.");
          return;
        }
      }
      const draft = useGemini
        ? (await invokeStory("prompt_scene", {
          platform: provider, sceneNumber, scene, characterStyle: project.character_style || "nao_definido", characters: project.characters,
        }) as { prompt: Prompt }).prompt?.text
        : makeLocalPromptDrafts(provider, project.characters, [scene], project.character_style || "nao_definido")[0]?.text;
      if (!draft) throw new Error("O prompt não foi preparado.");
      const limit = PLATFORM_GUIDES[provider].absoluteChars;
      if (countStoryPromptCharacters(draft) > limit) throw new Error("A resposta excede " + limit +
        " caracteres de " + PLATFORM_GUIDES[provider].name + ". Revise o prompt antes de usar.");
      setScenePromptDrafts(old => ({ ...old, [key]: draft }));
      setSceneWorkbenchStep("prompt");
      const localNotice = !useGemini ? makeLocalPromptDrafts(provider, project.characters, [scene],
        project.character_style || "nao_definido")[0]?.notice : undefined;
      setMessage((useGemini ? "Prompt gerado; revise e salve antes de baixar." : "Rascunho criado sem usar API. Revise e salve.") +
        (localNotice ? " " + localNotice : ""));
    } catch(e) { setError(plainError(e)); }
    finally { setBusy(false); setSceneProgress(""); }
  }
  async function saveScenePrompt(sceneNumber: number) {
    if (!project || !user) return;
    const provider = selectedPlatformByScene[sceneNumber] || platform;
    const text = scenePromptDrafts[promptKey(sceneNumber, provider)]?.trim() || "";
    const maximum = platformOptions.find(p => p.value === provider)?.maximum || 900;
    if (!text || countStoryPromptCharacters(text) > maximum) return setError("O prompt excede o teto de " + maximum + " caracteres. Use Gerar prompt sem IA para uma versão enxuta, ou revise antes de salvar.");
    const client = getSupabase(); if (!client) return;
    const { error: dbError } = await client.from("mv_story_prompts").upsert({
      user_id: user.id, project_id: project.id, scene_number: sceneNumber,
      platform: provider, prompt: text,
    }, { onConflict: "project_id,scene_number,platform" });
    if (dbError) return setError("Não foi possível salvar o prompt.");
    setMessage("Prompt da cena " + sceneNumber + " salvo para " + provider + ".");
  }
  async function advanceToNextScene(sceneNumber: number) {
    if (!project || !user || busy || sceneNumber >= 12) return;
    const dialogueIssue = invalidDialogueMessage(sceneNumber);
    if (dialogueIssue) return setError(dialogueIssue);
    const current = project.scenes.find(s => s.number === sceneNumber);
    const next = project.scenes.find(s => s.number === sceneNumber + 1);
    if (!current?.action.trim() || !current.setting.trim() || !next) {
      setError("Preencha cenário e ação da cena atual antes de avançar."); return;
    }
    const provider = selectedPlatformByScene[sceneNumber] || platform;
    const promptText = scenePromptDrafts[promptKey(sceneNumber, provider)]?.trim() || "";
    const limit = PLATFORM_GUIDES[provider].absoluteChars;
    if (!promptText || Array.from(promptText).length > limit) {
      setError("Prepare um prompt de até " + limit + " caracteres antes de avançar."); return;
    }
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError(""); setMessage("");
    try {
      // Commit the reviewed current scene and its prompt BEFORE requesting any subsequent inference.
      const { error: scriptSaveError } = await client.from("mv_story_projects")
        .update({ scenes: project.scenes, characters: project.characters, updated_at: new Date().toISOString() })
        .eq("id", project.id).eq("user_id", user.id);
      if (scriptSaveError) throw new Error("Não foi possível salvar esta cena. Nenhuma nova geração foi enviada.");
      const { error: promptSaveError } = await client.from("mv_story_prompts").upsert({
        user_id: user.id, project_id: project.id, scene_number: sceneNumber,
        platform: provider, prompt: promptText,
      }, { onConflict: "project_id,scene_number,platform" });
      if (promptSaveError) throw new Error("A cena foi salva, mas o prompt não. Nenhuma nova geração foi enviada.");
      if (next.action.trim() && next.setting.trim()) {
        selectWorkbenchScene(next.number);
        setMessage("Cena " + sceneNumber + " salva. Abrindo cena " + next.number + " já existente.");
        return;
      }
      const firstMissing = project.scenes.findIndex(s => !s.action.trim() || !s.setting.trim());
      if (firstMissing !== sceneNumber) {
        selectWorkbenchScene(firstMissing + 1);
        setMessage("Os materiais foram salvos. Complete primeiro a cena " + (firstMissing + 1) + " para preservar a ordem.");
        return;
      }
      await generateOneBlock(project);
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); setSceneProgress(""); void loadProjects(); }
  }
  async function copyScenePrompt(sceneNumber: number, provider: Platform, prompt: string) {
    if (countStoryPromptCharacters(prompt) > PLATFORM_GUIDES[provider].absoluteChars) {
      setError("O prompt excede o limite de " + PLATFORM_GUIDES[provider].absoluteChars +
        " caracteres. Refaça a versão compacta antes de copiar."); return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedScenePrompt(promptKey(sceneNumber, provider));
      setMessage("Prompt da cena " + sceneNumber + " copiado. Para continuar a história, use o botão Gerar próxima cena dentro deste painel.");
    } catch { setError("O navegador não conseguiu copiar o prompt. Use Baixar prompt .txt."); }
  }
  function selectWorkbenchScene(sceneNumber: number) {
    setExpandedScene(sceneNumber);
    setSceneWorkbenchStep("roteiro");
    setEditingCharacterIndex(null);
    setAddingCharacterImageIndex(null);
    setCopiedScenePrompt(null);
    setError("");
  }
  async function openProject(selected: Project) {
    if (!user) return;
    setSceneDialogueDrafts({});
    setCharacterNameDrafts({}); setImageNames({}); setImagePrompts({});
    setError(""); setProject(selected); setActiveTopic(null); setPublishTitle(selected.title); setPublishDescription(""); setExpandedScene(Math.max(1, selected.scenes.reduce((last, s) => s.action?.trim() && s.setting?.trim() ? s.number : last, 1))); setSceneWorkbenchStep("roteiro"); setStage("roteiro");
    const client = getSupabase(); if (!client) return;
    const [clipsResult, promptResult] = await Promise.all([
      client.from("mv_story_clips").select("id,scene_number,storage_path,approved").eq("user_id", user.id).eq("project_id", selected.id),
      client.from("mv_story_prompts").select("scene_number,prompt,platform").eq("user_id", user.id).eq("project_id", selected.id).eq("platform", platform).order("scene_number"),
    ]);
    if (selected.topic_id) {
      const { data: sourceTopic } = await client.from("mv_story_topics")
        .select("id,user_id,subject,title,synopsis,genre,character_style,saved")
        .eq("id", selected.topic_id).eq("user_id", user.id).maybeSingle();
      if (sourceTopic) { setActiveTopic(sourceTopic as Topic); setPublishDescription(sourceTopic.synopsis); }
    }
    if (selected.characters?.length) {
      const client2 = getSupabase();
      if (client2) {
        const signed = await Promise.all(selected.characters.filter(ch => ch.referenceImagePath).map(async ch => {
          const { data: image } = await client2.storage.from("mv-story-images").createSignedUrl(ch.referenceImagePath!, 600);
          return [ch.referenceImagePath!, image?.signedUrl || ""] as const;
        }));
        setCharacterImageUrls(Object.fromEntries(signed.filter(([,url])=>url)));
      }
    }
    const { data: allPrompts } = await client.from("mv_story_prompts").select("scene_number,platform,prompt")
      .eq("project_id", selected.id).eq("user_id", user.id);
    setScenePromptDrafts(Object.fromEntries((allPrompts || []).map(p => [promptKey(p.scene_number,p.platform as Platform),p.prompt])));
    setClips((clipsResult.data || []) as Clip[]);
    setPrompts((promptResult.data || []).map(p => ({ scene: p.scene_number as number, text: p.prompt as string, platform: p.platform as Platform })));
  }
  async function uploadCharacterBatch(files: FileList | null) {
    if (!files?.length || !project || !user || busy || project.status !== "draft") return;
    const list = Array.from(files);
    if (list.length > 20) return setError("Envie no máximo 20 imagens por seleção.");
    if (list.some(file => !["image/png","image/jpeg","image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024))
      return setError("Cada imagem precisa ser PNG, JPG ou WebP com até 10 MB.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError(""); setMessage("");
    // Preserve previously linked images; associate new images with unassigned characters first.
    const characters = [...project.characters];
    let completed = 0;
    try {
      for (const file of list) {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = user.id + "/library/" + (project.character_style || "nao_definido") + "/" + crypto.randomUUID() + "." + ext;
        const { error: upError } = await client.storage.from("mv-story-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upError) throw new Error("Falha ao enviar " + file.name + ".");
        const emptyIndex = characters.findIndex(ch => !ch.referenceImagePath);
        const basename = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 85);
        const title = emptyIndex >= 0 ? characters[emptyIndex].name : basename || "Personagem";
        const description = emptyIndex >= 0 ? characters[emptyIndex].visual : "";
        const voice = emptyIndex >= 0 ? characters[emptyIndex].voice : "";
        // A stable, unique library title avoids silently overwriting an existing image.
        const libraryName = (title.slice(0, 78) + " " + crypto.randomUUID().slice(0, 6)).slice(0, 100);
        const { error: libError } = await client.from("mv_story_characters").insert({
          user_id: user.id, name: libraryName, description, voice,
          image_prompt: description, storage_path: path,
        });
        if (libError) throw new Error("Imagem enviada, mas falhou ao registrar " + file.name + " na biblioteca.");
        if (emptyIndex >= 0) {
          characters[emptyIndex] = { ...characters[emptyIndex], referenceImagePath: path,
            referenceImagePrompt: description };
          const { error: saveError } = await client.from("mv_story_projects")
            .update({ characters, updated_at: new Date().toISOString() })
            .eq("id", project.id).eq("user_id", user.id);
          if (saveError) throw new Error("Imagem salva, mas não foi possível vincular " + file.name + " ao roteiro.");
          setProject(prev => prev?.id === project.id ? { ...prev, characters: [...characters] } : prev);
        }
        completed++;
        setSceneProgress("Imagens salvas: " + completed + "/" + list.length);
      }
      setMessage(completed + " imagens enviadas. As primeiras foram vinculadas aos personagens sem referência; as demais estão na biblioteca.");
    } catch(e) { setError(plainError(e) + " " + completed + " imagem(ns) já salva(s)."); }
    finally { await loadCharacterLibrary(); setBusy(false); setSceneProgress(""); }
  }
  async function uploadReference(characterIndex: number, file?: File) {
    if (!file || !user || !project || project.status !== "draft") return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
      return setError("Use PNG, JPG ou WebP de até 10 MB.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      await checkImageNameAvailable(imageNames[characterIndex]?.trim() || project.characters[characterIndex].name);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = user.id + "/library/" + (project.character_style || "nao_definido") + "/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await client.storage.from("mv-story-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("Falha ao enviar referência visual privada.");
      const name = imageNames[characterIndex]?.trim() || project.characters[characterIndex]?.name;
      await persistCharacterImage(characterIndex, path, imagePrompts[characterIndex] || project.characters[characterIndex].visual, name);
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }

  async function generateTopics() {
    if (!user || subject.trim().length < 2) return;
    if (!characterStyle) return setError("Escolha o tipo de personagem antes de gerar os temas.");
    setBusy(true); setError(""); setMessage(""); setProgress(0);
    const normalizedSubject = subject.trim();
    const known = new Set([...topics.filter(t => t.subject === normalizedSubject && t.character_style === characterStyle).map(t => t.title.toLowerCase()),
      ...draftTopics.filter(t => t.subject === normalizedSubject && t.character_style === characterStyle).map(t => t.title.toLowerCase())]);
    try {
      // One click = one Gemini topics request. Script generation uses Gemini separately.
      const result = await invokeStory("topics", {
        subject: normalizedSubject, genre, characterStyle, count: requested,
        excludedTitles: [...known].slice(-30),
      }) as { topics: { title: string; genre: string; synopsis: string }[] };
      if (!Array.isArray(result.topics)) throw new Error("O Gemini não retornou uma lista válida.");
      const fresh = result.topics.filter(t => t.title && !known.has(t.title.toLowerCase()));
      if (!fresh.length) throw new Error("O Gemini repetiu os temas. Tente outro assunto ou gênero.");
      const batch = fresh.map(t => ({
        localId: crypto.randomUUID(), subject: normalizedSubject, title: t.title,
        synopsis: t.synopsis, genre: t.genre, character_style: characterStyle,
      }));
      setDraftTopics(previous => [...previous, ...batch]);
      setProgress(batch.length);
      setMessage(batch.length + " temas na caixa de revisão. " +
        (batch.length < requested ? "Resposta parcial: não foram feitas solicitações adicionais. " : "") +
        "Salve os que desejar.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  async function saveDraftTopics(items: TopicDraft[]) {
    if (!user || !items.length) return;
    const client = getSupabase(); if (!client) return;
    setSavingTopic(items.length === 1 ? items[0].localId : "all"); setError("");
    try {
      const rows = items.map(t => ({ user_id: user.id, subject: t.subject, title: t.title,
        synopsis: t.synopsis, genre: t.genre, character_style: t.character_style, saved: true }));
      // Divide também a gravação para evitar limites de tamanho de uma única requisição.
      for (let i = 0; i < rows.length; i += 50) {
        const { error: dbError } = await client.from("mv_story_topics").upsert(rows.slice(i, i + 50),
          { onConflict: "user_id,subject,title,character_style", ignoreDuplicates: true });
        if (dbError) throw new Error("Não foi possível salvar todos os temas; os lotes anteriores foram mantidos.");
      }
      const ids = new Set(items.map(t => t.localId));
      setDraftTopics(previous => previous.filter(t => !ids.has(t.localId)));
      await loadTopics();
      setMessage(items.length + " tema(s) enviado(s) à biblioteca.");
    } catch (e) { setError(plainError(e)); await loadTopics(); }
    finally { setSavingTopic(null); }
  }
  async function toggleSaved(topic: Topic) {
    const client = getSupabase(); if (!client || !user) return;
    const { error: dbError } = await client.from("mv_story_topics").update({ saved: !topic.saved }).eq("id", topic.id).eq("user_id", user.id);
    if (dbError) setError("Não foi possível alterar o favorito.");
    else setTopics(old => old.map(t => t.id === topic.id ? { ...t, saved: !t.saved } : t));
  }
  function toggleTopicSelection(topicId: string) {
    setSelectedTopicIds(current => current.includes(topicId)
      ? current.filter(id => id !== topicId) : [...current, topicId]);
  }
  async function deleteSelectedTopics() {
    if (!user || busy || deletingTopics) return;
    const visibleIds = new Set(visibleTopics.map(topic => topic.id));
    const ids = [...new Set(selectedTopicIds)].filter(id => visibleIds.has(id) &&
      topics.some(topic => topic.id === id && topic.user_id === user.id));
    if (!ids.length) return setError("Marque pelo menos um tema visível para excluir.");
    if (!window.confirm("Excluir definitivamente " + ids.length + " tema(s)? Roteiros já criados permanecerão salvos, sem o vínculo com o tema excluído.")) return;
    const client = getSupabase(); if (!client) return setError("Supabase indisponível.");
    setDeletingTopics(true); setError(""); setMessage("");
    let deletedCount = 0;
    try {
      for (let index = 0; index < ids.length; index += 50) {
        const batch = ids.slice(index, index + 50);
        const { data: deleted, error: deleteError } = await client.from("mv_story_topics")
          .delete().eq("user_id", user.id).in("id", batch).select("id");
        if (deleteError) throw new Error("Falha ao excluir o lote de temas.");
        const deletedIds = (deleted || []).map(row => row.id as string);
        if (deletedIds.length !== batch.length)
          throw new Error("Nem todos os temas do lote foram removidos.");
        deletedCount += deletedIds.length;
        setTopics(current => current.filter(topic => !deletedIds.includes(topic.id)));
        setSelectedTopicIds(current => current.filter(id => !deletedIds.includes(id)));
      }
      setMessage(deletedCount + " tema(s) excluído(s). Os roteiros existentes foram preservados.");
    } catch (e) {
      setError(plainError(e) + " " + deletedCount + " tema(s) removido(s) antes da falha.");
    } finally {
      await Promise.all([loadTopics(), loadProjects()]);
      setDeletingTopics(false);
    }
  }
  async function savePreScriptCharacter() {
    if (!user || busy) return;
    const name = newCastName.trim();
    const prompt = newCastDescription.trim();
    if (!characterStyle) return setError("Escolha primeiro o tipo de personagem.");
    if (!name || name.length > 100 || prompt.length < 15 || !newCastFile)
      return setError("Informe nome, descrição de pelo menos 15 caracteres e uma imagem do personagem.");
    if (!["image/jpeg","image/png","image/webp"].includes(newCastFile.type) || newCastFile.size > 10 * 1024 * 1024)
      return setError("Use uma imagem PNG, JPG ou WebP de até 10 MB.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      await checkImageNameAvailable(name);
      const ext = newCastFile.type === "image/png" ? "png" : newCastFile.type === "image/webp" ? "webp" : "jpg";
      const path = user.id + "/library/" + characterStyle + "/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await client.storage.from("mv-story-images")
        .upload(path, newCastFile, { contentType: newCastFile.type, upsert: false });
      if (uploadError) throw new Error("Falha ao salvar a imagem privada.");
      const { data, error: dbError } = await client.from("mv_story_characters").insert({
        user_id: user.id, name, description: prompt, voice: "",
        image_prompt: prompt, storage_path: path,
      }).select("id").single();
      if (dbError || !data) throw new Error("A imagem foi enviada, mas não foi possível registrar o personagem.");
      setSelectedCastIds(current => current.length < 4 ? [...current, data.id as string] : current);
      setNewCastName(""); setNewCastDescription(""); setNewCastFile(null);
      await loadCharacterLibrary();
      setMessage("Personagem " + name + " salvo na biblioteca e selecionado para o roteiro.");
    } catch (error) { setError(plainError(error)); }
    finally { setBusy(false); }
  }
  // Generated image variants carry an 8-character storage suffix, not part of the story character name.
  const castDisplayName = (name: string) => name.replace(/ [0-9a-f]{8}$/i, "").trim();
  function selectedCastForStyle(style: StoryCharacterStyle): Character[] {
    const chosen = selectedCastIds.map(id => characterLibrary.find(entry => entry.id === id)).filter(
      (entry): entry is LibraryCharacter => Boolean(entry));
    if (chosen.length < 1 || chosen.length > 4)
      throw new Error("Selecione de 1 a 4 personagens salvos antes de gerar o roteiro.");
    if (style !== "nao_definido" && chosen.some(entry => !entry.storage_path.includes("/library/" + style + "/")))
      throw new Error("Selecione personagens do mesmo tipo visual deste tema.");
    if (new Set(chosen.map(entry => castDisplayName(entry.name).toLocaleLowerCase("pt-BR"))).size !== chosen.length)
      throw new Error("Os personagens selecionados precisam ter nomes diferentes.");
    return chosen.map(entry => ({
      name: castDisplayName(entry.name), role: "Personagem da história",
      visual: (entry.image_prompt.trim() || entry.description.trim()).slice(0, 1100),
      voice: entry.voice.trim() || "Voz expressiva em português brasileiro",
      referenceImagePath: entry.storage_path,
      referenceImagePrompt: (entry.image_prompt.trim() || entry.description.trim()).slice(0, 1200),
    }));
  }
  function toggleCastMember(id: string) {
    setSelectedCastIds(current => current.includes(id)
      ? current.filter(value => value !== id)
      : current.length < 4 ? [...current, id] : current);
  }
  async function generateScript(topic: Topic, createNewVersion = false) {
    // Guard immediately: React state updates do not prevent very fast double clicks.
    if (!user || busy || startingScriptRef.current) return;
    const client = getSupabase(); if (!client) return setError("Supabase indisponível.");
    startingScriptRef.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!createNewVersion) {
        // Always query Supabase, not the first 100 projects cached by the browser.
        // Fail closed on read errors: never spend Gemini tokens if the lookup failed.
        const { data: existing, error: lookupError } = await client.from("mv_story_projects")
          .select("id,user_id,topic_id,genre,character_style,title,status,characters,scenes")
          .eq("user_id", user.id).eq("topic_id", topic.id)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (lookupError) throw new Error("Não foi possível verificar os roteiros salvos. Nenhum novo roteiro ou pedido de IA foi criado.");
        if (existing) {
          await openProject(existing as Project);
          setMessage("Roteiro existente recuperado sem consumir tokens de IA. Para criar outra versão, use Mais → Nova versão.");
          return;
        }
      }
      const selectedCharacters = selectedCastForStyle(topic.character_style || "nao_definido");
      // Persist the selected cast BEFORE inference so a provider failure keeps names and image references.
      const { data, error: dbError } = await client.from("mv_story_projects").insert({
        user_id: user.id, topic_id: topic.id, title: topic.title, genre: topic.genre,
        character_style: topic.character_style || "nao_definido",
        characters: selectedCharacters, scenes: makeEmptyStoryScenes(), status: "draft",
      }).select("id,user_id,topic_id,genre,character_style,title,status,characters,scenes").single();
      if (dbError || !data) throw new Error("Não foi possível iniciar o rascunho retomável.");
      setSceneDialogueDrafts({}); setCharacterNameDrafts({}); setImageNames({}); setImagePrompts({});
      setActiveTopic(topic); setProject(data as Project); setPrompts([]); setClips([]); setExpandedScene(1); setSceneWorkbenchStep("roteiro"); setStage("roteiro");
      setPublishTitle(topic.title); setPublishDescription(topic.synopsis);
      void loadProjects();
      setSceneProgress("Gerando roteiro Gemini em três blocos de quatro cenas...");
      const finalScript = await generateFullScript(data as Project, topic.synopsis);
      setMessage(finalScript.scenes.every(s => s.action.trim() && s.setting.trim())
        ? "12 cenas geradas e salvas com Gemini. Revise antes de aprovar."
        : "Blocos concluídos salvos. Continue os restantes quando desejar.");
    } catch (e) { setError(plainError(e)); }
    finally { startingScriptRef.current = false; setBusy(false); setSceneProgress(""); }
  }
  async function generateFullScript(working: Project, synopsisOverride?: string): Promise<Project> {
    if (!user || working.status !== "draft") throw new Error("Roteiro indisponível para edição.");
    if (working.scenes.some(s => s.action.trim() || s.setting.trim()))
      throw new Error("Já existem cenas neste projeto. Continue a partir das cenas salvas.");
    stopSceneQueue.current = false;
    let current = working;
    while (current.scenes.some(s => !s.action.trim() || !s.setting.trim()) && !stopSceneQueue.current) {
      current = await generateOneBlock(current, synopsisOverride);
      if (current.scenes.every(s => s.action.trim() && s.setting.trim()) || stopSceneQueue.current) break;
      setSceneProgress("Bloco salvo. Intervalo de segurança antes do próximo...");
      await new Promise(resolve => setTimeout(resolve, 16_000));
    }
    return current;
  }
  async function resumeFullScript() {
    if (!project || !user || busy || project.status !== "draft") return;
    setBusy(true); setError(""); setSceneProgress("");
    try {
      const complete = project.scenes.every(s => !s.action.trim() && !s.setting.trim());
      const current = complete ? await generateFullScript(project) : await generateRemainingBlocks(project);
      void loadProjects();
      if (current.scenes.every(s => s.action.trim() && s.setting.trim()))
        setMessage("12 cenas geradas com Gemini e salvas. Revise antes de aprovar.");
      else setMessage("Blocos já gerados foram salvos; você pode continuar depois.");
    } catch (e) { setError(plainError(e)); void loadProjects(); }
    finally { setBusy(false); setSceneProgress(""); stopSceneQueue.current = false; }
  }
  async function generateOneBlock(working: Project, synopsisOverride?: string): Promise<Project> {
    if (!user || working.status !== "draft") throw new Error("Roteiro não está disponível para edição.");
    const nextIndex = working.scenes.findIndex(s => !s.action.trim() || !s.setting.trim());
    if (nextIndex < 0) return working;
    if (nextIndex % 4 !== 0)
      throw new Error("Projeto antigo com cenas parciais: conclua este bloco manualmente antes de gerar o seguinte.");
    if (working.scenes.slice(0, nextIndex).some(s => !s.action.trim() || !s.setting.trim()))
      throw new Error("Complete as cenas anteriores antes de continuar.");
    if (nextIndex > 0 && !working.characters.length)
      throw new Error("A ficha de personagens do primeiro bloco está incompleta.");
    const client = getSupabase(); if (!client) throw new Error("Supabase indisponível.");
    const startScene = nextIndex + 1;
    setSceneProgress("Gemini: gerando cenas " + startScene + " a " + (startScene + 3) + " de 12...");
    const result = await invokeStory("script_block", {
      title: working.title, synopsis: synopsisOverride ?? activeTopic?.synopsis ?? publishDescription,
      genre: working.genre || activeTopic?.genre || "geral",
      characterStyle: working.character_style || "nao_definido", startScene,
      characters: working.characters,
      previousScenes: working.scenes.slice(0, nextIndex),
    }) as { characters: Character[]; scenes: Scene[] };
    if (!Array.isArray(result.characters) || result.characters.length < 1 ||
      !Array.isArray(result.scenes) || result.scenes.length !== 4 ||
      result.scenes.some((scene,i) => scene.number !== startScene + i || !scene.action?.trim() || !scene.setting?.trim()))
      throw new Error("O Gemini não retornou quatro cenas válidas.");
    const scenes = working.scenes.map((scene, i) =>
      i >= nextIndex && i < nextIndex + 4 ? result.scenes[i - nextIndex] : scene);
    const characters = working.characters.length ? working.characters : result.characters;
    const { error: saveError } = await client.from("mv_story_projects")
      .update({ characters, scenes, updated_at: new Date().toISOString() })
      .eq("id", working.id).eq("user_id", user.id);
    if (saveError) throw new Error("As cenas foram geradas, mas não foram salvas. Verifique o projeto antes de repetir.");
    const updated = { ...working, scenes, characters };
    setProject(updated); setExpandedScene(startScene); setSceneWorkbenchStep("roteiro");
    setMessage("Cenas " + startScene + "–" + (startScene + 3) + " salvas. " +
      (startScene === 9 ? "Roteiro completo; revise e aprove." : "Próximo bloco disponível."));
    return updated;
  }
  async function generateRemainingBlocks(working: Project): Promise<Project> {
    let current = working;
    while (current.scenes.some(s => !s.action.trim() || !s.setting.trim()) && !stopSceneQueue.current) {
      current = await generateOneBlock(current);
      if (!current.scenes.some(s => !s.action.trim() || !s.setting.trim()) || stopSceneQueue.current) break;
      setSceneProgress("Bloco salvo. Intervalo de segurança antes do próximo...");
      await new Promise(resolve => setTimeout(resolve, 16_000));
    }
    return current;
  }
  async function generateNextScene() {
    if (!project || !user || project.status !== "draft" || busy) return;
    setBusy(true); setError(""); setSceneProgress("");
    try { await generateOneBlock(project); void loadProjects(); }
    catch (e) { setError(plainError(e)); }
    finally { setBusy(false); setSceneProgress(""); }
  }
  async function generateRemainingScenes() {
    if (!project || !user || project.status !== "draft" || busy) return;
    stopSceneQueue.current = false;
    setBusy(true); setError(""); setSceneProgress("");
    try { await generateRemainingBlocks(project); void loadProjects(); }
    catch (e) { setError(plainError(e)); void loadProjects(); }
    finally { setBusy(false); setSceneProgress(""); stopSceneQueue.current = false; }
  }
  async function createManualScript(title: string, topic?: Topic) {
    if (!user || title.trim().length < 3) return setError("Digite um título com pelo menos 3 caracteres.");
    if (!topic && !characterStyle) return setError("Escolha o tipo de personagem antes de criar a história.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const scenes = makeEmptyStoryScenes();
      const characters = selectedCastForStyle(topic?.character_style || characterStyle || "nao_definido");
      const { data, error: dbError } = await client.from("mv_story_projects").insert({
        user_id: user.id, ...(topic ? { topic_id: topic.id } : {}), title: title.trim(),
        genre: topic?.genre || genre, character_style: topic?.character_style || characterStyle, characters, scenes, status: "draft",
      }).select("id,user_id,title,status,character_style,characters,scenes").single();
      if (dbError || !data) throw new Error("Não foi possível criar o roteiro manual.");
      setSceneDialogueDrafts({}); setCharacterNameDrafts({}); setImageNames({}); setImagePrompts({});
      setActiveTopic(topic || null); setProject(data as Project); setPrompts([]); setClips([]); setExpandedScene(1); setSceneWorkbenchStep("roteiro");
      setPublishTitle(title.trim()); setPublishDescription(topic?.synopsis || ""); setStage("roteiro");
      setMessage("Rascunho manual criado com 12 cenas vazias. Preencha e aprove antes de gerar prompts.");
      void loadProjects();
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  async function previewLocalPrompts() {
    if (!project || !user || project.status === "draft" || busy) return;
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (project.scenes.length !== 12 || project.scenes.some(scene => !scene.action.trim() || !scene.setting.trim()))
        throw new Error("Aprove primeiro o roteiro completo com as 12 cenas.");
      // Build and validate all prompts BEFORE inserting anything into the database.
      const drafts = makeLocalPromptDrafts(platform, project.characters, project.scenes, project.character_style || "nao_definido");
      if (drafts.length !== 12 || drafts.some((p, i) => p.scene !== i + 1 || !p.text.trim() ||
          countStoryPromptCharacters(p.text) > PLATFORM_GUIDES[platform].absoluteChars)) {
        throw new Error("O motor interno não produziu 12 prompts válidos para esta plataforma.");
      }
      const { data: saved, error: readError } = await client.from("mv_story_prompts")
        .select("scene_number,prompt,platform").eq("project_id", project.id).eq("user_id", user.id).eq("platform", platform);
      if (readError) throw new Error("Falha ao consultar prompts anteriores. Nada foi sobrescrito.");
      const previous = new Set((saved || []).map(item => item.scene_number as number));
      const pending = drafts.filter(item => !previous.has(item.scene));
      if (pending.length) {
        const { error: saveError } = await client.from("mv_story_prompts").upsert(pending.map(item => ({
          user_id: user.id, project_id: project.id, scene_number: item.scene, platform, prompt: item.text,
        })), { onConflict: "project_id,scene_number,platform", ignoreDuplicates: true });
        if (saveError) throw new Error("Falha ao salvar os prompts locais. Verifique o banco antes de repetir.");
      }
      await loadPlatformPrompts(platform);
      setStage("prompts");
      const flagged = drafts.filter(item => item.notice?.includes("Explique se o personagem") ||
        item.notice?.includes("Confira a ordem das falas")).map(item => item.scene);
      setMessage(pending.length + " prompts novos criados sem IA. " +
        (previous.size ? "Prompts já salvos preservados. " : "") +
        (flagged.length ? "Revise movimento ou falas nas cenas " + flagged.join(", ") + "." : "Confira os prompts antes de produzir os vídeos."));
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  function downloadProductionPlan() {
    if (!project) return;
    const data = { format: "Plano editorial — nenhum vídeo gerado",
      title: project.title, aspectRatio: "9:16", targetSeconds: 120,
      characterStyle: project.character_style || "nao_definido",
      generator: platform, characters: project.characters.map(({ referenceImagePath, ...rest }) => ({
        ...rest, referenceImage: referenceImagePath ? "Referência privada vinculada" : "Não enviada",
      })), scenes: project.scenes,
      prompts: prompts.map(({ scene, platform, text }) => ({ scene, platform, text })),
      clips: project.scenes.map(scene => ({ scene: scene.number,
        status: clips.find(clip => clip.scene_number === scene.number)?.approved ? "approved" :
          clips.some(clip => clip.scene_number === scene.number) ? "uploaded" : "missing" })),
      publication: { destination, title: publishTitle, description: publishDescription },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "historia-" + project.id.slice(0, 8) + "-planejamento.json";
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  function syncDialogueSpeakerDrafts(projectId: string, previousName: string, nextName: string) {
    if (previousName === nextName) return;
    setSceneDialogueDrafts(old => Object.fromEntries(Object.entries(old).map(([key, raw]) => {
      if (!key.startsWith(projectId + ":")) return [key, raw];
      return [key, raw.split("\n").map(line => {
        const colon = line.indexOf(":");
        if (colon < 0 || line.slice(0, colon).trim() !== previousName) return line;
        return nextName + line.slice(colon);
      }).join("\n")];
    })));
  }
  function updateCharacter(index: number, changes: Partial<Character>) {
    if (!project || project.status !== "draft") return;
    setProject(previous => previous && previous.status === "draft"
      ? { ...previous, characters: previous.characters.map((char, i) => i === index ? { ...char, ...changes } : char) }
      : previous);
  }
  function applyCharacterName(index: number) {
    if (!project || project.status !== "draft") return;
    const key = project.id + ":" + index;
    const draft = characterNameDrafts[key];
    if (draft === undefined) return;
    const nextName = draft.trim();
    if (!nextName || nextName.length > 100) return setError("O nome do personagem precisa ter de 1 a 100 caracteres.");
    if (project.characters.some((ch, i) => i !== index && ch.name.toLowerCase() === nextName.toLowerCase()))
      return setError("Já existe outro personagem com esse nome.");
    const previousName = project.characters[index].name;
    syncDialogueSpeakerDrafts(project.id, previousName, nextName);
    setProject(previous => previous && previous.status === "draft" ? {
      ...previous,
      characters: previous.characters.map((char, i) => i === index ? { ...char, name: nextName } : char),
      scenes: previous.scenes.map(scene => ({
        ...scene,
        characters: scene.characters.map(name => name === previousName ? nextName : name),
        dialogue: scene.dialogue.map(line => line.speaker === previousName ? { ...line, speaker: nextName } : line),
      })),
    } : previous);
    setCharacterNameDrafts(old => { const next = { ...old }; delete next[key]; return next; });
    setError("");
  }
  function updateScene(index: number, changes: Partial<Scene>) {
    if (!project || project.status !== "draft") return;
    setProject({ ...project, scenes: project.scenes.map((scene, i) => i === index ? { ...scene, ...changes } : scene) });
  }
  async function saveScript(approve: boolean) {
    if (!project || !user) return;
    let working = project;
    const draftKeys = Object.keys(characterNameDrafts).filter(key => key.startsWith(project.id + ":"));
    for (const key of draftKeys) {
      const index = Number(key.slice(project.id.length + 1));
      if (!Number.isInteger(index) || !working.characters[index]) continue;
      const nextName = characterNameDrafts[key].trim();
      if (!nextName || nextName.length > 100) return setError("O nome do personagem precisa ter de 1 a 100 caracteres.");
      if (working.characters.some((ch, i) => i !== index && ch.name.toLowerCase() === nextName.toLowerCase()))
        return setError("Já existe outro personagem com esse nome.");
      const previousName = working.characters[index].name;
      working = {
        ...working,
        characters: working.characters.map((ch, i) => i === index ? { ...ch, name: nextName } : ch),
        scenes: working.scenes.map(scene => ({
          ...scene,
          characters: scene.characters.map(name => name === previousName ? nextName : name),
          dialogue: scene.dialogue.map(line => line.speaker === previousName ? { ...line, speaker: nextName } : line),
        })),
      };
    }
    for (const scene of working.scenes) {
      const dialogueIssue = invalidDialogueMessage(scene.number);
      if (dialogueIssue) return setError(dialogueIssue);
    }
    if (working.scenes.length !== 12 || working.scenes.some((s, i) => s.number !== i + 1))
      return setError("A numeração das 12 cenas precisa estar correta.");
    if (approve && working.scenes.some(s => !s.action.trim() || !s.setting.trim()))
      return setError("Para aprovar o roteiro completo, todas as 12 cenas precisam de ação e cenário.");
    const characterNames = new Set(working.characters.map(ch => ch.name.toLowerCase()));
    if (working.characters.some(ch => !ch.name.trim() || !ch.role.trim() || !ch.visual.trim() || !ch.voice.trim()))
      return setError("Preencha nome, função, aparência e voz de todos os personagens.");
    // Empty future scenes are deliberately ignored while saving an incremental draft.
    if (working.scenes.filter(s => s.action.trim() || s.setting.trim()).some(s =>
      s.characters.some(ch => !characterNames.has(ch.toLowerCase())) ||
      s.dialogue.some(d => d.speaker.toLowerCase() !== "narrador" && !characterNames.has(d.speaker.toLowerCase()))))
      return setError("Um personagem mencionado em uma cena preenchida não existe na Bíblia de Personagens.");
    if (working.scenes.some(s => s.dialogue.reduce((n, d) => n + d.text.trim().split(/\s+/).filter(Boolean).length, 0) > 26))
      return setError("Uma das cenas ultrapassa 26 palavras de fala. Reduza a fala para caber nos 10 segundos.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const { error: dbError } = await client.from("mv_story_projects")
        .update({ scenes: working.scenes, characters: working.characters, status: approve ? "approved" : "draft",
          approved_at: approve ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", working.id).eq("user_id", user.id);
      if (dbError) throw new Error("Não foi possível salvar o roteiro.");
      setProject({ ...working, status: approve ? "approved" : "draft" });
      if (draftKeys.length) {
        const before = project.characters;
        for (const [i, character] of before.entries()) {
          const changed = working.characters[i]?.name;
          if (changed && changed !== character.name) syncDialogueSpeakerDrafts(project.id, character.name, changed);
        }
        setCharacterNameDrafts(old => { const next = { ...old }; for (const key of draftKeys) delete next[key]; return next; });
      }
      if (approve) setStage("gerador");
      void loadProjects();
      setMessage(approve ? "Roteiro aprovado. Você já pode gerar os prompts." : "Rascunho salvo.");
      setPrompts([]);
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  async function generatePrompts() {
    if (!project || project.status === "draft" || !user || busy) return;
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError(""); setSceneProgress("Verificando os prompts já salvos...");
    try {
      const { data: saved, error: readError } = await client.from("mv_story_prompts")
        .select("scene_number,prompt,platform").eq("project_id", project.id).eq("user_id", user.id).eq("platform", platform);
      if (readError) throw new Error("Não foi possível consultar os prompts salvos.");
      const existing = new Set((saved || []).map(p => p.scene_number as number));
      if (existing.size === 12) {
        setMessage("Os 12 prompts desta plataforma já estão salvos. Nenhum token foi consumido.");
        await loadPlatformPrompts(platform);
        return;
      }
      if (project.scenes.length !== 12 || project.scenes.some(s => !s.action?.trim() || !s.setting?.trim())) {
        throw new Error("Aprove primeiro um roteiro completo de 12 cenas.");
      }
      setSceneProgress("Gerando 12 prompts de " + platform + " em uma solicitação...");
      const result = await invokeStory("prompts", {
        platform, characterStyle: project.character_style || "nao_definido",
        script: { characters: project.characters, scenes: project.scenes },
      }) as { prompts: Prompt[] };
      if (!Array.isArray(result.prompts) || result.prompts.length !== 12 ||
          result.prompts.some((p,i) => p.scene !== i + 1 || p.platform !== platform || !p.text?.trim()))
        throw new Error("O Gemini não retornou os 12 prompts válidos.");
      const pending = result.prompts.filter(p => !existing.has(p.scene));
      if (!pending.length) return;
      const { error: dbError } = await client.from("mv_story_prompts").upsert(pending.map(p => ({
        user_id: user.id, project_id: project.id, scene_number: p.scene, platform, prompt: p.text,
      })), { onConflict: "project_id,scene_number,platform" });
      if (dbError) throw new Error("Os prompts foram gerados, mas não foram salvos. Confira o banco antes de repetir.");
      await loadPlatformPrompts(platform);
      setStage("prompts");
      setMessage(pending.length + " prompts novos salvos. Prompts anteriores foram preservados.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); setSceneProgress(""); }
  }
  async function loadPlatformPrompts(selected: Platform) {
    if (!user || !project) return;
    const client = getSupabase(); if (!client) return;
    const { data, error: dbError } = await client.from("mv_story_prompts")
      .select("scene_number,prompt,platform").eq("user_id", user.id).eq("project_id", project.id)
      .eq("platform", selected).order("scene_number");
    if (dbError) { setError("Não foi possível carregar os prompts salvos."); return; }
    setPrompts((data || []).map(p => ({ scene: p.scene_number as number, text: p.prompt as string, platform: p.platform as Platform })));
  }
  async function saveEditedPrompt(scene: number) {
    if (!user || !project) return;
    const current = prompts.find(p => p.scene === scene && p.platform === platform);
    if (!current || !current.text.trim()) return setError("O prompt não pode ficar vazio.");
    const maximum = platformOptions.find(p => p.value === platform)?.maximum;
    if (maximum && countStoryPromptCharacters(current.text) > maximum) return setError("O prompt excede o limite desta plataforma.");
    const client = getSupabase(); if (!client) return;
    const { error: dbError } = await client.from("mv_story_prompts").upsert({
      user_id: user.id, project_id: project.id, scene_number: scene, platform, prompt: current.text.trim(),
    }, { onConflict: "project_id,scene_number,platform" });
    if (dbError) return setError("Não foi possível salvar a versão editada.");
    setMessage("Prompt da cena " + scene + " salvo.");
  }
  async function approveClip(sceneNumber: number, approved: boolean) {
    if (!user || !project) return;
    const clip = clips.find(c => c.scene_number === sceneNumber); if (!clip) return;
    const client = getSupabase(); if (!client) return;
    const { error: dbError } = await client.from("mv_story_clips").update({ approved })
      .eq("id", clip.id).eq("project_id", project.id).eq("user_id", user.id);
    if (dbError) return setError("Não foi possível atualizar a aprovação do clipe.");
    setClips(old => old.map(c => c.id === clip.id ? { ...c, approved } : c));
  }
  async function previewClip(sceneNumber: number) {
    const clip = clips.find(c => c.scene_number === sceneNumber);
    const client = getSupabase(); if (!clip || !client) return;
    const { data, error: storageError } = await client.storage.from("mv-story-clips")
      .createSignedUrl(clip.storage_path, 90);
    if (storageError || !data?.signedUrl) return setError("Não foi possível abrir este clipe privado.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function uploadClip(sceneNumber: number, file?: File) {
    if (!file || !user || !project) return;
    if (file.type !== "video/mp4" || file.size > 100 * 1024 * 1024) return setError("Use um MP4 com até 100 MB.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const path = user.id + "/" + project.id + "/scene-" + sceneNumber + "-" + crypto.randomUUID() + ".mp4";
      const { error: storageError } = await client.storage.from("mv-story-clips").upload(path, file, { contentType: "video/mp4", upsert: false });
      if (storageError) throw new Error("Falha ao enviar o MP4 para o armazenamento privado.");
      const { data, error: dbError } = await client.from("mv_story_clips")
        .upsert({ user_id: user.id, project_id: project.id, scene_number: sceneNumber, storage_path: path, approved: false },
          { onConflict: "project_id,scene_number" }).select("*").single();
      if (dbError || !data) throw new Error("O vídeo foi enviado, mas não foi possível vinculá-lo à cena.");
      setClips(old => [...old.filter(c => c.scene_number !== sceneNumber), data as Clip]);
      setMessage("MP4 da cena " + sceneNumber + " salvo. A montagem final ainda não está habilitada.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  const visibleTopics = topics.filter(t => user && t.user_id === user.id && (!onlySaved || t.saved) &&
    (!subjectFilter || t.subject === subjectFilter) && (genreFilter === "geral" || t.genre === genreFilter) &&
    (characterStyleFilter === "todos" || (t.character_style || "nao_definido") === characterStyleFilter) &&
    (!query || (t.title + " " + t.subject).toLowerCase().includes(query.toLowerCase())));
  const selectedVisibleCount = visibleTopics.filter(topic => selectedTopicIds.includes(topic.id)).length;
  const allVisibleSelected = visibleTopics.length > 0 && selectedVisibleCount === visibleTopics.length;
  const subjects = Array.from(new Set(topics.filter(t => user && t.user_id === user.id).map(t => t.subject))).sort();
  const maxPrompt = platformOptions.find(p => p.value === platform)?.maximum;

  const currentStage = STORY_STAGES.findIndex(item => item.key === stage);
  const approvedCount = clips.filter(clip => clip.approved).length;
  return <div className="space-y-6">
    {stage !== "temas" && stage !== "roteiro" && <details className="rounded-lg border border-border p-2">
      <summary className="cursor-pointer text-xs font-semibold">Etapas do projeto</summary>
      <nav aria-label="Etapas do gerador de histórias" className="mt-2 flex flex-wrap gap-2">
        {STORY_STAGES.map(item => <button type="button" key={item.key}
          aria-current={stage === item.key ? "step" : undefined}
          onClick={() => { setStage(item.key); setError(""); }}
          className={"rounded-lg border px-3 py-1.5 text-xs " +
            (stage === item.key ? "border-primary bg-primary/10 font-semibold" : "border-border bg-surface")}>
          {item.title}
        </button>)}
      </nav>
    </details>}
    <section className={panel} hidden={stage !== "temas"}>
      <h2 className="text-lg font-semibold">Temas</h2>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Tipo de personagem</legend>
        <div className="grid grid-cols-3 gap-2">
          {STORY_CHARACTER_STYLES.map(option => <button key={option.value} type="button"
            aria-pressed={characterStyle === option.value}
            aria-label={"Tipo de personagem: " + option.label}
            title={option.label}
            className={"overflow-hidden rounded-xl border text-center transition-colors " +
              (characterStyle === option.value ? "border-primary ring-2 ring-primary/40 bg-primary/10" : "border-border bg-surface")}
            onClick={() => setCharacterStyle(option.value)}>
            <img src={option.value === "frutinhas" ? "/stories/styles/frutinhas.svg" :
              option.value === "infantil" ? "/stories/styles/infantil.svg" :
              "/stories/styles/pessoas-cabeca-fruta.svg"} alt="" aria-hidden="true"
              className="aspect-[4/3] w-full object-cover"/>
          </button>)}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">Tema
        <input className={field + " mt-1"} value={subject} maxLength={160} onChange={e => setSubject(e.target.value)}
          placeholder="Ex.: manutenção de fábrica" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Gênero
          <select className={field + " mt-1"} value={genre} onChange={e => setGenre(e.target.value as Genre)}>
            {genres.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Quantidade
          <select className={field + " mt-1"} value={requested} onChange={e => setRequested(Number(e.target.value))}>
            {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} temas</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy || !user || !characterStyle || subject.trim().length < 2} onClick={() => void generateTopics()}>
          {busy ? "Gerando..." : "Gerar temas com Gemini"}
        </button>
        {busy && <span className="text-sm" role="status">{progress}/{requested} temas novos</span>}
        {error && <p role="alert" className="w-full rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="w-full rounded-xl border border-border p-3 text-sm">{message}</p>}
      </div>
      {!user && <p className="text-sm text-muted">Entre em Conta e conexões para salvar seu catálogo privado.</p>}
    </section>

    <section className={panel} hidden={stage !== "temas" || draftTopics.length === 0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">2. Temas gerados — revisão ({draftTopics.length})</h2>
        <button className={button} disabled={!draftTopics.length || !!savingTopic || busy}
          onClick={() => void saveDraftTopics(draftTopics)}>Salvar todos os temas</button>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
        {draftTopics.map(t => <article key={t.localId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={t.title}>{t.title}</p>
          <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || !!savingTopic}
            onClick={() => void saveDraftTopics([t])}>Salvar</button>
          <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || !!savingTopic}
            onClick={() => setDraftTopics(previous => previous.filter(item => item.localId !== t.localId))}>Descartar</button>
        </article>)}
        {!draftTopics.length && <p className="text-sm text-muted">Os temas gerados aparecerão aqui antes de serem salvos.</p>}
      </div>
    </section>
    <section className={panel} hidden={stage !== "temas"}>
      <h2 className="text-sm font-semibold">Personagens da história</h2>
      <p className="text-xs text-muted">Selecione de 1 a 4 personagens da sua biblioteca antes de gerar um roteiro. Seus nomes, aparência, imagem e prompt serão preservados nas 12 cenas.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Escolher personagens salvos para o roteiro">
        {characterLibrary.filter(entry => !characterStyle || entry.storage_path.includes("/library/" + characterStyle + "/")).map(entry => {
          const chosen = selectedCastIds.includes(entry.id);
          const thumb = libraryImageUrls[entry.storage_path];
          return <button type="button" key={entry.id} aria-pressed={chosen}
            disabled={busy || (!chosen && selectedCastIds.length >= 4)}
            className={"rounded-xl border-2 p-2 text-left text-xs " + (chosen ? "border-primary bg-primary/10" : "border-border")}
            onClick={() => toggleCastMember(entry.id)}>
            {thumb ? <img src={thumb} alt={entry.name} className="mb-2 aspect-square w-full rounded-lg object-cover"/> :
              <div className="mb-2 aspect-square rounded-lg bg-surface-secondary"/>}
            <span className="block truncate font-semibold">{castDisplayName(entry.name)}</span>
            <span className="text-muted">{chosen ? "Selecionado" : "Selecionar"}</span>
          </button>;
        })}
        {!characterLibrary.length && <p className="col-span-2 text-xs text-muted">Nenhuma imagem de personagem salva. Cadastre personagens na biblioteca antes de gerar um roteiro.</p>}
      </div>
      <p className="text-xs text-muted">{selectedCastIds.length}/4 selecionados</p>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">Cadastrar personagem com imagem e prompt próprios</summary>
        <div className="space-y-2 pt-3">
          <label className="block text-xs">Nome do personagem
            <input className={field + " mt-1"} maxLength={100} value={newCastName}
              placeholder="Ex.: Limão Eletricista" onChange={e => setNewCastName(e.target.value)}/>
          </label>
          <label className="block text-xs">Descrição visual e prompt do personagem
            <textarea className={field + " mt-1"} rows={3} maxLength={1200} value={newCastDescription}
              placeholder="Aparência, roupas, acessórios, estilo e personalidade"
              onChange={e => setNewCastDescription(e.target.value)}/>
          </label>
          <label className="block text-xs">Imagem de referência (PNG, JPG ou WebP)
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
              className="mt-1 block w-full text-xs"
              onChange={e => setNewCastFile(e.currentTarget.files?.[0] || null)}/>
          </label>
          <button type="button" className={button} disabled={busy || !characterStyle || !newCastFile}
            onClick={() => void savePreScriptCharacter()}>Salvar personagem</button>
        </div>
      </details>
    </section>
    <section hidden={stage !== "temas"}>
      <details className="rounded-xl border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-semibold">Filtrar e ver temas salvos ({topics.length})</summary>
        <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">{visibleTopics.length} exibidos</span>
          <button className={button + " !text-xs"} disabled={deletingTopics || busy || selectedVisibleCount === 0}
            onClick={() => void deleteSelectedTopics()}>Excluir selecionados ({selectedVisibleCount})</button>
        </div>
      <div className="flex flex-wrap gap-2">
        <input className={field + " min-w-36 flex-1"} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar tema" aria-label="Buscar temas por título ou assunto"/>
        <select className={field + " max-w-44"} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} aria-label="Filtrar por assunto">
          <option value="">Todos os assuntos</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <details className="rounded-lg border border-border px-2 py-2 text-xs">
          <summary className="cursor-pointer">Filtros</summary>
          <div className="space-y-2 pt-2">
            <select className={field} value={genreFilter} onChange={e => setGenreFilter(e.target.value as Genre)} aria-label="Filtrar por gênero">
              {genres.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <select className={field} value={characterStyleFilter}
              onChange={e => setCharacterStyleFilter(e.target.value as StoryCharacterStyle | "todos")}
              aria-label="Filtrar por tipo de personagem">
              <option value="todos">Todos os estilos</option>
              <option value="nao_definido">Sem estilo (antigos)</option>
              {STORY_CHARACTER_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
            </select>
            <label className="flex items-center gap-2"><input type="checkbox" checked={onlySaved}
              onChange={e => setOnlySaved(e.target.checked)}/> Somente favoritos</label>
          </div>
        </details>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allVisibleSelected} disabled={!visibleTopics.length || deletingTopics || busy}
          onChange={e => {
            const checked = e.target.checked;
            const visibleIds = new Set(visibleTopics.map(topic => topic.id));
            setSelectedTopicIds(current => checked
              ? [...new Set([...current, ...visibleIds])]
              : current.filter(id => !visibleIds.has(id)));
          }}/>
        Selecionar todos os temas exibidos ({visibleTopics.length})
      </label>
      <div className="max-h-96 space-y-1 overflow-y-auto">
        {visibleTopics.map(t => <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <input type="checkbox" checked={selectedTopicIds.includes(t.id)} disabled={deletingTopics || busy}
            aria-label={"Selecionar " + t.title} onChange={() => toggleTopicSelection(t.id)}/>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={t.title}>{t.title}</p>
          <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || deletingTopics}
            onClick={() => void generateScript(t)}>Roteiro</button>
          <details className="shrink-0 text-xs">
            <summary className="cursor-pointer px-1 py-1" aria-label={"Mais opções de " + t.title}>Mais</summary>
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted">{STORY_CHARACTER_STYLES.find(s => s.value === t.character_style)?.label || "Estilo não definido"}</p>
              <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || deletingTopics}
                onClick={() => void toggleSaved(t)}>{t.saved ? "Remover favorito" : "Favoritar"}</button>
              <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || deletingTopics}
                onClick={() => void createManualScript(t.title, t)}>Roteiro manual</button>
              <button className={button + " !px-2 !py-1 !text-xs"} disabled={busy || deletingTopics}
                onClick={() => {
                  if (window.confirm("Criar uma nova versão do roteiro? Isso gera um roteiro completo com Gemini em até três chamadas gratuitas. O roteiro anterior continuará salvo.")) {
                    void generateScript(t, true);
                  }
                }}>Nova versão (Gemini)</button>
            </div>
          </details>
        </div>)}
        {!visibleTopics.length && <p className="text-sm text-muted">Nenhum tema encontrado.</p>}
      </div>

        </div>
      </details>
    </section>

    <section className={panel} hidden={stage !== "roteiro"}>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Projetos salvos ({projects.length}) · abrir histórico de roteiros</summary>
        <p className="text-xs text-muted pt-2">Retome um roteiro após fechar o navegador.</p>
      <div className="flex flex-wrap gap-2 pt-3">
        {projects.filter(p => user && p.user_id === user.id).map(p => <button key={p.id} className={button} disabled={busy} onClick={() => void openProject(p)}>
          {p.title} · {p.status}
        </button>)}
        {!projects.length && <p className="text-sm text-muted">Ainda não há histórias salvas.</p>}
      </div>
      </details>
    </section>

    {stage === "roteiro" && !project && <section className={panel}>
      <h2 className="font-semibold">Roteiro ainda não iniciado</h2>
      <p className="text-sm text-muted">Na etapa Temas, selecione Roteiro ou Roteiro manual para abrir um editor com 12 cenas.</p>
      <button className={button} onClick={() => setStage("temas")}>Voltar aos temas</button>
    </section>}
    {stage === "roteiro" && project && user && project.user_id === user.id && <section className={panel}>
      {sceneWorkbenchStep !== "prompt" && <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">{activeTopic?.title || project.title}</h2>
          <p className="text-xs text-muted">Cena {expandedScene}/12 · 10s por cena · {project.scenes.filter(s => s.action.trim() && s.setting.trim()).length} prontas</p>
        </div>
        <button type="button" className={button + " shrink-0 !px-2 !py-1 !text-xs"} onClick={() => setStage("temas")}>Temas</button>
      </div>}
      {sceneWorkbenchStep !== "prompt" && project.status === "draft" && project.scenes.some(s => !s.action.trim() || !s.setting.trim()) &&
        <div className="flex flex-wrap items-center gap-2">
          <button className={button + " !px-3 !py-1.5"} disabled={busy}
            onClick={() => {
              if (project.scenes.every(s => !s.action.trim() && !s.setting.trim())) {
                void resumeFullScript();
              } else if (window.confirm("Este projeto possui cenas parciais. Gerar os blocos restantes com Gemini? Cada bloco de quatro cenas utiliza uma chamada.")) {
                void generateRemainingScenes();
              }
            }}>{project.scenes.every(s => !s.action.trim() && !s.setting.trim()) ? "Gerar roteiro completo · Gemini" : "Gerar blocos restantes"}</button>
          {busy && sceneProgress && <button className={button + " !px-3 !py-1.5"}
            onClick={() => { stopSceneQueue.current = true; }}>Parar após esta cena</button>}
          <span className="text-xs text-muted">Recuperação de projetos antigos com cenas parciais. O roteiro novo é gerado em até três blocos de quatro cenas; cada bloco é salvo antes do próximo.</span>
        </div>}
      {error && <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-border p-2 text-xs">{message}</p>}
      {sceneWorkbenchStep !== "prompt" && <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary" aria-label="Progresso das cenas geradas">
        <div className="h-full rounded-full bg-primary" style={{ width: project.scenes.filter(s => s.action.trim() && s.setting.trim()).length / 12 * 100 + "%" }}/>
      </div>}
      {sceneWorkbenchStep !== "prompt" && <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Cenas prontas para produzir">
        {project.scenes.filter(s => (s.action.trim() && s.setting.trim()) || s.number === expandedScene).map(s =>
          <button key={s.number} type="button" aria-current={expandedScene === s.number ? "step" : undefined}
            className={"shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors " +
              (expandedScene === s.number ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-secondary")}
            onClick={() => selectWorkbenchScene(s.number)}>
            Cena {s.number} {s.action.trim() && s.setting.trim() ? "✓" : "· pendente"}
          </button>)}
      </nav>}
      {sceneWorkbenchStep !== "prompt" && <div className="rounded-2xl border border-border bg-surface-secondary/30 p-3 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Etapas da cena selecionada">
          {([
            ["roteiro", "1 · Revisar roteiro"],
            ["personagens", "2 · Personagens e imagens"],
            ["prompt", "3 · Prompt e download"],
          ] as const).map(([step,label]) =>
            <button key={step} type="button" aria-pressed={sceneWorkbenchStep === step}
              className={"rounded-xl px-3 py-2 text-sm font-semibold transition-colors " +
                (sceneWorkbenchStep === step ? "bg-primary text-primary-foreground" : "border border-border bg-surface hover:bg-surface-secondary")}
              onClick={() => setSceneWorkbenchStep(step)}>{label}</button>)}
        </div>
        {sceneWorkbenchStep === "roteiro" && project.status === "draft" && <details className="rounded-xl border border-border p-2">
          <summary className="cursor-pointer text-xs font-semibold">Opções avançadas de geração (manual, pode consumir cota)</summary>
          <div className="flex flex-wrap gap-2 pt-3">
            <span className="text-xs text-muted">A geração de cenas restantes está disponível no topo do quadro.</span>
          </div>
          <p className="text-xs text-muted pt-2">Quatro cenas por chamada, sem retentativa após erro. Se a IA falhar, você pode editar manualmente. Nenhuma chave de temas é reutilizada.</p>
        </details>}
        {busy && sceneProgress && <p role="status" className="rounded-xl border border-border p-2 text-sm">{sceneProgress}</p>}
      </div>}
      {sceneWorkbenchStep === "personagens" && <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Imagens dos personagens</h3>
          <button className={button + " !text-xs !px-2 !py-1"} disabled={busy} onClick={() => void loadCharacterLibrary()}>Atualizar</button></div>
        {project.scenes.filter(scene => scene.number === expandedScene).map(scene => {
          const present = project.characters.map((character,index) => ({character,index}))
            .filter(({character}) => scene.characters.includes(character.name));
          return <div key={scene.number} className="space-y-3">
            <p className="text-xs text-muted">Cena {scene.number}: escolha a imagem de cada personagem pelo retrato.</p>
            {present.length === 0 && <p className="text-xs text-muted">Nenhum personagem indicado nesta cena. Revise os personagens no roteiro.</p>}
            {present.map(({character:char,index:ci}) => {
              const path = char.referenceImagePath;
              const url = path && (characterImageUrls[path] || libraryImageUrls[path]);
              const editing = editingCharacterIndex === ci;
              const adding = addingCharacterImageIndex === ci;
              return <div key={ci} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  {url ? <img src={url} alt={char.name} className="h-12 w-12 rounded-lg object-cover"/> : <div className="h-12 w-12 rounded-lg bg-surface-secondary"/>}
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{char.name}</p>
                    {path && <p className="text-xs text-muted">Imagem salva</p>}</div>
                </div>
                {project.status === "draft" && <div className="space-y-2">
                  <label className="block text-xs font-semibold">Como você quer este personagem?
                    <textarea className={field + " mt-1 min-h-24 resize-y"} rows={3} maxLength={1200}
                      placeholder={char.visual || "Descreva aparência, roupas, expressão e estilo visual"}
                      value={imagePrompts[ci] ?? ""}
                      onChange={e => setImagePrompts(old => ({ ...old, [ci]: e.target.value }))}/>
                  </label>
                  <button type="button" className={button + " !bg-primary !text-primary-foreground !border-primary"}
                    disabled={busy || !imageConfigured || !(imagePrompts[ci]?.trim() || char.visual.trim())}
                    onClick={() => void generateCharacterReference(ci)}>
                    {busy ? "Gerando imagem..." : "Gerar e salvar imagem"}
                  </button>
                  {!imageConfigured && <p className="text-xs text-muted">Geração pela API desativada para evitar cobrança: o Nano Banana não tem faixa gratuita na API. Você ainda pode enviar uma imagem criada no Google AI Studio em Outras opções.</p>}
                </div>}
                <details className="rounded-lg border border-border p-2">
                  <summary className="cursor-pointer text-xs font-semibold">Outras opções: imagens salvas, edição e envio manual</summary>
                  <div className="space-y-3 pt-3">
                    <a className="text-xs underline" href="https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-flash-lite-image"
                      target="_blank" rel="noopener noreferrer">Abrir Google AI Studio para criar imagem e importar depois</a>
                  {project.status === "draft" && <button type="button" className={button + " !px-2 !py-1 !text-xs"}
                    aria-expanded={editing} onClick={() => {setEditingCharacterIndex(editing ? null : ci);setAddingCharacterImageIndex(null);}}>
                    {editing ? "Fechar edição" : "Editar ficha"}
                  </button>}
                <div role="group" aria-label={"Escolher imagem para " + char.name} className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                  {characterLibrary.filter(entry => entry.storage_path.includes("/library/" + project.character_style + "/") ||
                    entry.storage_path === path).map(entry => {
                    const thumb = libraryImageUrls[entry.storage_path];
                    return <button key={entry.id} type="button" title={entry.name} aria-label={"Selecionar " + entry.name + " para " + char.name}
                      aria-pressed={path === entry.storage_path} disabled={busy || !thumb || project.status !== "draft"}
                      onClick={() => void chooseLibraryImage(ci,entry)}
                      className={"overflow-hidden rounded-lg border-2 p-1 text-left " +
                        (path === entry.storage_path ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
                      {thumb ? <img src={thumb} alt="" className="aspect-square w-full rounded object-cover"/> : <div className="aspect-square bg-surface-secondary"/>}
                      <span className="block truncate pt-1 text-[11px]">{entry.name}</span>
                    </button>;
                  })}
                  {project.status === "draft" && <button type="button"
                    className="rounded-lg border border-dashed border-primary p-2 text-xs font-semibold"
                    aria-expanded={adding} onClick={() => {setAddingCharacterImageIndex(adding ? null : ci);setEditingCharacterIndex(null);}}>＋ Nova imagem</button>}
                </div>
                {characterLibrary.every(entry => !entry.storage_path.includes("/library/" + project.character_style + "/")) &&
                  <p className="text-xs text-muted">Ainda não há imagens cadastradas para este tipo de personagem.</p>}
                {characterLibrary.some(entry => !entry.storage_path.includes("/library/" + project.character_style + "/") && entry.storage_path !== path) &&
                  <details className="rounded-lg border border-border p-2">
                    <summary className="cursor-pointer text-xs font-semibold">Ver imagens antigas ou de outros tipos</summary>
                    <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-5 lg:grid-cols-7">
                      {characterLibrary.filter(entry => !entry.storage_path.includes("/library/" + project.character_style + "/") &&
                        entry.storage_path !== path).map(entry => {
                        const thumb=libraryImageUrls[entry.storage_path];
                        return <button key={entry.id} type="button" disabled={busy || !thumb || project.status !== "draft"}
                          aria-label={"Selecionar imagem antiga " + entry.name + " para " + char.name}
                          onClick={() => void chooseLibraryImage(ci,entry)}
                          className="overflow-hidden rounded-lg border border-border p-1 text-left">
                          {thumb ? <img src={thumb} alt="" className="aspect-square w-full rounded object-cover"/> :
                            <div className="aspect-square bg-surface-secondary"/>}
                          <span className="block truncate pt-1 text-[11px]">{entry.name}</span>
                        </button>;
                      })}
                    </div>
                  </details>}
                {editing && project.status === "draft" && <div className="space-y-2 rounded-lg bg-surface-secondary p-3">
                  <p className="text-sm font-semibold">Editar ficha de {char.name}</p>
                  <label className="block text-xs">Nome<input className={field + " mt-1"} maxLength={100} value={characterNameDrafts[project.id + ":" + ci] ?? char.name}
                    onChange={e => setCharacterNameDrafts(old => ({ ...old, [project.id + ":" + ci]: e.target.value }))}
                    onBlur={() => applyCharacterName(ci)}/></label>
                  <label className="block text-xs">Função<input className={field + " mt-1"} maxLength={180} value={char.role}
                    onChange={e => updateCharacter(ci,{role:e.target.value})}/></label>
                  <label className="block text-xs">Aparência e roupas<textarea className={field + " mt-1"} rows={2} maxLength={1100} value={char.visual}
                    onChange={e => updateCharacter(ci,{visual:e.target.value})}/></label>
                  <label className="block text-xs">Voz<textarea className={field + " mt-1"} rows={2} maxLength={450} value={char.voice}
                    onChange={e => updateCharacter(ci,{voice:e.target.value})}/></label>
                  {path && <button className={button + " !text-xs"} onClick={() => void downloadReference(path,char.name)}>Baixar imagem</button>}
                  <button className={button + " !text-xs"} disabled={busy} onClick={() => void saveScript(false)}>Salvar alterações</button>
                </div>}
                {adding && project.status === "draft" && <div className="space-y-2 rounded-lg bg-surface-secondary p-3">
                  <p className="text-xs font-semibold">Enviar imagem existente de {char.name}</p>
                  <label className="block text-xs">Nome da imagem
                    <input className={field + " mt-1"} maxLength={100}
                      value={imageNames[ci] ?? ""} placeholder={char.name}
                      onChange={e => setImageNames(old => ({...old,[ci]:e.target.value}))}/>
                  </label>
                  <label className="block text-xs">Enviar foto (PNG, JPG ou WebP, até 10 MB)
                    <input type="file" className="mt-1 block w-full text-xs" accept="image/png,image/jpeg,image/webp" disabled={busy}
                      onChange={e => {const file=e.currentTarget.files?.[0];void uploadReference(ci,file);e.currentTarget.value="";}}/>
                  </label>
                </div>}
                  </div>
                </details>
              </div>;
            })}
          </div>;
        })}
        <details className="rounded-lg border border-border p-2">
          <summary className="cursor-pointer text-xs font-semibold">Gerenciar biblioteca e envio em lote</summary>
          <div className="space-y-2 pt-2">
            {project.status === "draft" && <label className="block text-xs">Adicionar várias imagens
              <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} className="block w-full"
                onChange={e => {const files=e.currentTarget.files;void uploadCharacterBatch(files);e.currentTarget.value="";}}/>
            </label>}
            <p className="text-xs text-muted">Imagens em lote serão associadas primeiro aos personagens sem referência.</p>
            {characterLibrary.map(entry => <div key={entry.id} className="space-y-1 border-b border-border py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate" title={entry.name}>{entry.name}</span>
                <button type="button" className={button + " !text-xs !px-2 !py-1"} disabled={busy}
                  onClick={() => { setRenamingLibraryId(entry.id); setLibraryNameDrafts(old => ({ ...old, [entry.id]: entry.name })); }}>Renomear</button>
              </div>
              {renamingLibraryId === entry.id && <div className="flex flex-wrap items-center gap-2">
                <input className={field + " min-w-0 flex-1"} aria-label={"Novo nome da imagem " + entry.name}
                  maxLength={100} value={libraryNameDrafts[entry.id] ?? entry.name}
                  onChange={e => setLibraryNameDrafts(old => ({ ...old, [entry.id]: e.target.value }))}/>
                <button type="button" className={button + " !text-xs !px-2 !py-1"} disabled={busy}
                  onClick={() => void renameLibraryCharacter(entry, libraryNameDrafts[entry.id] ?? entry.name)}>Salvar</button>
                <button type="button" className={button + " !text-xs !px-2 !py-1"} disabled={busy}
                  onClick={() => setRenamingLibraryId(null)}>Cancelar</button>
              </div>}
            </div>)}
          </div>
        </details>
        <div className="flex justify-end border-t border-border pt-3">
          <button className={button + " !bg-primary !text-primary-foreground !border-primary"}
            onClick={() => setSceneWorkbenchStep("prompt")}>Continuar: prompt e downloads</button>
        </div>
      </div>}
      {sceneWorkbenchStep !== "personagens" && <div className="space-y-2">
        {project.scenes.filter(s => s.number === expandedScene).map(s => {
          const i = s.number - 1;
          const filled = Boolean(s.setting.trim() && s.action.trim());
          const expanded = expandedScene === s.number;
          const chosenPlatform = selectedPlatformByScene[s.number] || platform;
          const scenePromptText = scenePromptDrafts[promptKey(s.number, chosenPlatform)] || "";
          return <div key={s.number} id={"story-scene-" + s.number}
            className="rounded-xl border border-border bg-surface overflow-hidden">
            {sceneWorkbenchStep === "prompt" ? <h3 className="px-3 py-3 text-sm font-semibold">Cena {s.number} · {s.title}</h3> : <>
            <button type="button" className="w-full px-3 py-2 text-left flex items-center justify-between gap-3"
              aria-expanded={expanded} aria-controls={"story-fields-" + s.number}
              onClick={() => setSceneWorkbenchStep("roteiro")}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Cena {s.number} · {s.title} · 10s</span>
                <span className="block truncate text-xs text-muted">
                  {filled ? s.action : "Cena ainda não gerada — aguardando Gemini ou edição manual"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted">{filled ? "Preenchida" : "Pendente"} · {expanded ? "Recolher" : "Abrir"}</span>
            </button>
            </>}
            {(expanded || sceneWorkbenchStep === "prompt") && <div id={"story-fields-" + s.number} className="border-t border-border px-3 py-3 grid gap-2 sm:grid-cols-2">
              {sceneWorkbenchStep === "roteiro" && <>
              <label className="text-xs font-semibold sm:col-span-2">Título
                <input className={field + " mt-1 py-1.5"} maxLength={160} value={s.title}
                  disabled={project.status !== "draft"} onChange={e => updateScene(i, { title: e.target.value })}/>
              </label>
              <label className="text-xs font-semibold">Cenário
                <textarea className={field + " mt-1 min-h-12 resize-y py-1.5"} rows={2}
                  value={s.setting} disabled={project.status !== "draft"}
                  onChange={e => updateScene(i, { setting: e.target.value })}/>
              </label>
              <label className="text-xs font-semibold">Ação
                <textarea className={field + " mt-1 min-h-12 resize-y py-1.5"} rows={2}
                  value={s.action} disabled={project.status !== "draft"}
                  onChange={e => updateScene(i, { action: e.target.value })}/>
              </label>
              <label className="text-xs font-semibold sm:col-span-2">Falas (Nome: texto)
                <textarea className={field + " mt-1 min-h-10 resize-y py-1.5"} rows={2}
                  value={sceneDialogueDrafts[project.id + ":" + s.number] ?? s.dialogue.map(d => d.speaker + ": " + d.text).join("\n")}
                  disabled={project.status !== "draft"}
                  onChange={e => {
                    const raw = e.target.value;
                    setSceneDialogueDrafts(old => ({ ...old, [project.id + ":" + s.number]: raw }));
                    // Keep the exact typed value in the textarea; update parsed scene data separately.
                    updateScene(i, { dialogue: parseStoryDialogueDraft(raw).dialogue });
                  }}/>
              </label>
              <label className="text-xs font-semibold">Personagens presentes
                <input className={field + " mt-1 py-1.5"} value={s.characters.join(", ")}
                  disabled={project.status !== "draft"}
                  onChange={e => updateScene(i, { characters: e.target.value.split(",").map(n => n.trim()).filter(Boolean) })}/>
              </label>
              <label className="text-xs font-semibold">Transição e ligação com a próxima cena
                <input className={field + " mt-1 py-1.5"} value={s.transition}
                  disabled={project.status !== "draft"} onChange={e => updateScene(i, { transition: e.target.value })}/>
              </label>
              <p className="text-xs text-muted sm:col-span-2">Fala: {countStoryWords(s)}/26 palavras · 10 segundos</p>
              {!filled && project.status === "draft" && <div className="flex flex-wrap items-center gap-2">
                <button className={button + " !bg-primary !text-primary-foreground !border-primary"} disabled={busy} onClick={() => void generateNextScene()}>Gerar bloco a partir da cena {s.number} · Gemini</button>

                <span className="text-xs text-muted">Se houver erro 503, o Google está indisponível. A cena anterior continua salva. Nenhuma tentativa automática é feita.</span>
              </div>}
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled={busy || project.status !== "draft"} onClick={() => void saveScript(false)}>Salvar roteiro desta cena</button>
                {filled && <button className={button + " !bg-primary !text-primary-foreground !border-primary"} onClick={() => setSceneWorkbenchStep("personagens")}>Continuar: personagens e imagens</button>}
              </div>
              </>}
              {sceneWorkbenchStep === "prompt" && !filled && <p className="sm:col-span-2 text-sm text-muted">Preencha e salve a cena antes de preparar o prompt.</p>}
              {filled && sceneWorkbenchStep === "prompt" && <div className="sm:col-span-2 rounded-xl border border-border p-3 space-y-3">
                <div className="flex flex-wrap gap-2" aria-label="Personagens desta cena">
                  {project.characters.filter(char => s.characters.includes(char.name)).map(char => {
                    const imagePath=char.referenceImagePath;
                    const url=imagePath && (characterImageUrls[imagePath] || libraryImageUrls[imagePath]);
                    return <div key={char.name} className="w-20 space-y-1 text-center">
                      {url ? <img src={url} alt={"Imagem de " + char.name} className="aspect-square w-full rounded-lg object-cover"/> :
                        <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">Sem foto</div>}
                      <p className="truncate text-xs font-medium" title={char.name}>{char.name}</p>
                    </div>;
                  })}
                </div>
                <div role="group" aria-label="Ferramenta para gerar o prompt" className="grid grid-cols-3 gap-2">
                  {platformOptions.map(item => <button type="button" key={item.value} disabled={busy}
                    aria-label={"Selecionar " + item.label} aria-pressed={chosenPlatform === item.value}
                    onClick={() => {setSelectedPlatformByScene(old => ({...old,[s.number]:item.value}));setCopiedScenePrompt(null);}}
                    className={"min-w-0 rounded-xl border-2 p-2 text-center " +
                      (chosenPlatform === item.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
                    <img src={"/stories/tools/" + item.value + ".svg"} alt="" className="mx-auto h-14 w-full rounded-lg object-contain"/>
                    <span className="block pt-1 text-xs font-semibold">{item.label}</span>
                  </button>)}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button className={button + " !bg-primary !text-primary-foreground !border-primary"} disabled={busy}
                    onClick={() => void prepareScenePrompt(s.number,false)}>Gerar prompt sem IA</button>
                  <button className={button} disabled={busy}
                    onClick={() => void prepareScenePrompt(s.number,true)}>Gerar prompt com Gemini</button>
                </div>
                {scenePromptText.trim() && <>
                <label className="block text-xs font-semibold">Prompt completo — cena {s.number}
                  <textarea className={field + " mt-1 resize-y"} rows={4} value={scenePromptText}
                    onChange={e => {
                      setScenePromptDrafts(old => ({ ...old, [promptKey(s.number, chosenPlatform)]: e.target.value }));
                      setCopiedScenePrompt(null);
                    }} placeholder="O prompt desta cena aparecerá aqui para revisão e download."/>
                </label>
                <p className={"text-xs font-semibold " + (countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars ? "text-red-600" : "text-muted")}>
                  {countStoryPromptCharacters(scenePromptText)}/{PLATFORM_GUIDES[chosenPlatform].absoluteChars} caracteres
                  {countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars ? " — acima do limite; refaça a versão compacta antes de copiar." : " — dentro do limite."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className={button} disabled={!scenePromptText.trim() || busy || countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars} onClick={() => void saveScenePrompt(s.number)}>Salvar prompt</button>
                  <button className={button} disabled={!scenePromptText.trim() || countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars}
                    onClick={() => downloadTextFile("cena-" + s.number + "-" + chosenPlatform + ".txt", scenePromptText)}>
                    Baixar prompt .txt
                  </button>
                  <button className={button} disabled={!scenePromptText.trim() || countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars}
                    onClick={() => void copyScenePrompt(s.number, chosenPlatform, scenePromptText)}>Copiar prompt</button>
                </div>
                {copiedScenePrompt === promptKey(s.number, chosenPlatform) && <p role="status" className="text-xs font-semibold text-green-700">Prompt copiado. Agora crie o vídeo na plataforma escolhida; depois avance para a próxima cena usando o botão abaixo.</p>}
                <div className="rounded-xl border border-border bg-surface-secondary/40 p-3 space-y-2">
                  <p className="text-xs font-semibold">Vídeo pronto na plataforma?</p>
                  <label className="block text-xs">Importar MP4 desta cena (opcional, até 100 MB)
                    <input className="mt-1 block w-full text-xs" type="file" accept="video/mp4" disabled={busy}
                      onChange={e => {
                        const file = e.currentTarget.files?.[0];
                        void uploadClip(s.number, file);
                        e.currentTarget.value = "";
                      }}/>
                  </label>
                  <p className="text-xs text-muted">{clips.find(clip => clip.scene_number === s.number) ? "MP4 salvo no projeto. Você pode seguir para outra cena." : "Você pode avançar sem importar o vídeo agora e voltar depois."}</p>
                </div>
                {s.number < 12 && project.status === "draft" && <button className={button + " w-full !bg-primary !text-primary-foreground !border-primary"}
                  disabled={busy || !scenePromptText.trim() || countStoryPromptCharacters(scenePromptText) > PLATFORM_GUIDES[chosenPlatform].absoluteChars}
                  onClick={() => void advanceToNextScene(s.number)}>Concluir preparação · Ir para cena {s.number + 1}</button>}
                {s.number === 12 && <p className="text-xs text-muted">Última cena. Revise todas as cenas e conclua a aprovação do roteiro quando estiver pronto.</p>}
                </>}
                <details className="rounded-lg border border-border p-2">
                  <summary className="cursor-pointer text-xs font-semibold">Outras opções e imagens para baixar</summary>
                  <div className="space-y-2 pt-2">
                    {chosenPlatform === "youtube-create" && <p className="text-xs text-muted">
                      YouTube Create: máximo 900 caracteres (contagem conservadora, sem normalização). Uma microação por clipe.
                      Escolha 9:16 e a iluminação no aplicativo; anexe até 3 referências, se disponíveis.
                      Vídeos aceitam prompts em vários idiomas; falas em pt-BR devem ficar explícitas.
                    </p>}
                    {chosenPlatform === "google-flow" && <>
                      <p className="text-xs text-muted">Flow: crie Elementos/Ingredientes com os mesmos nomes das menções @.
                        O texto de identidade visual abaixo pode ser colocado nas instruções do agente do projeto.</p>
                      <textarea className={field + " text-xs"} readOnly rows={4}
                        value={makeStoryFlowAgentInstructions(project.characters,project.character_style || "nao_definido")}/>
                      <button type="button" className={button + " !text-xs"}
                        onClick={() => void navigator.clipboard.writeText(makeStoryFlowAgentInstructions(project.characters,
                          project.character_style || "nao_definido")).then(() => setMessage("Instruções do agente copiadas."))}>
                        Copiar instruções do agente</button>
                    </>}
                    {chosenPlatform === "dreamina" && <p className="text-xs text-muted">
                      Dreamina: associe @Imagem 1, @Imagem 2 etc. aos arquivos carregados na plataforma.
                      Use Sujeito 1, Sujeito 2 sem alternar rótulos entre ações. Os vínculos não são automáticos.
                    </p>}
                    <button type="button" className={button + " mr-2 !text-xs"} onClick={() => setSceneWorkbenchStep("personagens")}>Voltar às imagens</button>
                    <button type="button" className={button + " !text-xs"} onClick={() => setSceneWorkbenchStep("roteiro")}>Voltar ao roteiro</button>
                    <p className="text-xs text-muted">{PLATFORM_GUIDES[chosenPlatform].workflow} Até {PLATFORM_GUIDES[chosenPlatform].absoluteChars} caracteres.</p>
                    {project.characters.filter(char => s.characters.includes(char.name) && char.referenceImagePath).map(char =>
                      <button key={char.name} className={button + " mr-2 !text-xs"}
                        onClick={() => void downloadReference(char.referenceImagePath!,char.name)}>Baixar imagem de {char.name}</button>)}
                  </div>
                </details>
              </div>}
            </div>}
          </div>;
        })}
      </div>}
      {project.status === "draft" ? <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Opções de roteiro completo</summary><div className="flex flex-wrap gap-2 pt-3">
        <button className={button} disabled={busy} onClick={() => void saveScript(false)}>Salvar alterações</button>
        <button className={button} disabled={busy} onClick={() => void saveScript(true)}>Aprovar roteiro e liberar prompts</button>
      </div></details> : <p className="font-semibold text-sm">Roteiro aprovado e congelado para manter os prompts consistentes.</p>}
    </section>}

    {stage === "gerador" && <section className={panel}>
      <h2 className="text-lg font-semibold">3. Escolha a ferramenta geradora de vídeo</h2>
      <p className="text-sm text-muted">Cada ferramenta tem um agente próprio para adaptar os prompts ao roteiro e à Bíblia de Personagens. Os agentes organizam textos; não executam o navegador ou geram MP4.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {platformOptions.map(option => { const guide = PLATFORM_GUIDES[option.value]; return <button key={option.value}
          type="button" aria-pressed={platform === option.value}
          className={"rounded-xl border p-4 text-left space-y-2 " + (platform === option.value ? "border-primary bg-primary/10" : "border-border bg-surface")}
          onClick={() => { setPlatform(option.value); setPrompts([]); if (project?.status !== "draft") void loadPlatformPrompts(option.value); }}>
          <span className="block font-bold">{guide.name}</span>
          <span className="block text-xs text-muted">{guide.duration}</span>
          <span className="block text-xs">{guide.reminder}</span>
          <span className="block text-xs font-semibold">{platform === option.value ? "Selecionado ✓" : "Escolher ferramenta"}</span>
        </button>; })}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <h3 className="font-semibold">Agente {PLATFORM_GUIDES[platform].name}</h3>
        <p className="text-sm">{PLATFORM_GUIDES[platform].workflow}</p>
        <p className="text-xs text-muted">Meta: {PLATFORM_GUIDES[platform].targetChars} caracteres. Teto de validação: {PLATFORM_GUIDES[platform].absoluteChars}.</p>
      </div>
      {project?.status === "draft" ? <p className="text-sm text-muted">Você já pode preparar prompts das cenas preenchidas dentro da etapa Roteiro, sem aguardar as 12 cenas. A aprovação completa libera a biblioteca geral de prompts.</p> :
        !project ? <p className="text-sm text-muted">Crie um roteiro antes de continuar.</p> :
        <button className={button} onClick={() => setStage("prompts")}>Continuar para prompts</button>}
    </section>}
    {stage === "prompts" && (!project || project.status === "draft") && <section className={panel}>
      <h2 className="font-semibold">4. Prompts por cena</h2>
      <p className="text-sm text-muted">Enquanto o roteiro está em desenvolvimento, abra a cena desejada na etapa Roteiro para escolher imagens, plataforma, gerar ou montar o prompt e baixar os arquivos imediatamente.</p>
      <button className={button} onClick={() => setStage(project ? "roteiro" : "temas")}>Ir para o roteiro</button>
    </section>}
    {stage === "prompts" && project && user && project.user_id === user.id && project.status !== "draft" && <section className={panel}>
      <h2 className="text-lg font-semibold">4. Agente de prompts — {PLATFORM_GUIDES[platform].name}</h2>
      <label className="block text-sm font-semibold">Plataforma de geração
        <select className={field + " mt-1"} value={platform} onChange={e => { const next = e.target.value as Platform; setPlatform(next); setPrompts([]); void loadPlatformPrompts(next); }}>
          {platformOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted">{PLATFORM_GUIDES[platform].workflow} {PLATFORM_GUIDES[platform].reminder}</p>
      <p className="text-xs text-muted">Motor interno: gera e salva os 12 prompts sem API nem consumo de tokens. Os prompts já salvos não são sobrescritos.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button + " !bg-primary !text-primary-foreground !border-primary"} disabled={busy} onClick={() => void previewLocalPrompts()}>Gerar e salvar 12 prompts sem IA</button>
        <button className={button} disabled={busy} onClick={() => void loadPlatformPrompts(platform)}>Reabrir prompts salvos</button>
      </div>
      <details className="rounded-xl border border-border p-2">
        <summary className="cursor-pointer text-xs font-semibold">Opção avançada: gerar prompts com IA</summary>
        <button className={button + " mt-2"} disabled={busy} onClick={() => void generatePrompts()}>{busy && sceneProgress ? sceneProgress : "Gerar os 12 prompts com Gemini (1 chamada)"}</button>
      </details>
      {!prompts.length && <p className="rounded-xl border border-border p-3 text-sm text-muted">Nenhum prompt desta ferramenta foi carregado. Use a Gemini ou o gerador local de rascunhos para preencher as 12 cenas.</p>}
      {prompts.map(p => <div className="rounded-xl border border-border p-3 space-y-2" key={p.scene}>
        <h3 className="font-semibold">Prompt da cena {p.scene}</h3>
        <textarea aria-label={"Prompt da cena " + p.scene} className={field} rows={5} value={p.text}
          onChange={e => setPrompts(previous => previous.map(x => x.scene === p.scene && x.platform === p.platform ?
            { ...x, text: e.target.value } : x))}/>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={"text-xs " + (maxPrompt && Array.from(p.text).length > maxPrompt ? "text-red-600" : "text-muted")}>
            {Array.from(p.text).length} caracteres / {maxPrompt}
          </p>
          <div className="flex gap-2">
            <button className={button} disabled={busy || !p.text.trim() || !!(maxPrompt && Array.from(p.text).length > maxPrompt)}
              onClick={() => void saveEditedPrompt(p.scene)}>Salvar edição</button>
            <button className={button} disabled={!p.text.trim() || !!(maxPrompt && Array.from(p.text).length > maxPrompt)} onClick={() => void navigator.clipboard.writeText(p.text)}>Copiar prompt</button>
          </div>
        </div>
      </div>)}
    </section>}

    {stage === "cenas" && !project && <section className={panel}>
      <h2 className="font-semibold">5. Biblioteca de cenas</h2>
      <p className="text-sm text-muted">Os 12 espaços de vídeo serão associados à história criada na etapa Roteiro.</p>
      <button className={button} onClick={() => setStage("roteiro")}>Ir para o roteiro</button>
    </section>}
    {stage === "cenas" && project && user && project.user_id === user.id && <section className={panel}>
      <h2 className="text-lg font-semibold">5. Biblioteca de clipes e aprovação</h2>
      <p className="text-sm text-muted">Importe um MP4 de cada cena. Os arquivos ficam em Storage privado. Montagem em 2 minutos e publicação serão habilitadas em uma etapa própria de integração.</p>
      <p className="text-sm font-semibold">{clips.filter(c => c.approved).length}/12 clipes aprovados</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {project.scenes.map(s => {const clip = clips.find(c => c.scene_number === s.number); return <div key={s.number}
          className="rounded-xl border border-border p-3 space-y-2 text-sm">
          <p className="font-semibold">Cena {s.number} — {s.title}</p>
          <p className="text-xs text-muted">{clip ? clip.approved ? "Aprovado" : "Enviado · aguardando revisão" : "Vídeo pendente"}</p>
          <label className="block">Selecionar MP4
            <input className="mt-2 block w-full text-xs" type="file" accept="video/mp4" disabled={busy}
              onChange={e => {const file=e.currentTarget.files?.[0];void uploadClip(s.number,file);e.currentTarget.value="";}}/>
          </label>
          {clip && <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => void previewClip(s.number)}>Visualizar</button>
            <button className={button} disabled={busy} onClick={() => void approveClip(s.number, !clip.approved)}>
              {clip.approved ? "Retirar aprovação" : "Aprovar clipe"}
            </button>
          </div>}
        </div>})}
      </div>
    </section>}

    {stage === "montagem" && <section className={panel}>
      <h2 className="text-lg font-semibold">6. Montagem — linha do tempo de 2 minutos</h2>
      <p className="text-sm text-muted">Ordem fixa de 12 cenas para preservar a história. Nesta fase, o Meu Vendedor organiza e verifica os clipes; o renderizador MP4 final será conectado posteriormente.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(project?.scenes || makeEmptyStoryScenes()).map(scene => {
          const clip = clips.find(item => item.scene_number === scene.number);
          return <div key={scene.number} className="rounded-xl border border-border bg-surface p-3 space-y-2 text-sm">
            <p className="font-bold">Cena {String(scene.number).padStart(2, "0")}</p>
            <p className="text-xs text-muted">{(scene.number - 1) * 10}s – {scene.number * 10}s</p>
            <p className="text-xs">{clip ? clip.approved ? "Aprovada" : "Aguardando aprovação" : "Sem MP4"}</p>
            {clip && <button className={button} onClick={() => void previewClip(scene.number)}>Ver MP4</button>}
          </div>;
        })}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>{approvedCount} de 12 cenas aprovadas</span><strong>{approvedCount === 12 ? "Clipes prontos para montagem futura" : "Montagem pendente"}</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-secondary" aria-label="Progresso dos clipes aprovados">
          <div className="h-full bg-primary" style={{ width: (approvedCount / 12 * 100) + "%" }}/>
        </div>
        <p className="text-xs text-muted">Exportação planejada: MP4, H.264/AAC, 1080 × 1920, 9:16, alvo de 120 segundos. Não há renderização em segundo plano.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!project} onClick={downloadProductionPlan}>Baixar plano de produção (JSON)</button>
        <button className={button} onClick={() => setStage("cenas")}>Revisar clipes</button>
        <button className={button} onClick={() => setStage("publicacao")}>Preparar publicação</button>
      </div>
    </section>}
    <section className={panel} hidden={stage !== "publicacao"}>
      <h2 className="text-lg font-semibold">7. Preparação para YouTube, TikTok e Kwai</h2>
      <p className="text-sm text-muted">Vídeo final planejado: 12 cenas de 10s, 2 minutos, MP4 9:16 (1080 × 1920). A montagem automática e o envio direto às plataformas ainda não estão habilitados.</p>
      <label className="block text-sm">Rede de destino
        <select className={field + " mt-1"} value={destination} onChange={e => setDestination(e.target.value as "youtube" | "tiktok" | "kwai")}>
          <option value="youtube">YouTube Shorts</option><option value="tiktok">TikTok</option><option value="kwai">Kwai</option>
        </select>
      </label>
      <label className="block text-sm">Título da publicação
        <input className={field + " mt-1"} maxLength={220} value={publishTitle} onChange={e => setPublishTitle(e.target.value)}/>
      </label>
      <label className="block text-sm">Descrição e hashtags
        <textarea className={field + " mt-1"} rows={4} value={publishDescription} onChange={e => setPublishDescription(e.target.value)}/>
      </label>
      <button className={button} onClick={() => void navigator.clipboard.writeText(
        [publishTitle, publishDescription].filter(Boolean).join("\n\n")
      )}>Copiar título e descrição</button>
      <div className="rounded-xl border border-border p-3 space-y-2 text-sm">
        <p className="font-semibold">{destination === "youtube" ? "YouTube Shorts" : destination === "tiktok" ? "TikTok" : "Kwai"} — preparação</p>
        <p>{destination === "youtube" ? "O upload por YouTube Data API depende de autorização e integração específicas." :
          destination === "tiktok" ? "Publicação direta exige aprovação e permissões da Content Posting API; sem elas, conclua no aplicativo." :
          "Publicação automatizada no Kwai Brasil ainda não foi confirmada; prepare e compartilhe manualmente."}</p>
        <p className="text-muted">O botão de copiar não publica nada na rede social. A publicação automática depende de integrações e permissões futuras.</p>
      </div>
    </section>
    {stage !== "roteiro" && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <button className={button} disabled={currentStage === 0}
        onClick={() => setStage(STORY_STAGES[Math.max(0, currentStage - 1)].key)}>Etapa anterior</button>
      <span className="text-sm text-muted">Etapa {currentStage + 1} de 7 — {STORY_STAGES[currentStage].title}</span>
      <button className={button} disabled={currentStage === STORY_STAGES.length - 1}
        onClick={() => setStage(STORY_STAGES[Math.min(STORY_STAGES.length - 1, currentStage + 1)].key)}>Próxima etapa</button>
    </footer>}
    {stage !== "roteiro" && error && <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
    {stage !== "roteiro" && message && <p role="status" className="rounded-xl border border-border p-3 text-sm">{message}</p>}
  </div>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { STORY_STAGES, PLATFORM_GUIDES, makeEmptyStoryScenes, makeLocalPromptDrafts, countStoryWords, type StoryStage } from "@/lib/stories/workflow";

type Genre = "geral" | "comedia" | "suspense" | "educativo" | "aventura" | "drama";
type Platform = "youtube-create" | "google-flow" | "dreamina";
type Topic = { id: string; user_id: string; subject: string; title: string; synopsis: string; genre: string; saved: boolean };
type TopicDraft = Pick<Topic, "subject" | "title" | "synopsis" | "genre"> & { localId: string };
type Character = { name: string; role: string; visual: string; voice: string; referenceImagePath?: string };
type Dialogue = { speaker: string; text: string };
type Scene = { number: number; durationSeconds: 10; title: string; setting: string; action: string; characters: string[]; dialogue: Dialogue[]; transition: string };
type Project = { id: string; user_id: string; title: string; status: string; characters: Character[]; scenes: Scene[] };
type Prompt = { scene: number; text: string; platform: Platform };
type Clip = { id: string; scene_number: number; storage_path: string; approved: boolean };

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
const button = "rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold disabled:opacity-40";
const field = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";
const panel = "rounded-2xl border border-border bg-surface p-4 space-y-4";
const plainError = (error: unknown): string => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

async function invokeStory(action: string, payload: Record<string, unknown>) {
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
    if (code === "gemini_billing_required") {
      throw new Error("A API Gemini retornou HTTP 402: saldo ou configuração de cobrança necessária. Não foi possível gerar temas com esta chave. Você pode criar um roteiro manual enquanto verifica sua franquia no Google AI Studio.");
    }
    if (code === "gemini_service_unavailable") throw new Error("Google Gemini retornou HTTP 503: indisponibilidade temporária. Nenhuma tentativa automática foi feita; consulte o status do serviço antes de tentar novamente.");
    if (code === "gemini_output_truncated") throw new Error("O Gemini atingiu o limite de saída antes de concluir o JSON. O conteúdo não foi salvo; não repita agora sem analisar o consumo.");
    if (code === "gemini_timeout") throw new Error("O Google Gemini não respondeu em até 60 segundos. Não repita a geração agora; consulte os registros antes de uma nova tentativa.");
    if (code === "gemini_network_error") throw new Error("Falha de comunicação entre Supabase e Google Gemini. Consulte os registros antes de tentar novamente.");
    if (code === "gemini_quota_exceeded") {
      throw new Error("O limite de requisições da API Gemini foi atingido. Verifique as cotas no Google AI Studio antes de tentar novamente.");
    }
    throw new Error("Serviço de Histórias: " + code);
  }
  return data;
}
function isScript(value: unknown): value is { characters: Character[]; scenes: Scene[] } {
  if (!value || typeof value !== "object" || !("characters" in value) || !("scenes" in value)) return false;
  const data = value as { characters: unknown; scenes: unknown };
  return Array.isArray(data.characters) && data.characters.length > 0 && Array.isArray(data.scenes) && data.scenes.length === 12;
}

export function StoriesStudio() {
  const { user } = useAuth();
  const [stage, setStage] = useState<StoryStage>("temas");
  const [manualTitle, setManualTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [genre, setGenre] = useState<Genre>("geral");
  const [requested, setRequested] = useState(5);
  const [query, setQuery] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState<Genre>("geral");
  const [draftTopics, setDraftTopics] = useState<TopicDraft[]>([]);
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [destination, setDestination] = useState<"youtube" | "tiktok" | "kwai">("youtube");
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [platform, setPlatform] = useState<Platform>("youtube-create");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [checkingGemini, setCheckingGemini] = useState(false);
  const [progress, setProgress] = useState(0);
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
    const { data } = await client.from("mv_story_projects").select("id,user_id,title,status,characters,scenes")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
    setProjects((data || []) as Project[]);
  }, [user]);
  useEffect(() => { void Promise.resolve().then(() => Promise.all([loadTopics(), loadProjects()])); }, [loadTopics, loadProjects]);
  async function openProject(selected: Project) {
    if (!user) return;
    setError(""); setProject(selected); setActiveTopic(null); setPublishTitle(selected.title); setStage("roteiro");
    const client = getSupabase(); if (!client) return;
    const [clipsResult, promptResult] = await Promise.all([
      client.from("mv_story_clips").select("id,scene_number,storage_path,approved").eq("user_id", user.id).eq("project_id", selected.id),
      client.from("mv_story_prompts").select("scene_number,prompt,platform").eq("user_id", user.id).eq("project_id", selected.id).eq("platform", platform).order("scene_number"),
    ]);
    setClips((clipsResult.data || []) as Clip[]);
    setPrompts((promptResult.data || []).map(p => ({ scene: p.scene_number as number, text: p.prompt as string, platform: p.platform as Platform })));
  }
  async function uploadReference(characterIndex: number, file?: File) {
    if (!file || !user || !project || project.status !== "draft") return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
      return setError("Use PNG, JPG ou WebP de até 10 MB.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = user.id + "/" + project.id + "/character-" + characterIndex + "-" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await client.storage.from("mv-story-images").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("Falha ao enviar referência visual privada.");
      setProject({ ...project, characters: project.characters.map((c, i) => i === characterIndex ? { ...c, referenceImagePath: path } : c) });
      setMessage("Referência visual associada ao personagem. Salve o roteiro para persistir.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }

  async function checkGeminiConnection(purpose: "topics" | "script" = "topics") {
    if (!user || checkingGemini || busy) return;
    setCheckingGemini(true); setError(""); setMessage("");
    try {
      const action = purpose === "topics" ? "diagnose_topics" : "diagnose_script";
      const result = await invokeStory(action, {}) as {
        ok: boolean; model: string; elapsedMs: number; supportsGeneration: boolean;
      };
      if (!result.ok) throw new Error("A consulta de metadados do modelo não foi concluída.");
      setMessage(result.supportsGeneration
        ? "Conexão de " + (purpose === "topics" ? "temas" : "roteiros") + " confirmada: " + result.model +
          " (" + result.elapsedMs + " ms). Somente metadados consultados; geração não testada."
        : "A chave respondeu, mas o modelo não declarou suporte a generateContent: " + result.model +
          ". Nenhum conteúdo foi gerado.");
    } catch (e) { setError(plainError(e)); }
    finally { setCheckingGemini(false); }
  }
  async function generateTopics() {
    if (!user || subject.trim().length < 2) return;
    setBusy(true); setError(""); setMessage(""); setProgress(0);
    const normalizedSubject = subject.trim();
    const known = new Set([...topics.filter(t => t.subject === normalizedSubject).map(t => t.title.toLowerCase()),
      ...draftTopics.filter(t => t.subject === normalizedSubject).map(t => t.title.toLowerCase())]);
    try {
      // One click = one Gemini request. Never automatically repeat a partial/failed generation.
      const result = await invokeStory("topics", {
        subject: normalizedSubject, genre, count: requested,
        excludedTitles: [...known].slice(-30),
      }) as { topics: { title: string; genre: string; synopsis: string }[] };
      if (!Array.isArray(result.topics)) throw new Error("O Gemini não retornou uma lista válida.");
      const fresh = result.topics.filter(t => t.title && !known.has(t.title.toLowerCase()));
      if (!fresh.length) throw new Error("O Gemini repetiu os temas. Tente outro assunto ou gênero.");
      const batch = fresh.map(t => ({
        localId: crypto.randomUUID(), subject: normalizedSubject, title: t.title,
        synopsis: t.synopsis, genre: t.genre,
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
        synopsis: t.synopsis, genre: t.genre, saved: true }));
      // Divide também a gravação para evitar limites de tamanho de uma única requisição.
      for (let i = 0; i < rows.length; i += 50) {
        const { error: dbError } = await client.from("mv_story_topics").upsert(rows.slice(i, i + 50),
          { onConflict: "user_id,subject,title", ignoreDuplicates: true });
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
  async function generateScript(topic: Topic) {
    if (!user) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await invokeStory("script", { title: topic.title, synopsis: topic.synopsis, genre: topic.genre });
      if (!isScript(result)) throw new Error("O Gemini não retornou as 12 cenas completas.");
      const client = getSupabase(); if (!client) throw new Error("Supabase indisponível.");
      const { data, error: dbError } = await client.from("mv_story_projects")
        .insert({ user_id: user.id, topic_id: topic.id, title: topic.title, genre: topic.genre,
          characters: result.characters, scenes: result.scenes, status: "draft" })
        .select("id,user_id,title,status,characters,scenes").single();
      if (dbError || !data) throw new Error("Não foi possível salvar o roteiro.");
      setActiveTopic(topic); setProject(data as Project); setPrompts([]); setClips([]); setStage("roteiro");
      setPublishTitle(topic.title); setPublishDescription(topic.synopsis);
      void loadProjects();
      setMessage("Roteiro criado. Revise e aprove as cenas antes de gerar prompts.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  async function createManualScript(title: string, topic?: Topic) {
    if (!user || title.trim().length < 3) return setError("Digite um título com pelo menos 3 caracteres.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const scenes = makeEmptyStoryScenes();
      const characters: Character[] = [{ name: "Personagem 1", role: "Definir função",
        visual: "Definir aparência e roupas", voice: "Definir voz" }];
      const { data, error: dbError } = await client.from("mv_story_projects").insert({
        user_id: user.id, ...(topic ? { topic_id: topic.id } : {}), title: title.trim(),
        genre: topic?.genre || genre, characters, scenes, status: "draft",
      }).select("id,user_id,title,status,characters,scenes").single();
      if (dbError || !data) throw new Error("Não foi possível criar o roteiro manual.");
      setActiveTopic(topic || null); setProject(data as Project); setPrompts([]); setClips([]);
      setPublishTitle(title.trim()); setPublishDescription(topic?.synopsis || ""); setStage("roteiro");
      setMessage("Rascunho manual criado com 12 cenas vazias. Preencha e aprove antes de gerar prompts.");
      void loadProjects();
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  function previewLocalPrompts() {
    if (!project || project.status === "draft") return;
    setPrompts(makeLocalPromptDrafts(platform, project.characters, project.scenes));
    setStage("prompts");
    setMessage("Rascunhos locais montados a partir do roteiro, SEM Gemini. Revise os limites e salve os que desejar.");
  }
  function downloadProductionPlan() {
    if (!project) return;
    const data = { format: "Plano editorial — nenhum vídeo gerado",
      title: project.title, aspectRatio: "9:16", targetSeconds: 120,
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
  function updateCharacter(index: number, changes: Partial<Character>) {
    if (!project || project.status !== "draft") return;
    const previousName = project.characters[index].name;
    const nextName = changes.name ?? previousName;
    setProject({ ...project,
      characters: project.characters.map((char, i) => i === index ? { ...char, ...changes } : char),
      scenes: previousName === nextName ? project.scenes : project.scenes.map(scene => ({
        ...scene,
        characters: scene.characters.map(name => name === previousName ? nextName : name),
        dialogue: scene.dialogue.map(line => line.speaker === previousName ? { ...line, speaker: nextName } : line),
      })),
    });
  }
  function updateScene(index: number, changes: Partial<Scene>) {
    if (!project || project.status !== "draft") return;
    setProject({ ...project, scenes: project.scenes.map((scene, i) => i === index ? { ...scene, ...changes } : scene) });
  }
  async function saveScript(approve: boolean) {
    if (!project || !user) return;
    if (project.scenes.length !== 12 || project.scenes.some((s, i) => s.number !== i + 1 || !s.action.trim() || !s.setting.trim()))
      return setError("Cada uma das 12 cenas precisa ter ação, cenário e numeração correta.");
    const characterNames = new Set(project.characters.map(ch => ch.name.toLowerCase()));
    if (project.characters.some(ch => !ch.name.trim() || !ch.role.trim() || !ch.visual.trim() || !ch.voice.trim()))
      return setError("Preencha nome, função, aparência e voz de todos os personagens.");
    if (project.scenes.some(s => s.characters.some(ch => !characterNames.has(ch.toLowerCase())) ||
      s.dialogue.some(d => d.speaker.toLowerCase() !== "narrador" && !characterNames.has(d.speaker.toLowerCase()))))
      return setError("Um personagem mencionado na cena não existe na Bíblia de Personagens.");
    if (project.scenes.some(s => s.dialogue.reduce((n, d) => n + d.text.trim().split(/\s+/).filter(Boolean).length, 0) > 26))
      return setError("Uma das cenas ultrapassa 26 palavras de fala. Reduza a fala para caber nos 10 segundos.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const { error: dbError } = await client.from("mv_story_projects")
        .update({ scenes: project.scenes, characters: project.characters, status: approve ? "approved" : "draft",
          approved_at: approve ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", project.id).eq("user_id", user.id);
      if (dbError) throw new Error("Não foi possível salvar o roteiro.");
      setProject({ ...project, status: approve ? "approved" : "draft" });
      if (approve) setStage("gerador");
      void loadProjects();
      setMessage(approve ? "Roteiro aprovado. Você já pode gerar os prompts." : "Rascunho salvo.");
      setPrompts([]);
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  async function generatePrompts() {
    if (!project || project.status === "draft" || !user) return;
    setBusy(true); setError("");
    try {
      const result = await invokeStory("prompts", { platform, script: { characters: project.characters, scenes: project.scenes } }) as { prompts: Prompt[] };
      if (!Array.isArray(result.prompts) || result.prompts.length !== 12) throw new Error("Faltam prompts para algumas cenas.");
      const client = getSupabase(); if (!client) return;
      const rows = result.prompts.map(p => ({ user_id: user.id, project_id: project.id, scene_number: p.scene, platform: p.platform, prompt: p.text }));
      const { error: dbError } = await client.from("mv_story_prompts").upsert(rows, { onConflict: "project_id,scene_number,platform" });
      if (dbError) throw new Error("Não foi possível salvar os prompts.");
      setPrompts(result.prompts);
      setStage("prompts");
      setMessage("12 prompts gerados e salvos para " + platform + ".");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
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
    if (maximum && Array.from(current.text).length > maximum) return setError("O prompt excede o limite desta plataforma.");
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
    (!query || (t.title + " " + t.subject).toLowerCase().includes(query.toLowerCase())));
  const subjects = Array.from(new Set(topics.filter(t => user && t.user_id === user.id).map(t => t.subject))).sort();
  const maxPrompt = platformOptions.find(p => p.value === platform)?.maximum;

  const currentStage = STORY_STAGES.findIndex(item => item.key === stage);
  const approvedCount = clips.filter(clip => clip.approved).length;
  return <div className="space-y-6">
    <header className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Estúdio de Histórias</h2>
          <p className="text-sm text-muted">Do primeiro tema à preparação da publicação, em sete etapas.</p></div>
        <div className="text-sm font-semibold">2 min · 12 cenas · 9:16</div>
      </div>
      <nav aria-label="Etapas do gerador de histórias" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {STORY_STAGES.map((item, i) => <button type="button" key={item.key} aria-current={stage === item.key ? "step" : undefined}
          onClick={() => { setStage(item.key); setError(""); }}
          className={"min-h-20 rounded-xl border p-3 text-left text-sm transition-colors " +
            (stage === item.key ? "border-primary bg-primary/10 font-semibold" : "border-border bg-surface hover:bg-surface-secondary")}>
          <span className="mb-1 block text-xs text-muted">{String(i + 1).padStart(2, "0")} / 07</span>
          <span className="block font-semibold">{item.title}</span>
          <span className="block text-xs text-muted">{item.description}</span>
        </button>)}
      </nav>
      {project && <p className="rounded-xl border border-border p-3 text-sm">
        <strong>História em edição:</strong> {project.title} · {project.status === "draft" ? "Roteiro em revisão" : "Roteiro aprovado"} · {approvedCount}/12 clipes aprovados
      </p>}
      <p className="text-xs text-muted">A interface pode ser explorada mesmo com o Gemini indisponível. A criação manual fica identificada; nenhuma tela simula um vídeo gerado.</p>
    </header>
    <section className={panel} hidden={stage !== "temas"}>
      <h2 className="text-lg font-semibold">1. Assuntos e temas</h2>
      <p className="text-sm text-muted">Selecione de 5 a 20 temas por geração. O padrão é 5 temas. Revise os resultados antes de salvar.</p>
      <label className="block text-sm font-medium">Assunto principal
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
        <button className={button} disabled={busy || checkingGemini || !user || subject.trim().length < 2} onClick={() => void generateTopics()}>
          {busy ? "Gerando..." : "Gerar temas com Gemini"}
        </button>
        <button className={button} disabled={busy || checkingGemini || !user} onClick={() => void checkGeminiConnection()}>{checkingGemini ? "Verificando conexão..." : "Verificar Gemini sem gerar temas"}</button>
        <button className={button} disabled={busy || checkingGemini || !user} onClick={() => void checkGeminiConnection("script")}>Verificar API de roteiros sem gerar</button>
        {busy && <span className="text-sm" role="status">{progress}/{requested} temas novos</span>}
        {error && <p role="alert" className="w-full rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="w-full rounded-xl border border-border p-3 text-sm">{message}</p>}
      </div>
      {!user && <p className="text-sm text-muted">Entre em Conta e conexões para salvar seu catálogo privado.</p>}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <p className="font-semibold text-sm">Quer testar a interface antes de corrigirmos a conexão Gemini?</p>
        <p className="text-xs text-muted">Crie um roteiro manual real, com 12 cenas editáveis, sem simular conteúdo gerado por IA.</p>
        <div className="flex flex-wrap gap-2">
          <input className={field + " flex-1 min-w-44"} value={manualTitle} maxLength={220} onChange={e => setManualTitle(e.target.value)}
            placeholder="Título da sua história" aria-label="Título para roteiro manual"/>
          <button className={button} disabled={busy || !user || manualTitle.trim().length < 3}
            onClick={() => void createManualScript(manualTitle)}>Criar roteiro manual</button>
        </div>
      </div>
    </section>

    <section className={panel} hidden={stage !== "temas"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">2. Temas gerados — revisão ({draftTopics.length})</h2>
        <button className={button} disabled={!draftTopics.length || !!savingTopic || busy}
          onClick={() => void saveDraftTopics(draftTopics)}>Salvar todos os temas</button>
      </div>
      <p className="text-sm text-muted">Esta caixa contém os resultados ainda não salvos. Você decide o que manter na biblioteca.</p>
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
        {draftTopics.map(t => <article key={t.localId} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-medium">{t.title}</p><p className="text-sm text-muted">{t.synopsis}</p>
            <p className="text-xs text-muted">{t.subject} · {t.genre}</p></div>
          <div className="flex shrink-0 gap-2">
            <button className={button} disabled={busy || !!savingTopic} onClick={() => void saveDraftTopics([t])}>Salvar</button>
            <button className={button} disabled={busy || !!savingTopic}
              onClick={() => setDraftTopics(previous => previous.filter(item => item.localId !== t.localId))}>Descartar</button>
          </div>
        </article>)}
        {!draftTopics.length && <p className="text-sm text-muted">Os temas gerados aparecerão aqui antes de serem salvos.</p>}
      </div>
    </section>
    <section className={panel} hidden={stage !== "temas"}>
      <h2 className="text-lg font-semibold">3. Biblioteca de temas <span className="text-sm text-muted">({visibleTopics.length})</span></h2>
      <div className="flex flex-wrap gap-3">
        <input className={field + " max-w-sm"} value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar temas e assuntos" />
        <select className={field + " max-w-xs"} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} aria-label="Filtrar por assunto">
          <option value="">Todos os assuntos</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={field + " max-w-xs"} value={genreFilter} onChange={e => setGenreFilter(e.target.value as Genre)} aria-label="Filtrar por gênero">
          {genres.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)}/> Somente favoritos</label>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {visibleTopics.map(t => <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">{t.title}</p><p className="text-sm text-muted">{t.synopsis}</p>
            <p className="text-xs text-muted">{t.subject} · {t.genre}</p></div>
          <div className="flex shrink-0 gap-2">
            <button className={button} disabled={busy} onClick={() => void toggleSaved(t)}>{t.saved ? "Salvo ✓" : "Salvar"}</button>
            <button className={button} disabled={busy} onClick={() => void generateScript(t)}>Gerar roteiro Gemini</button>
            <button className={button} disabled={busy} onClick={() => void createManualScript(t.title, t)}>Roteiro manual</button>
          </div>
        </div>)}
        {!visibleTopics.length && <p className="text-sm text-muted">Nenhum tema encontrado. Gere uma lista acima.</p>}
      </div>
    </section>

    <section className={panel} hidden={stage !== "roteiro"}>
      <h2 className="text-lg font-semibold">Projetos salvos</h2>
      <p className="text-sm text-muted">Retome um roteiro após fechar o navegador.</p>
      <div className="flex flex-wrap gap-2">
        {projects.filter(p => user && p.user_id === user.id).map(p => <button key={p.id} className={button} disabled={busy} onClick={() => void openProject(p)}>
          {p.title} · {p.status}
        </button>)}
        {!projects.length && <p className="text-sm text-muted">Ainda não há histórias salvas.</p>}
      </div>
    </section>

    {stage === "roteiro" && !project && <section className={panel}>
      <h2 className="font-semibold">Roteiro ainda não iniciado</h2>
      <p className="text-sm text-muted">Na etapa Temas, selecione Gerar roteiro Gemini ou Roteiro manual para abrir um editor com 12 cenas.</p>
      <button className={button} onClick={() => setStage("temas")}>Voltar aos temas</button>
    </section>}
    {stage === "roteiro" && project && user && project.user_id === user.id && <section className={panel}>
      <h2 className="text-lg font-semibold">4. Roteiro — {activeTopic?.title || project.title}</h2>
      <p className="text-sm text-muted">12 cenas × 10 segundos = 120 segundos. Os personagens e as vozes se mantêm iguais entre cenas.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-label="Linha do tempo de 12 cenas">
        {project.scenes.map(s => <a key={s.number} href={"#story-scene-" + s.number}
          className="rounded-xl border border-border bg-surface px-2 py-3 text-center text-sm hover:underline">
          <span className="block font-semibold">Cena {s.number}</span><span className="text-xs text-muted">10s · {clips.find(c => c.scene_number === s.number)?.approved ? "Aprovado" : clips.some(c => c.scene_number === s.number) ? "Enviado" : "Pendente"}</span>
        </a>)}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-3">
        <h3 className="font-semibold">Bíblia de personagens — identidade e continuidade</h3>
        {project.characters.map((char, ci) => <div key={ci} className="rounded-xl border border-border p-3 space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>Nome do personagem<input className={field + " mt-1"} maxLength={100} disabled={project.status !== "draft"}
              value={char.name} onChange={e => updateCharacter(ci, { name: e.target.value })}/></label>
            <label>Função na história<input className={field + " mt-1"} maxLength={180} disabled={project.status !== "draft"}
              value={char.role} onChange={e => updateCharacter(ci, { role: e.target.value })}/></label>
          </div>
          <label className="block">Aparência, roupas, cores e acessórios<textarea className={field + " mt-1"} rows={2} maxLength={1100}
            disabled={project.status !== "draft"} value={char.visual} onChange={e => updateCharacter(ci, { visual: e.target.value })}/></label>
          <label className="block">Voz, sotaque e modo de falar<textarea className={field + " mt-1"} rows={2} maxLength={450}
            disabled={project.status !== "draft"} value={char.voice} onChange={e => updateCharacter(ci, { voice: e.target.value })}/></label>
          <p className="text-xs text-muted">{char.referenceImagePath ? "Imagem de referência vinculada" : "Sem referência visual enviada"}</p>
          {project.status === "draft" && <label className="block">Imagem do personagem (opcional)
            <input className="mt-2 block w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
              onChange={e => {const file=e.currentTarget.files?.[0];void uploadReference(ci,file);e.currentTarget.value="";}}/>
          </label>}
        </div>)}
      </div>
      <div className="space-y-4">
        {project.scenes.map((s, i) => <div key={s.number} id={"story-scene-" + s.number} className="rounded-xl border border-border p-3 space-y-3">
          <h3 className="font-semibold">Cena {s.number} · 10 segundos</h3>
          <label className="block text-sm">Título da cena
            <input className={field + " mt-1"} maxLength={160} value={s.title} disabled={project.status !== "draft"}
              onChange={e => updateScene(i, { title: e.target.value })}/>
          </label>
          <label className="block text-sm">Cenário
            <textarea className={field + " mt-1"} rows={2} value={s.setting} disabled={project.status !== "draft"}
              onChange={e => updateScene(i, { setting: e.target.value })}/>
          </label>
          <label className="block text-sm">Ação
            <textarea className={field + " mt-1"} rows={3} value={s.action} disabled={project.status !== "draft"}
              onChange={e => updateScene(i, { action: e.target.value })}/>
          </label>
          <label className="block text-sm">Falas (uma por linha, usando Nome: texto)
            <textarea className={field + " mt-1"} rows={2}
              value={s.dialogue.map(d => d.speaker + ": " + d.text).join("\n")} disabled={project.status !== "draft"}
              onChange={e => updateScene(i, { dialogue: e.target.value.split("\n").map(line => {
                const colon = line.indexOf(":");
                return colon < 0 ? null : { speaker: line.slice(0, colon).trim(), text: line.slice(colon + 1).trim() };
              }).filter((d): d is Dialogue => !!d && !!d.speaker && !!d.text) })}/>
          </label>
          <label className="block text-sm">Personagens presentes (nomes separados por vírgula)
            <input className={field + " mt-1"} disabled={project.status !== "draft"} value={s.characters.join(", ")}
              onChange={e => updateScene(i, { characters: e.target.value.split(",").map(n => n.trim()).filter(Boolean) })}/>
          </label>
          <label className="block text-sm">Transição e ligação com a próxima cena
            <input className={field + " mt-1"} disabled={project.status !== "draft"} value={s.transition}
              onChange={e => updateScene(i, { transition: e.target.value })}/>
          </label>
          <p className="text-xs text-muted">Fala aproximada: {countStoryWords(s)}/26 palavras · tempo-alvo: 10s</p>
        </div>)}
      </div>
      {project.status === "draft" ? <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void saveScript(false)}>Salvar alterações</button>
        <button className={button} disabled={busy} onClick={() => void saveScript(true)}>Aprovar roteiro e liberar prompts</button>
      </div> : <p className="font-semibold text-sm">Roteiro aprovado e congelado para manter os prompts consistentes.</p>}
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
      {project?.status === "draft" ? <p className="text-sm text-muted">Aprove o roteiro na etapa anterior para liberar os prompts.</p> :
        !project ? <p className="text-sm text-muted">Crie um roteiro antes de continuar.</p> :
        <button className={button} onClick={() => setStage("prompts")}>Continuar para prompts</button>}
    </section>}
    {stage === "prompts" && (!project || project.status === "draft") && <section className={panel}>
      <h2 className="font-semibold">4. Prompts por cena</h2>
      <p className="text-sm text-muted">Para gerar os 12 prompts, crie um roteiro, revise os personagens e clique em Aprovar roteiro.</p>
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
      <p className="text-xs text-muted">Os prompts gerados via Gemini ficam no banco; os rascunhos locais são prévias editoriais até você salvar cada cena.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void generatePrompts()}>Gerar 12 prompts com Gemini</button>
        <button className={button} disabled={busy} onClick={previewLocalPrompts}>Montar rascunhos locais sem IA</button>
        <button className={button} disabled={busy} onClick={() => void loadPlatformPrompts(platform)}>Reabrir prompts salvos</button>
      </div>
      {!prompts.length && <p className="rounded-xl border border-border p-3 text-sm text-muted">Nenhum prompt desta ferramenta foi carregado. Use o Gemini ou o gerador local de rascunhos para preencher as 12 cenas.</p>}
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
            <button className={button} disabled={!p.text.trim()} onClick={() => void navigator.clipboard.writeText(p.text)}>Copiar prompt</button>
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
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <button className={button} disabled={currentStage === 0}
        onClick={() => setStage(STORY_STAGES[Math.max(0, currentStage - 1)].key)}>Etapa anterior</button>
      <span className="text-sm text-muted">Etapa {currentStage + 1} de 7 — {STORY_STAGES[currentStage].title}</span>
      <button className={button} disabled={currentStage === STORY_STAGES.length - 1}
        onClick={() => setStage(STORY_STAGES[Math.min(STORY_STAGES.length - 1, currentStage + 1)].key)}>Próxima etapa</button>
    </footer>
    {error && <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-border p-3 text-sm">{message}</p>}
  </div>;
}

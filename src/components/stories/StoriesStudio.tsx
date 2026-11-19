"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

type Genre = "geral" | "comedia" | "suspense" | "educativo" | "aventura" | "drama";
type Platform = "youtube-create" | "google-flow" | "dreamina";
type Topic = { id: string; user_id: string; subject: string; title: string; synopsis: string; genre: string; saved: boolean };
type Character = { name: string; role: string; visual: string; voice: string };
type Dialogue = { speaker: string; text: string };
type Scene = { number: number; durationSeconds: 10; title: string; setting: string; action: string; characters: string[]; dialogue: Dialogue[]; transition: string };
type Project = { id: string; title: string; status: string; characters: Character[]; scenes: Scene[] };
type Prompt = { scene: number; text: string; platform: Platform };
type Clip = { id: string; scene_number: number; storage_path: string; approved: boolean };

const genres: { value: Genre; label: string }[] = [
  { value: "geral", label: "Todos os gêneros" }, { value: "comedia", label: "Comédia" },
  { value: "suspense", label: "Suspense" }, { value: "educativo", label: "Educativo" },
  { value: "aventura", label: "Aventura" }, { value: "drama", label: "Drama" },
];
const platformOptions: { value: Platform; label: string; maximum: number | null }[] = [
  { value: "youtube-create", label: "YouTube Create", maximum: 900 },
  { value: "google-flow", label: "Google Flow", maximum: null },
  { value: "dreamina", label: "Dreamina", maximum: null },
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
  const [subject, setSubject] = useState("");
  const [genre, setGenre] = useState<Genre>("geral");
  const [requested, setRequested] = useState(50);
  const [query, setQuery] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [platform, setPlatform] = useState<Platform>("youtube-create");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const cancelRef = useRef(false);
  const loadTopics = useCallback(async () => {
    if (!user) { setTopics([]); return; }
    const client = getSupabase();
    if (!client) return;
    const { data, error: dbError } = await client.from("mv_story_topics").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1500);
    if (dbError) { setError("Não foi possível carregar os temas. Verifique a migração do Histórias."); return; }
    setTopics((data || []) as Topic[]);
  }, [user]);
  useEffect(() => { void loadTopics(); }, [loadTopics]);

  async function generateTopics() {
    if (!user || subject.trim().length < 2) return;
    setBusy(true); setError(""); setMessage(""); setProgress(0); cancelRef.current = false;
    const client = getSupabase();
    if (!client) { setBusy(false); return; }
    try {
      const known = new Set(topics.filter(t => t.subject === subject.trim()).map(t => t.title.toLowerCase()));
      let total = 0;
      const initial = [...known];
      while (total < requested && !cancelRef.current) {
        const count = Math.min(25, requested - total);
        const result = await invokeStory("topics", { subject: subject.trim(), genre, count, excludedTitles: initial.slice(-80) }) as { topics: { title: string; genre: string; synopsis: string }[] };
        const fresh = result.topics.filter(t => !known.has(t.title.toLowerCase()));
        if (!fresh.length) throw new Error("O Gemini repetiu os temas anteriores. Tente outro assunto ou gênero.");
        const rows = fresh.map(t => ({ user_id: user.id, subject: subject.trim(), title: t.title, synopsis: t.synopsis, genre: t.genre, saved: false }));
        const { error: dbError } = await client.from("mv_story_topics").upsert(rows, { onConflict: "user_id,subject,title", ignoreDuplicates: true });
        if (dbError) throw new Error("Falha ao salvar os temas no banco.");
        fresh.forEach(t => known.add(t.title.toLowerCase()));
        initial.push(...fresh.map(t => t.title));
        total += fresh.length;
        setProgress(total);
        if (fresh.length < Math.max(1, count / 2)) break;
      }
      setMessage((cancelRef.current ? "Geração interrompida. " : "") + "Temas novos salvos: " + total + ". Você pode continuar depois.");
      await loadTopics();
    } catch (e) { setError(plainError(e)); await loadTopics(); }
    finally { setBusy(false); }
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
        .select("id,title,status,characters,scenes").single();
      if (dbError || !data) throw new Error("Não foi possível salvar o roteiro.");
      setActiveTopic(topic); setProject(data as Project); setPrompts([]); setClips([]);
      setMessage("Roteiro criado. Revise e aprove as cenas antes de gerar prompts.");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
  }
  function updateScene(index: number, changes: Partial<Scene>) {
    if (!project || project.status !== "draft") return;
    setProject({ ...project, scenes: project.scenes.map((scene, i) => i === index ? { ...scene, ...changes } : scene) });
  }
  async function saveScript(approve: boolean) {
    if (!project || !user) return;
    if (project.scenes.length !== 12 || project.scenes.some((s, i) => s.number !== i + 1 || !s.action.trim() || !s.setting.trim()))
      return setError("Cada uma das 12 cenas precisa ter ação, cenário e numeração correta.");
    const client = getSupabase(); if (!client) return;
    setBusy(true); setError("");
    try {
      const { error: dbError } = await client.from("mv_story_projects")
        .update({ scenes: project.scenes, characters: project.characters, status: approve ? "approved" : "draft",
          approved_at: approve ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", project.id).eq("user_id", user.id);
      if (dbError) throw new Error("Não foi possível salvar o roteiro.");
      setProject({ ...project, status: approve ? "approved" : "draft" });
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
      setMessage("12 prompts gerados e salvos para " + platform + ".");
    } catch (e) { setError(plainError(e)); }
    finally { setBusy(false); }
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
  const visibleTopics = topics.filter(t => (!onlySaved || t.saved) && (genre === "geral" || t.genre === genre)
    && (!query || (t.title + " " + t.subject).toLowerCase().includes(query.toLowerCase())));
  const maxPrompt = platformOptions.find(p => p.value === platform)?.maximum;

  return <div className="space-y-6">
    <section className={panel}>
      <h2 className="text-lg font-semibold">1. Assuntos e temas</h2>
      <p className="text-sm text-muted">Use Gemini Text para criar temas originais. Até 1.000 por solicitação, em lotes de 25 com salvamento progressivo.</p>
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
            {[25, 50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n} temas</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy || !user || subject.trim().length < 2} onClick={() => void generateTopics()}>
          {busy ? "Gerando..." : "Gerar temas com Gemini"}
        </button>
        {busy && <button className={button} onClick={() => { cancelRef.current = true; }}>Parar após o lote atual</button>}
        {busy && <span className="text-sm" role="status">{progress}/{requested} temas novos</span>}
      </div>
      {!user && <p className="text-sm text-muted">Entre em Conta e conexões para salvar seu catálogo privado.</p>}
    </section>

    <section className={panel}>
      <h2 className="text-lg font-semibold">2. Biblioteca de temas <span className="text-sm text-muted">({visibleTopics.length})</span></h2>
      <div className="flex flex-wrap gap-3">
        <input className={field + " max-w-sm"} value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar temas e assuntos" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)}/> Somente salvos</label>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {visibleTopics.map(t => <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">{t.title}</p><p className="text-sm text-muted">{t.synopsis}</p>
            <p className="text-xs text-muted">{t.subject} · {t.genre}</p></div>
          <div className="flex shrink-0 gap-2">
            <button className={button} disabled={busy} onClick={() => void toggleSaved(t)}>{t.saved ? "Salvo ✓" : "Salvar"}</button>
            <button className={button} disabled={busy} onClick={() => void generateScript(t)}>Gerar roteiro</button>
          </div>
        </div>)}
        {!visibleTopics.length && <p className="text-sm text-muted">Nenhum tema encontrado. Gere uma lista acima.</p>}
      </div>
    </section>

    {project && <section className={panel}>
      <h2 className="text-lg font-semibold">3. Roteiro — {activeTopic?.title || project.title}</h2>
      <p className="text-sm text-muted">12 cenas × 10 segundos = 120 segundos. Os personagens e as vozes se mantêm iguais entre cenas.</p>
      <div className="rounded-xl border border-border p-3">
        <h3 className="font-semibold">Bíblia de personagens</h3>
        {project.characters.map(c => <div key={c.name} className="mt-3 text-sm">
          <p className="font-semibold">{c.name} · {c.role}</p><p>Visual: {c.visual}</p><p>Voz: {c.voice}</p>
        </div>)}
      </div>
      <div className="space-y-4">
        {project.scenes.map((s, i) => <div key={s.number} className="rounded-xl border border-border p-3 space-y-3">
          <h3 className="font-semibold">Cena {s.number} — {s.title} · 10s</h3>
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
          <p className="text-xs text-muted">Personagens: {s.characters.join(", ")} · Transição: {s.transition || "corte"}</p>
        </div>)}
      </div>
      {project.status === "draft" ? <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void saveScript(false)}>Salvar alterações</button>
        <button className={button} disabled={busy} onClick={() => void saveScript(true)}>Aprovar roteiro e liberar prompts</button>
      </div> : <p className="font-semibold text-sm">Roteiro aprovado e congelado para manter os prompts consistentes.</p>}
    </section>}

    {project && project.status !== "draft" && <section className={panel}>
      <h2 className="text-lg font-semibold">4. Agentes de prompt</h2>
      <label className="block text-sm font-semibold">Plataforma de geração
        <select className={field + " mt-1"} value={platform} onChange={e => {setPlatform(e.target.value as Platform);setPrompts([]);}}>
          {platformOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted">O agente respeita a Bíblia de Personagens e o roteiro aprovado. YouTube Create: máximo de 900 caracteres.</p>
      <button className={button} disabled={busy} onClick={() => void generatePrompts()}>Gerar e salvar 12 prompts com Gemini</button>
      {prompts.map(p => <div className="rounded-xl border border-border p-3 space-y-2" key={p.scene}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Cena {p.scene}</h3>
          <button className={button} onClick={() => void navigator.clipboard.writeText(p.text)}>Copiar prompt</button></div>
        <p className="whitespace-pre-wrap text-sm">{p.text}</p>
        <p className={"text-xs " + (maxPrompt && p.text.length > maxPrompt ? "text-red-600" : "text-muted")}>
          {p.text.length} caracteres {maxPrompt ? "/ " + maxPrompt : ""}
        </p>
      </div>)}
    </section>}

    {project && <section className={panel}>
      <h2 className="text-lg font-semibold">5. Biblioteca de clipes</h2>
      <p className="text-sm text-muted">Importe um MP4 de cada cena. Os arquivos ficam em Storage privado. Montagem em 2 minutos e publicação serão habilitadas em uma etapa própria de integração.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {project.scenes.map(s => <label key={s.number} className="block rounded-xl border border-border p-3 text-sm">
          <span className="font-semibold">Cena {s.number}</span>
          <span className="ml-2 text-muted">{clips.some(c => c.scene_number === s.number) ? "MP4 armazenado" : "Pendente"}</span>
          <input className="mt-2 block w-full text-xs" type="file" accept="video/mp4" disabled={busy}
            onChange={e => {const file=e.currentTarget.files?.[0];void uploadClip(s.number,file);e.currentTarget.value="";}}/>
        </label>)}
      </div>
    </section>}

    <section className={panel}>
      <h2 className="text-lg font-semibold">6. Montagem e publicação</h2>
      <p className="text-sm text-muted">Preparação: unir 12 cenas com áudio sincronizado, exportar MP4 9:16 de 2 minutos e enviar por canais autorizados.</p>
      <div className="flex flex-wrap gap-2"><span className="rounded-lg border px-3 py-2 text-sm">YouTube · API de upload</span>
        <span className="rounded-lg border px-3 py-2 text-sm">TikTok · rascunho/API autorizada</span>
        <span className="rounded-lg border px-3 py-2 text-sm">Kwai · compartilhamento assistido</span></div>
      <p className="text-sm font-semibold">Publicação indisponível até integração, revisão e autorização dos canais.</p>
    </section>
    {error && <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-border p-3 text-sm">{message}</p>}
  </div>;
}

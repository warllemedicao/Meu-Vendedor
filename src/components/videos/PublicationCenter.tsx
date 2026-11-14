"use client";

import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Share2, Upload } from "lucide-react";
import { PUBLICATION_DESTINATIONS, publicationCaption, publicationPackageText, type PublicationPlatform } from "@/lib/publication-package";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { TikTokDraftUpload } from "./TikTokDraftUpload";

type VideoFile = { blob: Blob; filename: string };
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function PublicationCenter({ generated, defaultTitle = "" }: { generated: VideoFile | null; defaultTitle?: string }) {
  const { user } = useAuth();
  const [publishing, setPublishing] = useState(false);
  const [authorizationBlocked, setAuthorizationBlocked] = useState(false);
  const [platform, setPlatform] = useState<PublicationPlatform>("kwai");
  const [title, setTitle] = useState(defaultTitle);
  const [link, setLink] = useState("");
  const [hashtags, setHashtags] = useState("#Achadinhos #Ofertas #Produtos");
  const [uploaded, setUploaded] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void Promise.resolve().then(() => { if (defaultTitle) setTitle(defaultTitle); }); }, [defaultTitle]);
  const video = uploaded ? { blob: uploaded, filename: uploaded.name } : generated;
  const isMp4 = video?.blob.type === "video/mp4" || video?.filename.toLowerCase().endsWith(".mp4");
  function validate() {
    try { setError(""); return publicationCaption(title, link, hashtags); }
    catch (e) { setError(e instanceof Error ? e.message : "Revise a legenda."); return null; }
  }
  async function copy() {
    const text = validate(); if (text === null) return;
    try { await navigator.clipboard.writeText(text); setNotice("Legenda e link copiados."); }
    catch { setError("Não foi possível copiar automaticamente. Selecione o texto da legenda."); }
  }
  function downloadPackage() {
    if (!video) { setError("Gere um vídeo ou selecione um arquivo para preparar o pacote."); return; }
    if (validate() === null) return;
    saveBlob(new Blob([publicationPackageText(platform, title, link, hashtags, video.filename)], { type: "text/plain;charset=utf-8" }), "publicacao-" + platform + ".txt");
    setNotice("Arquivo de legenda e instruções baixado. Baixe também o vídeo.");
  }
  async function publishFacebook() {
    if (publishing || platform !== "facebook") return;
    if (!user) { setError("Entre na sua conta para publicar na Página."); return; }
    if (!video || !isMp4) { setError("Selecione um MP4 para publicar no Facebook."); return; }
    if (video.blob.size > 20 * 1024 * 1024) { setError("O envio direto ao Facebook aceita MP4 de até 20 MB nesta versão."); return; }
    const description = validate();
    if (description === null) return;
    if (!window.confirm("Publicar este Reel agora na Página Shopee baratinha? A publicação será pública.")) return;
    const client = getSupabase();
    if (!client) { setError("Supabase indisponível."); return; }
    const { data: { session } } = await client.auth.getSession();
    if (!session) { setError("Sua sessão expirou. Entre novamente."); return; }
    setPublishing(true); setError(""); setAuthorizationBlocked(false); setNotice("Enviando vídeo à Meta. Não feche esta página.");
    try {
      const form = new FormData();
      form.set("video", new File([video.blob], video.filename, { type: "video/mp4" }));
      form.set("description", description);
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/facebook-reels`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
        body: form,
      });
      const result = await response.json();
      if (response.status === 403 && result.code === "forbidden") {
        setAuthorizationBlocked(true);
        throw new Error("A conta conectada não corresponde ao usuário autorizado para esta Página. Confira o UID abaixo e atualize META_ALLOWED_USER_ID no Supabase, sem compartilhar tokens.");
      }
      if (!response.ok || !result.ok) throw new Error(result.message || "A Meta recusou a publicação.");
      setNotice(`Reel enviado à Meta (ID: ${result.video_id}). Confira a Página para confirmar que foi publicado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar. Confira a Página antes de tentar novamente.");
    } finally { setPublishing(false); }
  }
  async function share() {
    if (!video) { setError("Selecione um vídeo para compartilhar."); return; }
    const text = validate(); if (text === null) return;
    const file = new File([video.blob], video.filename, { type: video.blob.type || (isMp4 ? "video/mp4" : "video/webm") });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      setNotice("Compartilhamento de arquivo indisponível neste navegador. Baixe o vídeo, copie a legenda e publique pelo aplicativo.");
      return;
    }
    try { await navigator.share({ files: [file], title: title || "Vídeo do produto", text }); setNotice("Compartilhamento iniciado. Confirme a publicação no aplicativo escolhido."); }
    catch (e) { if ((e as Error).name !== "AbortError") setError("Não foi possível compartilhar. Baixe o vídeo e publique manualmente."); }
  }
  return <Card titulo="Central de Publicação · publicação assistida">
    <div className="space-y-4">
      <p className="text-sm text-muted">Prepare o vídeo, o link de afiliado e a legenda. O envio direto de Reels está disponível para Facebook. Para TikTok, envie o MP4 como rascunho e finalize no aplicativo. Nas demais redes a publicação é assistida. Links na legenda podem não ser clicáveis.</p>
      <label className="block text-sm font-medium">Rede social
        <select aria-label="Rede social de destino" value={platform} onChange={e => { setPlatform(e.target.value as PublicationPlatform); setNotice(""); }} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2">
          {(Object.keys(PUBLICATION_DESTINATIONS) as PublicationPlatform[]).map(key => <option key={key} value={key}>{PUBLICATION_DESTINATIONS[key].label}</option>)}
        </select>
      </label>
      <label className="block text-sm">Nome do produto / abertura da legenda
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" placeholder="Nome do produto" />
      </label>
      <label className="block text-sm">Link de afiliado (opcional)
        <input value={link} onChange={e => setLink(e.target.value)} type="url" maxLength={2000} placeholder="https://..." className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <label className="block text-sm">Hashtags
        <textarea value={hashtags} onChange={e => setHashtags(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <label className="block text-sm">Vídeo para publicar
        <span className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3 py-3 text-sm"><Upload className="h-4 w-4" /><span>{uploaded?.name ?? generated?.filename ?? "Escolher MP4 ou WebM (ou gerar acima)"}</span></span>
        <input type="file" accept="video/mp4,video/webm,.mp4,.webm" className="mt-2 block w-full text-xs" aria-label="Selecionar vídeo para publicação" onChange={e => { const file = e.target.files?.[0] ?? null; if (file && (!["video/mp4", "video/webm"].includes(file.type) || file.size > 150 * 1024 * 1024)) { setError("Escolha um MP4 ou WebM de até 150 MB."); e.target.value = ""; return; } setUploaded(file); setError(""); }} />
      </label>
      <p className="text-xs text-muted">{video ? (isMp4 ? "MP4 pronto para baixar." : "Arquivo WebM: não será renomeado para MP4. Use um navegador com exportação MP4 ou converta em ferramenta compatível antes de publicar.") : "Gere um vídeo acima ou selecione um vídeo já produzido."}</p>
      <p className="text-xs text-muted">{PUBLICATION_DESTINATIONS[platform].hint}</p>
      <div className="flex flex-wrap gap-2">
        {platform === "facebook" && <button type="button" disabled={!video || !isMp4 || publishing || !user} onClick={() => void publishFacebook()} className={button}><Upload className="h-4 w-4" />{publishing ? "Enviando Reel…" : "Publicar Reel no Facebook"}</button>}
        <button type="button" onClick={() => void copy()} className={button}><Copy className="h-4 w-4" />Copiar legenda e link</button>
        <button type="button" disabled={!video} onClick={() => video && saveBlob(video.blob, video.filename)} className={button}><Download className="h-4 w-4" />Baixar vídeo</button>
        <button type="button" disabled={!video} onClick={downloadPackage} className={button}><Download className="h-4 w-4" />Baixar pacote TXT</button>
        <button type="button" disabled={!video} onClick={() => void share()} className={button}><Share2 className="h-4 w-4" />Compartilhar no celular</button>
        <a href={PUBLICATION_DESTINATIONS[platform].url} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink className="h-4 w-4" />Abrir {PUBLICATION_DESTINATIONS[platform].label}</a>
      </div>
      {platform === "tiktok" && <TikTokDraftUpload video={video ?? null} />}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {authorizationBlocked && user && <div className="rounded-xl border border-border p-3 text-sm space-y-2" role="status"><p>UID da conta conectada (Supabase Auth): <code className="break-all select-all">{user.id}</code></p><button type="button" className={button} onClick={() => void navigator.clipboard.writeText(user.id).then(() => setNotice("UID copiado.")).catch(() => setError("Selecione e copie o UID exibido."))}>Copiar UID</button><p>Em Supabase → Edge Functions → Secrets, configure META_ALLOWED_USER_ID com este UUID somente se esta for a conta proprietária autorizada. Depois entre novamente e teste. Não envie token ou senha.</p></div>}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    </div>
  </Card>;
}

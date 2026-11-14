"use client";
import Image from "next/image";
import { Clapperboard, Copy, Download, ExternalLink, Sparkles, PlayCircle } from "lucide-react";
import { buildGeneratorPrompts, GENERATOR_LINKS, YOUTUBE_PROMPT_LIMIT, type CampaignGenerator } from "@/lib/campaign-generator-prompts";
import { useEffect, useRef, useState } from "react";
import { marketplaceAction } from "@/lib/marketplace";
import { useAuth } from "@/components/auth/AuthProvider";
import { affiliateUrlValid, campaignPrompt, productHashtags, storePublicationDraft, type CampaignProduct } from "@/lib/product-campaign";
import { analyzeProductCampaign, type CampaignAnalysis } from "@/lib/campaign-ai";
import { PublicationComposer } from "./PublicationComposer";
import { ManualChatGPTPrompt } from "./ManualChatGPTPrompt";
import { useManualPromptDraft } from "@/hooks/useManualPromptDraft";
import { CampaignNarration } from "./CampaignNarration";
import { virtualPresenters, presenterIdentityPrompt, type PresenterId } from "@/lib/video-studio";
const field = "mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm";
const button = "rounded-xl border border-border px-4 py-2.5 text-sm disabled:opacity-50";
const steps = ["Produto e roteiro", "Criar vídeo", "Narração e aprovação", "Compartilhar"];
type CampaignProps = { product: CampaignProduct; initialAffiliateUrl?: string; initialSpeech?: string };
type Media = { blob: Blob; filename: string; id: string };
export function ProductCampaign(props: CampaignProps) {
  const { user } = useAuth();
  return <CampaignEditor key={`${user?.id ?? "guest"}-${props.product.id}`} {...props} />;
}
function CampaignEditor({ product, initialAffiliateUrl = "", initialSpeech = "" }: CampaignProps) {
  const { user } = useAuth(); const manualPrompt = useManualPromptDraft(user?.id, "campaign:" + product.platform + ":" + product.id); const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false);
  const [linkEdit, setLinkEdit] = useState({ source: initialAffiliateUrl, value: initialAffiliateUrl });
  const affiliateUrl = linkEdit.source === initialAffiliateUrl ? linkEdit.value : initialAffiliateUrl;
  const [notes, setNotes] = useState(""), [speechEdit, setSpeechEdit] = useState<{ source: string; value: string } | null>(null), [seconds, setSeconds] = useState(8);
  const speech = speechEdit?.source === initialSpeech ? speechEdit.value : initialSpeech;
  const setSpeech = (value: string) => setSpeechEdit({ source: initialSpeech, value });
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null), [photo, setPhoto] = useState<File>();
  const [scene, setScene] = useState("Ambiente coerente com o produto e iluminação natural");
  const [generator, setGenerator] = useState<CampaignGenerator>("google-flow");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [presentation, setPresentation] = useState<"presenter" | "voiceover">("voiceover");
  const [presenterId, setPresenterId] = useState<PresenterId>("ana");
  const presenter = virtualPresenters.find(item => item.id === presenterId) ?? virtualPresenters[0];
  const fixedIdentity = presentation === "presenter" ? presenterIdentityPrompt(presenterId) : "";
  const presenterDirection = presentation === "presenter"
    ? `${fixedIdentity}\nApresentador fixo: ${presenter.name}. Identidade visual: ${presenter.visualIdentity}. Voz: ${presenter.defaultVoiceGender}, ${presenter.defaultVoiceProfile}. Atuação: ${presenter.preferences}. Use a imagem de referência do apresentador e a foto real do produto como duas referências distintas; preserve rosto, roupas, cores e embalagem. O apresentador segura ou demonstra o produto e fala exatamente o roteiro em português brasileiro. Sincronização labial depende da ferramenta externa.`
    : "Exiba o produto em destaque com enquadramentos variados e narração externa em português brasileiro. Nenhum personagem deve mover os lábios como se estivesse falando.";
  const [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [source, setSource] = useState<Media | null>(null);
  const [narrated, setNarrated] = useState<{ source: string; speech: string; media: Media } | null>(null);
  const final = narrated && narrated.source === source?.id && narrated.speech === speech ? narrated.media : null;
  useEffect(() => { if (!initialAffiliateUrl) return; const frame = requestAnimationFrame(() => { if (!dialog.current?.open) dialog.current?.showModal(); }); return () => cancelAnimationFrame(frame); }, [initialAffiliateUrl]);
  const caption = analysis ? (analysis.caption.includes(product.title) ? analysis.caption : `${product.title}\n${analysis.caption}`) : product.title;
  const hashtags = analysis?.hashtags.length ? [...new Set([...analysis.hashtags, "#Publicidade"])].join(" ") : productHashtags(product.title, product.platform);
  const generatedPrompt = analysis ? `${presenterDirection}\n\n${analysis.promptPt}

${analysis.promptEn}

DIREÇÃO APROVADA / APPROVED DIRECTION: ${scene}
Fala exata substitui as anteriores / Replace earlier dialogue and speak exactly in Brazilian Portuguese: ${JSON.stringify(speech)}` : `${presenterDirection}\n\n${campaignPrompt(product, notes, scene, speech, presentation === "presenter" ? presenter.visualIdentity : "Produto sem apresentador, narração externa")}`;
  const finalPrompt = manualPrompt.applied || generatedPrompt;
  let generatorPrompts: string[] = [];
  let generatorIssue = "";
  try {
    generatorPrompts = buildGeneratorPrompts(generator, {
      title: product.title, details: notes, scene, speech, durationSeconds: seconds,
      presentation, presenterName: presenter.name, presenterIdentity: presenter.visualIdentity,
      presenterVoice: `${presenter.defaultVoiceGender}, ${presenter.defaultVoiceProfile}`, masterPrompt: finalPrompt,
      continuityBible: presentation === "presenter" ? `${fixedIdentity}\n\n${finalPrompt}` : finalPrompt,
    });
  } catch (failure) { generatorIssue = failure instanceof Error ? failure.message : "Não foi possível preparar as cenas."; }
  const selectedPrompt = generatorPrompts[Math.min(sceneIndex, generatorPrompts.length - 1)] ?? "";
  function downloadText(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveReference(url: string, name: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Imagem indisponível");
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        const jpeg = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao converter JPEG")), "image/jpeg", 0.94));
        const href = URL.createObjectURL(jpeg);
        const anchor = document.createElement("a");
        anchor.href = href; anchor.download = name.replace(/\.(jpe?g|jfif|png|webp)$/i, "") + ".jpg"; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      } finally { bitmap.close(); }
    } catch {
      setNotice("Não foi possível converter esta imagem automaticamente. Abra a referência e salve manualmente.");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  function acceptSource(blob: Blob, filename: string) { setSource({ blob, filename, id: crypto.randomUUID() }); setNarrated(null); setError(""); setStep(2); }
  async function generateLink() {
    if (!user || busy || !product.owned) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await marketplaceAction("generate_link", { productId: product.id });
      if (!result.url || !affiliateUrlValid(result.url)) throw new Error("A Shopee não retornou um link válido. Tente novamente.");
      setLinkEdit({ source: initialAffiliateUrl, value: result.url });
      setNotice("Link gerado pela Shopee, salvo em Meus links e preenchido na divulgação.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível gerar seu link."); }
    finally { setBusy(false); }
  }
  async function analyze() {
    if (!user || busy) return; setBusy(true); setError(""); setNotice("");
    try { const value = await analyzeProductCampaign(product, user.id, notes, seconds, photo); setAnalysis(value); setSpeech(value.speech); setNarrated(null); setNotice("Foto analisada. Confira os detalhes e a fala antes de continuar."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível analisar a foto."); }
    finally { setBusy(false); }
  }
  async function approve() {
    if (!final || busy) return;
    if (!affiliateUrlValid(affiliateUrl)) { setStep(0); setError("Gere ou informe seu link de afiliado antes de preparar o compartilhamento."); return; }
    setBusy(true); setError("");
    try { if (user) await storePublicationDraft(user.id, { product, affiliateUrl, caption, hashtags, media: final.blob, filename: final.filename }); setNotice(user ? "Vídeo aprovado e rascunho salvo neste navegador." : "Vídeo aprovado. Sua divulgação está pronta para compartilhar."); }
    catch { setNotice("Vídeo aprovado. Não foi possível guardar o rascunho, mas você pode compartilhar ou baixar agora."); }
    finally { setBusy(false); setStep(3); }
  }
  return <section className="mt-5 rounded-xl border border-border bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Seu vídeo de divulgação</h2><p className="mt-1 text-sm text-muted">Foto, roteiro, narrador e publicação em quatro etapas.</p></div><button type="button" onClick={() => dialog.current?.showModal()} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">Criar vídeo ou imagem para divulgar</button></div>
    <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); }} aria-labelledby="campaign-title" className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-surface p-4"><div className="min-w-0"><h2 id="campaign-title" className="font-semibold">Criar divulgação</h2><p className="mt-1 truncate text-xs text-muted">{product.title}</p></div><button type="button" disabled={busy} onClick={() => dialog.current?.close()} className={button} aria-label="Fechar criação de divulgação">Fechar</button></header>
      <div className="p-4 sm:p-6"><ol aria-label="Etapas da divulgação" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`rounded-xl px-3 py-3 text-xs ${step === index ? "bg-primary text-white" : "bg-background text-muted"}`}>{index + 1}. {label}</li>)}</ol>
        <div hidden={step !== 0}><fieldset disabled={busy} className="min-w-0 space-y-4">
          <h3 className="text-lg font-semibold">1. Produto e fala do anúncio</h3>
          {product.imageUrl && <div className="rounded-xl bg-white p-3"><Image unoptimized width={240} height={160} src={product.imageUrl} alt={product.title} className="mx-auto h-40 max-w-full object-contain" /></div>}
          <label className="block text-sm">Seu link de divulgação<input type="url" value={affiliateUrl} onChange={e => setLinkEdit({ source: initialAffiliateUrl, value: e.target.value })} placeholder="Gere seu link no botão abaixo ou cole seu link HTTPS" className={field} /></label>
          {product.owned && product.platform === "Shopee" && <button type="button" disabled={busy || !user} onClick={() => void generateLink()} className={`${button} w-full border-primary text-primary`}>{busy ? "Aguarde…" : "Gerar meu link de divulgação"}</button>}
          <label className="block text-sm">Outra foto para a IA analisar (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setPhoto(e.target.files?.[0]); setAnalysis(null); setSpeech(""); setNarrated(null); }} className="mt-2 block w-full text-sm" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Duração do vídeo curto<select value={seconds} onChange={e => setSeconds(Number(e.target.value))} className={field}><option value={6}>6 segundos</option><option value={7}>7 segundos</option><option value={8}>8 segundos</option><option value={10}>10 segundos</option></select></label><label className="text-sm">Detalhes confirmados (opcional)<input maxLength={1500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: modelo, variante, tamanho" className={field} /></label></div>
          <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-2 text-sm font-semibold">Como será a divulgação?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm"><input type="radio" name="campaign-presentation" checked={presentation === "presenter"} onChange={() => { setPresentation("presenter"); setNarrated(null); }} />Pessoa usando ou mostrando o produto e falando</label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm"><input type="radio" name="campaign-presentation" checked={presentation === "voiceover"} onChange={() => { setPresentation("voiceover"); setNarrated(null); }} />Vídeo do produto com narração externa</label>
            </div>
            {presentation === "presenter" && <div className="space-y-2">
              <p className="text-xs text-muted">Personagens fixos do estúdio experimental: a identidade visual e as instruções de voz são reutilizadas no prompt.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{virtualPresenters.filter(item => item.referenceStatus === "ready").map(item => <button key={item.id} type="button" aria-pressed={presenterId === item.id} onClick={() => setPresenterId(item.id)} className={`rounded-xl border p-2 text-sm ${presenterId === item.id ? "border-primary bg-primary-soft" : "border-border"}`}>{item.image && <Image src={item.image} alt={item.name} width={110} height={110} className="mx-auto mb-2 h-24 w-24 rounded-lg object-cover" />}{item.name}</button>)}</div>
              <p className="text-xs text-muted">Ao usar Google Flow, anexe manualmente a imagem do produto e a imagem do personagem escolhido. O Meu Vendedor não transfere essas imagens automaticamente para o Flow.</p>
            </div>}
          </fieldset>
          <button type="button" disabled={busy || !user} onClick={() => void analyze()} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Analisando a foto e criando a divulgação…" : "Analisar foto e criar roteiro com IA"}</button>
          {!user && <p className="text-sm text-muted">Entre na conta para analisar a imagem e gerar a voz.</p>}
          <ManualChatGPTPrompt draft={manualPrompt} brief={{ name: product.title, store: product.platform, features: notes, benefits: analysis?.benefits.join("; "), videoType: "Vídeo gerado por IA em cenas independentes (Google Flow, Dreamina ou YouTube Create)", duration: `${seconds} segundos de fala`, format: "9:16", character: presentation === "presenter" ? `${presenter.name}: ${presenter.visualIdentity}. ${presenter.preferences}. Foto de referência: ${presenter.image ?? "indisponível"}` : "Sem personagem; somente produto", presentationStyle: `${scene}. ${presenterDirection}` }} />
          {manualPrompt.applied && <label className="block text-sm">Direção manual em uso no vídeo<textarea readOnly value={manualPrompt.applied} rows={5} className={field} /></label>}
          {analysis && <div className="space-y-2 rounded-xl bg-background p-4 text-sm"><p>{analysis.details}</p>{analysis.benefits.length > 0 && <ul className="list-disc space-y-1 pl-5">{analysis.benefits.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
          <label className="block text-sm">Fala do narrador · confira e ajuste<textarea value={speech} maxLength={1500} onChange={e => { setSpeech(e.target.value); setNarrated(null); }} rows={4} placeholder="A IA preenche ao analisar a foto. Você também pode escrever sua fala." className={field} /></label>
          <button type="button" disabled={busy || !speech.trim()} onClick={() => { setStep(1); setError(""); }} className={`${button} w-full`}>Aprovar roteiro e escolher o vídeo</button>
        </fieldset></div>
        <div hidden={step !== 1} className="space-y-4">
          <h3 className="text-lg font-semibold">2. Gere seu vídeo com IA</h3>
          <div className="space-y-4">
            <p className="text-sm text-muted">Escolha o gerador. O Meu Vendedor prepara um prompt por cena e as referências do produto e do personagem. Os sites externos não recebem os arquivos automaticamente.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gerador de vídeo">
              <button type="button" title="Google Flow" aria-label="Selecionar Google Flow" aria-pressed={generator === "google-flow"} onClick={() => { setGenerator("google-flow"); setSceneIndex(0); }} className={`${button} ${generator === "google-flow" ? "border-primary bg-primary-soft" : ""}`}><Clapperboard className="h-6 w-6" /></button>
              <button type="button" title="Dreamina" aria-label="Selecionar Dreamina" aria-pressed={generator === "dreamina"} onClick={() => { setGenerator("dreamina"); setSceneIndex(0); }} className={`${button} ${generator === "dreamina" ? "border-primary bg-primary-soft" : ""}`}><Sparkles className="h-6 w-6" /></button>
              <button type="button" title="YouTube Create: editor móvel, não gerador web" aria-label="Selecionar YouTube Create" aria-pressed={generator === "youtube-create"} onClick={() => { setGenerator("youtube-create"); setSceneIndex(0); }} className={`${button} ${generator === "youtube-create" ? "border-primary bg-primary-soft" : ""}`}><PlayCircle className="h-6 w-6" /></button>
              <a href={GENERATOR_LINKS[generator]} target="_blank" rel="noopener noreferrer" title="Abrir gerador selecionado" aria-label="Abrir gerador selecionado" className={`${button} border-primary text-primary`}><ExternalLink className="h-5 w-5" /></a>
            </div>
            {generator === "youtube-create" && <p className="text-xs text-muted">YouTube Create não possui um gerador web equivalente ao Flow. O link abre as instruções oficiais para instalar o aplicativo móvel; para criar vídeos por prompt no navegador, escolha Google Flow ou Dreamina.</p>}
            <label className="block text-sm">Cenário<input value={scene} onChange={e => setScene(e.target.value)} className={field}/></label>
            {generatorIssue ? <p role="alert" className="text-sm text-danger">{generatorIssue}</p> : <div className="space-y-2">
              <p className="text-sm font-medium">Prompt único do anúncio · {seconds} segundos</p>
              <textarea aria-label="Prompt otimizado para o gerador selecionado" readOnly rows={10} value={selectedPrompt} className={field}/>
              <p className="text-xs text-muted">{selectedPrompt.length} caracteres{generator === "youtube-create" ? ` / ${YOUTUBE_PROMPT_LIMIT}` : ""}. Um vídeo por anúncio; use a foto original do produto e do personagem.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(selectedPrompt); setNotice("Prompt da cena copiado."); } catch { setNotice("Selecione o prompt acima e copie manualmente."); } }} className={button} title="Copiar prompt da cena"><Copy className="inline h-4 w-4" /> Copiar prompt</button>
                <button type="button" onClick={() => downloadText(generatorPrompts.map((prompt, index) => `CENA ${index + 1}\n${prompt}`).join("\n\n---\n\n"), "prompts-divulgacao.txt")} className={button}><Download className="inline h-4 w-4" /> Baixar prompts</button>
              </div>
            </div>}
            <div className="flex flex-wrap gap-2">
              {product.imageUrl && <button type="button" onClick={() => void saveReference(product.imageUrl!, "produto-referencia")} className={button}><Download className="inline h-4 w-4" /> Foto do produto</button>}
              {photo && <button type="button" onClick={() => { const url = URL.createObjectURL(photo); const anchor = document.createElement("a"); anchor.href = url; anchor.download = photo.name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }} className={button}><Download className="inline h-4 w-4" /> Foto enviada</button>}
              {presentation === "presenter" && presenter.image && <button type="button" onClick={() => void saveReference(presenter.image!, `personagem-${presenter.id}.webp`)} className={button}><Download className="inline h-4 w-4" /> Foto de {presenter.name}</button>}
            </div>
            <p className="text-xs text-muted">Anexe as imagens no gerador externo e cole o prompt da cena. Se o download da imagem do marketplace for bloqueado pelo servidor de origem, abra a imagem e salve-a manualmente. Depois importe o vídeo gerado abaixo.</p>
          </div>
          <label className="block rounded-xl border border-dashed border-border p-4 text-sm">Importe o vídeo gerado (ou uma imagem pronta)<input type="file" disabled={busy} accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" className="mt-2 block w-full" onChange={e => { const file = e.target.files?.[0]; if (file) { if (!["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 150 * 1024 * 1024) setError("Use MP4, WebM, JPG, PNG ou WebP de até 150 MB."); else acceptSource(file, file.name); } e.target.value = ""; }}/></label>
          {source && <button type="button" disabled={busy} onClick={() => setStep(2)} className={button}>Continuar com o vídeo escolhido</button>}
        </div>
        {source && <div hidden={step !== 2} className="space-y-5"><h3 className="text-lg font-semibold">3. Ouça e aprove seu vídeo</h3>{presentation === "presenter" && <p className="rounded-lg border border-border p-3 text-sm text-muted">A narração adicionada aqui é uma faixa de áudio externa. Para que {presenter.name} apareça falando com movimento labial, gere e importe um vídeo já sincronizado na ferramenta externa.</p>}<CampaignNarration key={`${source.id}-${speech}`} source={source} speech={speech} onBusy={setBusy} onReady={media => setNarrated(media ? { source: source.id, speech, media: { ...media, id: crypto.randomUUID() } } : null)} />{final && <><MediaPreview media={final.blob}/><button type="button" disabled={busy} onClick={() => void approve()} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">Aprovar vídeo e preparar compartilhamento</button></>}</div>}
        {step === 3 && final && <PublicationComposer key={final.id} product={product} affiliateUrl={affiliateUrl} media={final.blob} filename={final.filename} initialCaption={caption} initialHashtags={hashtags} />}
        {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-primary">{notice}</p>}
        {step > 0 && <button type="button" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }} className={`${button} mt-5`}>Voltar</button>}
      </div>
    </dialog>
  </section>;
}
function MediaPreview({ media }: { media: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(media); const frame = requestAnimationFrame(() => setUrl(value)); return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(value); }; }, [media]);
  return url ? <video src={url} controls playsInline className="mx-auto max-h-96 w-full rounded-xl bg-background" /> : null;
}

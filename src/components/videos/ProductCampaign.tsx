"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { marketplaceAction } from "@/lib/marketplace";
import { useAuth } from "@/components/auth/AuthProvider";
import { affiliateUrlValid, campaignPrompt, productHashtags, storePublicationDraft, type CampaignProduct } from "@/lib/product-campaign";
import { analyzeProductCampaign, type CampaignAnalysis } from "@/lib/campaign-ai";
import { ProductVideoStudio } from "./ProductVideoStudio";
import { PublicationComposer } from "./PublicationComposer";
import { ManualChatGPTPrompt } from "./ManualChatGPTPrompt";
import { useManualPromptDraft } from "@/hooks/useManualPromptDraft";
import { CampaignNarration } from "./CampaignNarration";
import { virtualPresenters, type PresenterId } from "@/lib/video-studio";
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
  const [step, setStep] = useState(0), [mode, setMode] = useState("montage"), [busy, setBusy] = useState(false);
  const [linkEdit, setLinkEdit] = useState({ source: initialAffiliateUrl, value: initialAffiliateUrl });
  const affiliateUrl = linkEdit.source === initialAffiliateUrl ? linkEdit.value : initialAffiliateUrl;
  const [notes, setNotes] = useState(""), [speechEdit, setSpeechEdit] = useState<{ source: string; value: string } | null>(null), [seconds, setSeconds] = useState(15);
  const speech = speechEdit?.source === initialSpeech ? speechEdit.value : initialSpeech;
  const setSpeech = (value: string) => setSpeechEdit({ source: initialSpeech, value });
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null), [photo, setPhoto] = useState<File>();
  const [scene, setScene] = useState("Ambiente coerente com o produto e iluminação natural");
  const [presentation, setPresentation] = useState<"presenter" | "voiceover">("voiceover");
  const [presenterId, setPresenterId] = useState<PresenterId>("ana");
  const presenter = virtualPresenters.find(item => item.id === presenterId) ?? virtualPresenters[0];
  const presenterDirection = presentation === "presenter"
    ? `Apresentador fixo: ${presenter.name}. Identidade visual: ${presenter.visualIdentity}. Voz: ${presenter.defaultVoiceGender}, ${presenter.defaultVoiceProfile}. Atuação: ${presenter.preferences}. Use a imagem de referência do apresentador e a foto real do produto como duas referências distintas; preserve rosto, roupas, cores e embalagem. O apresentador segura ou demonstra o produto e fala exatamente o roteiro em português brasileiro. Sincronização labial depende da ferramenta externa.`
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
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Duração aproximada da fala<select value={seconds} onChange={e => setSeconds(Number(e.target.value))} className={field}><option value={15}>15 segundos · apresentação rápida</option><option value={30}>30 segundos · mais detalhes</option></select></label><label className="text-sm">Detalhes confirmados (opcional)<input maxLength={1500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: modelo, variante, tamanho" className={field} /></label></div>
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
          <ManualChatGPTPrompt draft={manualPrompt} brief={{ name: product.title, store: product.platform, features: notes, benefits: analysis?.benefits.join("; "), videoType: mode === "montage" ? "Montagem com fotos e clipes" : "Vídeo externo no Flow", duration: `${seconds} segundos de fala`, format: "9:16", character: presentation === "presenter" ? `${presenter.name}: ${presenter.visualIdentity}. ${presenter.preferences}. Foto de referência: ${presenter.image ?? "indisponível"}` : "Sem personagem; somente produto", presentationStyle: `${scene}. ${presenterDirection}` }} />
          {manualPrompt.applied && <label className="block text-sm">Direção manual em uso no vídeo<textarea readOnly value={manualPrompt.applied} rows={5} className={field} /></label>}
          {analysis && <div className="space-y-2 rounded-xl bg-background p-4 text-sm"><p>{analysis.details}</p>{analysis.benefits.length > 0 && <ul className="list-disc space-y-1 pl-5">{analysis.benefits.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
          <label className="block text-sm">Fala do narrador · confira e ajuste<textarea value={speech} maxLength={1500} onChange={e => { setSpeech(e.target.value); setNarrated(null); }} rows={4} placeholder="A IA preenche ao analisar a foto. Você também pode escrever sua fala." className={field} /></label>
          <button type="button" disabled={busy || !speech.trim()} onClick={() => { setStep(1); setError(""); }} className={`${button} w-full`}>Aprovar roteiro e escolher o vídeo</button>
        </fieldset></div>
        <div hidden={step !== 1} className="space-y-4">
          <h3 className="text-lg font-semibold">2. Escolha como criar o vídeo</h3>
          <div className="flex flex-wrap gap-2">{[["montage", "Montar com fotos e clipes"], ["ai", "Criar no Flow / importar vídeo"]].map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} disabled={busy} onClick={() => setMode(id)} className={`${button} ${mode === id ? "border-primary text-primary" : ""}`}>{label}</button>)}</div>
          <div hidden={mode !== "montage"}><ProductVideoStudio key={`${user?.id ?? "guest"}-${product.id}`} onBusyChange={setBusy} active={step === 1 && mode === "montage"} initialProduct={product} embedded onResult={acceptSource} /></div>
          {mode === "ai" && <div className="space-y-3"><p className="text-sm text-muted">Use o prompt preparado com a foto do produto e, se selecionado, o personagem fixo no Flow. Depois importe aqui para aplicar a voz e preparar a publicação.</p><label className="block text-sm">Cenário<input value={scene} onChange={e => setScene(e.target.value)} className={field}/></label><details><summary className="cursor-pointer text-sm text-primary">Prompt para criar o vídeo</summary><textarea aria-label="Prompt de divulgação" readOnly rows={9} value={finalPrompt} className={field}/>{analysis && <><label className="block text-sm">Prompt final em português<textarea readOnly value={analysis.promptPt} rows={5} className={field}/></label><label className="block text-sm">Prompt final em inglês<textarea readOnly value={analysis.promptEn} rows={5} className={field}/></label></>}</details><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(finalPrompt); setNotice("Prompt copiado."); } catch { setNotice("Selecione o texto do prompt e copie."); } }} className={button}>Copiar prompt</button>{presentation === "presenter" && presenter.image && <a href={presenter.image} target="_blank" rel="noopener noreferrer" className={`${button} inline-block`}>Abrir foto de {presenter.name}</a>}<a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" className={`${button} inline-block`}>Abrir Flow</a></div>}
          <label className="block rounded-xl border border-dashed border-border p-4 text-sm">Ou importe seu vídeo ou imagem pronta<input type="file" disabled={busy} accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" className="mt-2 block w-full" onChange={e => { const file = e.target.files?.[0]; if (file) { if (!["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 150 * 1024 * 1024) setError("Use MP4, WebM, JPG, PNG ou WebP de até 150 MB."); else acceptSource(file, file.name); } e.target.value = ""; }}/></label>
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

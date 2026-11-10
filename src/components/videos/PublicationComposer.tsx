"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { affiliateUrlValid, campaignCaption, storePublicationDraft, type CampaignProduct } from "@/lib/product-campaign";
const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";
export function PublicationComposer({ product, affiliateUrl, media, filename, initialCaption, initialHashtags }: { product: CampaignProduct; affiliateUrl: string; media: Blob; filename: string; initialCaption?: string; initialHashtags?: string }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState(initialCaption ?? product.title), [hashtags, setHashtags] = useState(initialHashtags ?? (product.platform === "Shopee" ? "#Achadinhos #Shopee #Publicidade" : "#Achadinhos #Publicidade"));
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(media); const frame = requestAnimationFrame(() => setUrl(value)); return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(value); }; }, [media]);
  const text = campaignCaption(caption, affiliateUrl, hashtags);
  const valid = affiliateUrlValid(affiliateUrl);
  async function save() { if (!user || !valid) return; setBusy(true); try { await storePublicationDraft(user.id, { product, affiliateUrl, media, filename, caption, hashtags }); setNotice("Rascunho com mídia e link salvo neste navegador. Abra Publicações para continuar."); } catch { setNotice("Não foi possível salvar o rascunho. Baixe a mídia e copie a legenda."); } finally { setBusy(false); } }
  async function share() {
    if (!valid) return;
    const file = new File([media], filename, { type: media.type });
    try { if (!navigator.canShare?.({ files: [file] })) { setNotice("Este navegador não compartilha arquivos. Baixe a mídia e copie a legenda para publicar na Shopee."); return; } await navigator.share({ files: [file], title: product.title, text }); setNotice("Compartilhamento enviado ao dispositivo. Confirme a publicação no aplicativo escolhido."); } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setNotice("Não foi possível compartilhar. Baixe a mídia e copie a legenda."); }
  }
  return <section className="space-y-3 rounded-xl border border-primary p-4" aria-label="Preparar publicação">
    <h3 className="font-semibold">Publicação com seu link de vendedor</h3>
    {url && (media.type.startsWith("video/") ? <video src={url} controls playsInline className="max-h-80 w-full rounded-lg" /> : <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Conferir imagem</a>)}
    <label className="block text-sm">Legenda<textarea value={caption} onChange={e => setCaption(e.target.value)} className={field} /></label>
    <label className="block text-sm">Hashtags<input value={hashtags} onChange={e => setHashtags(e.target.value)} className={field} /></label>
    <p className="break-all text-sm">Link de afiliado: {affiliateUrl || "Gere ou informe seu link antes de compartilhar."}</p>
    {!valid && <p className="text-sm text-muted">Adicione um link HTTPS válido na criação da divulgação.</p>}
    <textarea aria-label="Texto completo da publicação" readOnly value={text} className={field} rows={5} />
    <div className="flex flex-wrap gap-3 text-sm">
      <a href={url || undefined} download={filename} className="text-primary underline">Baixar mídia</a>
      <button type="button" disabled={!valid} onClick={async () => { try { await navigator.clipboard.writeText(text); setNotice("Legenda, hashtags e link copiados."); } catch { setNotice("Selecione e copie o texto completo acima."); } }} className="text-primary underline disabled:opacity-50">Copiar publicação</button>
      <button type="button" disabled={!valid} onClick={() => void share()} className="text-primary underline disabled:opacity-50">Compartilhar mídia e link</button>
      {user && <button type="button" disabled={!valid || busy} onClick={() => void save()} className="text-primary underline disabled:opacity-50">{busy ? "Salvando…" : "Salvar rascunho"}</button>}
    </div>
    <p className="text-xs text-muted">Na Shopee: Compartilhe para ganhar → Shopee Vídeo → selecione a mídia → adicione legenda e produto → confira e poste. O compartilhamento depende dos aplicativos do dispositivo; a integração atual não envia posts diretamente ao Shopee Vídeo.</p>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </section>;
}

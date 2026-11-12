"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  affiliateUrlValid, campaignCaption, storePublicationDraft, productHashtags,
  type CampaignProduct,
} from "@/lib/product-campaign";
import {
  browserTimeZone, localDateTimeToIso, publicationDestinations, publicationScheduleRequest,
  publicationTimeZones, uploadPublicationMedia,
} from "@/lib/publication-scheduling";
import { sharePublication, shopeeProductDestination } from "@/lib/publication-share";

const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";

export function PublicationComposer({
  product, affiliateUrl, media, filename, initialCaption, initialHashtags, initialTitle,
}: {
  product: CampaignProduct;
  affiliateUrl: string;
  media: Blob;
  filename: string;
  initialCaption?: string;
  initialHashtags?: string;
  initialTitle?: string;
}) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [publicationTitle, setPublicationTitle] = useState(initialTitle ?? product.title);
  const [caption, setCaption] = useState(initialCaption ?? product.title);
  const [hashtags, setHashtags] = useState(initialHashtags ?? productHashtags(product.title, product.platform));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [choosingSchedule, setChoosingSchedule] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([
    product.platform === "Shopee" ? "shopee_video" : "pinterest",
  ]);
  const [mediaPath, setMediaPath] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const text = campaignCaption(caption, affiliateUrl, hashtags);
  const valid = affiliateUrlValid(affiliateUrl);
  const shopee = product.platform === "Shopee";
  const productDestination = shopeeProductDestination(product.productUrl);
  const destinations = publicationDestinations.filter(option => option.id !== "shopee_video" || shopee);
  const timeZones = publicationTimeZones(timeZone);

  useEffect(() => {
    const value = URL.createObjectURL(media);
    const frame = requestAnimationFrame(() => setUrl(value));
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(value); };
  }, [media]);

  function invalidateKey() {
    if (idempotencyKey) setIdempotencyKey(crypto.randomUUID());
  }

  async function shareNow() {
    if (!valid) return;
    setBusy(true);
    try {
      const file = new File([media], filename, { type: media.type });
      const result = await sharePublication(navigator, { files: [file], title: publicationTitle, text });
      if (result === "shared") setNotice(shopee
        ? "Compartilhamento entregue ao dispositivo. Na Shopee, confira o vídeo e a legenda, vincule o produto e toque em Postar. A postagem ainda não foi confirmada pelo Meu Vendedor."
        : "Compartilhamento entregue ao dispositivo. Conclua a postagem no aplicativo escolhido.");
      if (result === "unsupported" || result === "failed") setNotice(shopee
        ? "Baixe o vídeo e copie a publicação. Abra a Shopee → Live e Vídeos → Vídeos → +, selecione o arquivo, cole a legenda e vincule o produto antes de postar."
        : "Não foi possível compartilhar neste navegador. Baixe a mídia e copie a publicação.");
    } finally { setBusy(false); }
  }

  async function save(status: "draft" | "scheduled") {
    if (!user || !valid || busy) return;
    setBusy(true);
    setNotice("");
    let localSaved = false;
    try {
      try {
        await storePublicationDraft(user.id, {
          product, affiliateUrl, media, filename, caption, hashtags, publicationTitle,
        });
        localSaved = true;
      } catch { localSaved = false; }
      let scheduledAt: string | null = null;
      if (status === "scheduled") scheduledAt = localDateTimeToIso(dateTime, timeZone);
      if (!selectedDestinations.length) throw new Error("Selecione pelo menos um destino para a publicação.");
      const savedPath = mediaPath || await uploadPublicationMedia(user.id, new File([media], filename, { type: media.type }));
      if (!mediaPath) setMediaPath(savedPath);
      const requestKey = idempotencyKey || crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(requestKey);
      await publicationScheduleRequest({
        action: "create",
        destinations: selectedDestinations,
        idempotencyKey: requestKey,
        productId: product.id,
        productTitle: product.title,
        sourceMarketplace: product.platform,
        affiliateUrl,
        publicationTitle,
        caption,
        hashtags,
        mediaPath: savedPath,
        mediaType: media.type,
        mediaFilename: filename,
        status,
        scheduledAt,
        timezone: timeZone,
      });
      setIdempotencyKey("");
      setNotice(status === "scheduled"
        ? `Agendamento salvo no painel. Ele ficará aguardando sua ação manual no horário escolhido; o Meu Vendedor não publicará automaticamente.${localSaved ? " Uma cópia também foi mantida neste navegador." : ""}`
        : `Rascunho salvo na sua conta.${localSaved ? " Uma cópia também foi mantida neste navegador." : ""}`);
      setDateTime("");
      dialog.current?.close();
    } catch (failure) {
      setNotice(failure instanceof Error
        ? `Não foi possível salvar na sua conta: ${failure.message}${localSaved ? " O rascunho local foi preservado neste navegador." : ""}`
        : `Não foi possível salvar na sua conta.${localSaved ? " O rascunho local foi preservado neste navegador." : ""}`);
    } finally { setBusy(false); }
  }

  function toggleDestination(destination: string) {
    invalidateKey();
    setSelectedDestinations(current => current.includes(destination)
      ? current.filter(item => item !== destination)
      : [...current, destination]);
  }

  return <section className="space-y-3 rounded-xl border border-primary p-4" aria-label="Preparar publicação">
    <h3 className="text-lg font-semibold">{shopee ? "Compartilhar na Shopee · Live e Vídeos" : "Tudo pronto para compartilhar"}</h3>
    {shopee && <div className="space-y-2 rounded-xl bg-background p-3 text-sm">
      <p className="font-semibold">Destino: Shopee → Live e Vídeos → Vídeos</p>
      <p>O botão abre as opções de compartilhamento do seu dispositivo. Se a Shopee aparecer, selecione-a. Confira a legenda e adicione este produto ao vídeo antes de tocar em Postar.</p>
      <p>Se a Shopee não aparecer, baixe o vídeo e copie a publicação. No app Shopee, abra Live e Vídeos → Vídeos → + e selecione o arquivo da galeria.</p>
      <p className="text-xs text-muted">O aplicativo receptor pode não preencher o texto automaticamente. Use Copiar publicação para colar a legenda. O produto deve ser vinculado ao vídeo; o link na legenda não substitui essa etapa.</p>
    </div>}
    {url && (media.type.startsWith("video/")
      ? <video src={url} controls playsInline className="max-h-80 w-full rounded-lg" />
      : <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Conferir imagem</a>)}
    <label className="block text-sm">Título da publicação
      <input value={publicationTitle} maxLength={200} onChange={event => { invalidateKey(); setPublicationTitle(event.target.value); }} className={field} />
    </label>
    <label className="block text-sm">Descrição / legenda
      <textarea value={caption} maxLength={5000} onChange={event => { invalidateKey(); setCaption(event.target.value); }} className={field} />
    </label>
    <label className="block text-sm">Hashtags
      <input value={hashtags} maxLength={1000} onChange={event => { invalidateKey(); setHashtags(event.target.value); }} className={field} />
    </label>
    {shopee && <div className="space-y-2 text-sm">
      <label className="block">Produto para vincular na Shopee
        <input readOnly value={product.title} onFocus={event => event.target.select()} className={field} />
      </label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(product.title); setNotice("Nome do produto copiado. Use-o para localizar e vincular o produto no vídeo da Shopee."); }
        catch { setNotice("Selecione e copie o nome do produto acima."); }
      }} className="text-primary underline">Copiar nome do produto</button>
      {productDestination && <a href={productDestination} target="_blank" rel="noopener noreferrer" className="ml-3 inline-block text-primary underline">Abrir produto na Shopee</a>}
    </div>}
    <p className="break-all text-sm">Link de afiliado: {affiliateUrl || "Gere ou informe seu link antes de compartilhar."}</p>
    {!valid && <p className="text-sm text-muted">Adicione um link HTTPS válido na criação da divulgação.</p>}
    <textarea aria-label="Texto completo da publicação" readOnly value={text} className={field} rows={5} />
    <div className="flex flex-wrap gap-3 text-sm">
      <a href={url || undefined} download={filename} className="text-primary underline">Baixar mídia</a>
      <button type="button" disabled={!valid} onClick={async () => {
        try { await navigator.clipboard.writeText(text); setNotice("Legenda, hashtags e link copiados."); }
        catch { setNotice("Selecione e copie o texto completo acima."); }
      }} className="text-primary underline disabled:opacity-50">Copiar publicação</button>
      <button type="button" disabled={!valid || busy} onClick={() => {
        setChoosingSchedule(false);
        dialog.current?.showModal();
      }} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">
        Publicar agora ou programar
      </button>
      {!shopee && valid && <a href={`https://www.pinterest.com/pin-builder/?url=${encodeURIComponent(affiliateUrl)}&description=${encodeURIComponent(caption + " " + hashtags)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">Abrir criador de Pin no Pinterest</a>}
      {!shopee && <p className="w-full text-xs text-muted">Baixe a mídia e envie-a ao Pinterest manualmente. O criador de Pin pode não preencher o link automaticamente; confira o destino e identifique a publicidade antes de publicar.</p>}
      {user && <button type="button" disabled={!valid || busy} onClick={() => void save("draft")} className="text-primary underline disabled:opacity-50">
        {busy ? "Salvando…" : "Salvar rascunho na conta"}
      </button>}
    </div>
    {shopee && <details className="text-xs text-muted"><summary className="cursor-pointer text-primary">Sobre a publicação direta</summary><p className="mt-2">O acesso Shopee conectado permite consultar produtos e gerar links. Envio automático ao Shopee Vídeo precisa de uma autorização específica de vídeo, ainda não conectada ao Meu Vendedor. Compartilhar não confirma a postagem. Esta etapa prepara um vídeo gravado para a aba Vídeos de Live e Vídeos.</p></details>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); }} aria-label="Publicar agora ou programar" className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-foreground shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{choosingSchedule ? "Programar publicação" : "Publicar agora ou programar"}</h3>
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="text-primary underline">Fechar</button>
      </div>
      {!choosingSchedule ? <div className="mt-5 space-y-3">
        <p className="text-sm text-muted">A publicação atual é manual. O compartilhamento abre o aplicativo de destino, mas não confirma que a postagem foi concluída.</p>
        <button type="button" disabled={busy} onClick={() => void shareNow()} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white">
          {busy ? "Abrindo compartilhamento…" : "Compartilhar agora"}
        </button>
        <button type="button" onClick={() => setChoosingSchedule(true)} className="w-full rounded-xl border border-border px-4 py-3">
          Programar para depois
        </button>
        {!user && <p className="text-sm text-muted">Entre na sua conta para salvar rascunhos e agendamentos.</p>}
      </div> : <div className="mt-5 space-y-4">
        <fieldset disabled={busy || !user} className="space-y-4">
          <legend className="font-medium">Destinos · todos aguardam ação manual</legend>
          {destinations.map(option => <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedDestinations.includes(option.id)} onChange={() => toggleDestination(option.id)} />
            {option.label}
          </label>)}
          <label className="block text-sm">Data e horário
            <input type="datetime-local" value={dateTime} onChange={event => { invalidateKey(); setDateTime(event.target.value); }} className={field} />
          </label>
          <label className="block text-sm">Fuso horário
            <select value={timeZone} onChange={event => { invalidateKey(); setTimeZone(event.target.value); }} className={field}>
              {timeZones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted">No horário programado, o painel marcará “Aguardando ação manual”. Nenhum destino será publicado automaticamente.</p>
          <button type="button" disabled={!user || busy || !valid} onClick={() => void save("scheduled")} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? "Salvando…" : "Salvar agendamento"}
          </button>
          <button type="button" disabled={!user || busy || !valid} onClick={() => void save("draft")} className="w-full rounded-xl border border-border px-4 py-3 disabled:opacity-50">
            Salvar como rascunho
          </button>
        </fieldset>
        {!user && <p className="text-sm text-muted">Entre na sua conta para agendar.</p>}
      </div>}
    </dialog>
  </section>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  browserTimeZone, formatPublicationDate, isoToLocalDateTime, localDateTimeToIso,
  publicationDestinations, publicationScheduleRequest, publicationStatusLabel,
  publicationTimeZones, type PublicationAction, type PublicationRecord,
  type PublicationStatus, uploadPublicationMedia,
} from "@/lib/publication-scheduling";
import { campaignCaption } from "@/lib/product-campaign";
import { sharePublication } from "@/lib/publication-share";
import { getSupabase } from "@/lib/supabase/client";

const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";
const statusOrder: PublicationStatus[] = ["draft", "scheduled", "awaiting_manual_action", "processing", "published", "failed", "cancelled"];

function isRecord(value: unknown): value is PublicationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PublicationRecord>;
  return typeof record.id === "string" && typeof record.status === "string"
    && typeof record.product_title === "string" && typeof record.media_path === "string"
    && Array.isArray(record.attempts);
}

function messageFrom(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

export function PublicationScheduleBoard({ userId }: { userId: string }) {
  const [items, setItems] = useState<PublicationRecord[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const client = getSupabase();
    if (!client) throw new Error("O serviço de agendamento não está configurado.");
    const payload = await publicationScheduleRequest({ action: "list" });
    if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)
      || !payload.items.every(isRecord)) throw new Error("O painel recebeu uma resposta inválida.");
    const next = payload.items;
    const urls = await Promise.all(next.map(async item => {
      const { data, error: signingError } = await client.storage.from("mv-video-assets").createSignedUrl(item.media_path, 300);
      if (signingError || !data?.signedUrl) throw new Error("Não foi possível acessar uma mídia privada do painel.");
      return [item.id, data.signedUrl] as const;
    }));
    setItems(next);
    setMediaUrls(Object.fromEntries(urls));
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try { await refresh(); }
      catch (failure) { if (active) setError(messageFrom(failure, "Não foi possível carregar os agendamentos.")); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [refresh]);

  async function completeAction(id: string, action: PublicationAction) {
    const requestKey = crypto.randomUUID();
    await publicationScheduleRequest({ action: "interaction", id, interaction: action, requestKey });
    await refresh();
  }

  const counts = Object.fromEntries(statusOrder.map(status => [status, items.filter(item => item.status === status).length])) as Record<PublicationStatus, number>;
  if (loading) return <p role="status">Carregando painel de publicações…</p>;
  return <section className="space-y-4 rounded-xl border border-border bg-surface p-4" aria-label="Painel de agendamentos">
    <div>
      <h2 className="text-xl font-semibold">Painel de agendamentos</h2>
      <p className="mt-1 text-sm text-muted">As publicações são assistidas. O horário vencido solicita sua ação; não confirma postagem automática.</p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Resumo por estado">
      {statusOrder.map(status => <span key={status} className="rounded-full bg-background px-3 py-1 text-xs">
        {publicationStatusLabel(status)}: {counts[status]}
      </span>)}
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!items.length && !error && <p className="text-sm text-muted">Ainda não há publicações salvas na sua conta.</p>}
    <div className="space-y-3">
      {items.map(item => <PublicationCard key={item.id} item={item} mediaUrl={mediaUrls[item.id]} userId={userId} onRefresh={refresh} onAction={completeAction} />)}
    </div>
  </section>;
}

function PublicationCard({
  item, mediaUrl, userId, onRefresh, onAction,
}: {
  item: PublicationRecord;
  mediaUrl?: string;
  userId: string;
  onRefresh(): Promise<void>;
  onAction(id: string, action: PublicationAction): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [productTitle, setProductTitle] = useState(item.product_title);
  const [sourceMarketplace, setSourceMarketplace] = useState(item.source_marketplace);
  const [affiliateUrl, setAffiliateUrl] = useState(item.affiliate_url);
  const [publicationTitle, setPublicationTitle] = useState(item.publication_title);
  const [caption, setCaption] = useState(item.caption);
  const [hashtags, setHashtags] = useState(item.hashtags);
  const [destination, setDestination] = useState(item.destination);
  const [dateTime, setDateTime] = useState(item.scheduled_at ? isoToLocalDateTime(item.scheduled_at, item.timezone) : "");
  const [timeZone, setTimeZone] = useState(item.timezone || browserTimeZone);
  const [replacement, setReplacement] = useState<File | null>(null);
  const choices = publicationTimeZones(timeZone);
  const canEdit = ["draft", "scheduled", "awaiting_manual_action", "failed"].includes(item.status);
  const canCancel = canEdit;

  function beginEdit() {
    setProductTitle(item.product_title);
    setSourceMarketplace(item.source_marketplace);
    setAffiliateUrl(item.affiliate_url);
    setPublicationTitle(item.publication_title);
    setCaption(item.caption);
    setHashtags(item.hashtags);
    setDestination(item.destination);
    setDateTime(item.scheduled_at ? isoToLocalDateTime(item.scheduled_at, item.timezone) : "");
    setTimeZone(item.timezone || browserTimeZone());
    setReplacement(null);
    setEditing(true);
    setError("");
    setNotice("");
  }

  async function saveEdit() {
    setBusy(true); setError(""); setNotice("");
    try {
      const scheduledAt = item.status === "draft" && !dateTime
        ? null
        : localDateTimeToIso(dateTime, timeZone);
      const status = scheduledAt ? "scheduled" : "draft";
      const mediaPath = replacement ? await uploadPublicationMedia(userId, replacement) : item.media_path;
      await publicationScheduleRequest({
        action: "update",
        id: item.id,
        productId: item.product_id,
        productTitle,
        sourceMarketplace,
        affiliateUrl,
        publicationTitle,
        caption,
        hashtags,
        destination,
        mediaPath,
        mediaType: replacement?.type ?? item.media_type,
        mediaFilename: replacement?.name ?? item.media_filename,
        status,
        scheduledAt,
        timezone: timeZone,
        idempotencyKey: item.idempotency_key,
      });
      setEditing(false);
      setReplacement(null);
      setNotice("Alterações salvas. O agendamento continua assistido.");
      await onRefresh();
    } catch (failure) { setError(messageFrom(failure, "Não foi possível salvar as alterações.")); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!window.confirm("Cancelar esta publicação?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await publicationScheduleRequest({ action: "cancel", id: item.id });
      setNotice("Publicação cancelada.");
      await onRefresh();
    } catch (failure) { setError(messageFrom(failure, "Não foi possível cancelar a publicação.")); }
    finally { setBusy(false); }
  }

  async function shareManually() {
    if (!mediaUrl) { setError("A mídia privada não está disponível. Atualize o painel e tente novamente."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error("Não foi possível carregar a mídia privada.");
      const file = new File([await response.blob()], item.media_filename, { type: item.media_type });
      const result = await sharePublication(navigator, {
        files: [file],
        title: item.publication_title,
        text: campaignCaption(item.caption, item.affiliate_url, item.hashtags),
      });
      if (result === "shared") {
        await onAction(item.id, "share_handoff");
        setNotice("Conteúdo entregue ao seletor de compartilhamento. A postagem ainda não foi confirmada.");
      } else {
        setError(result === "cancelled" ? "O compartilhamento foi cancelado; a publicação continua aguardando ação manual."
          : "Este navegador não conseguiu compartilhar o arquivo. Baixe a mídia e copie o texto para publicar manualmente.");
      }
    } catch (failure) { setError(messageFrom(failure, "Não foi possível abrir o compartilhamento.")); }
    finally { setBusy(false); }
  }

  async function confirmPublished() {
    if (!window.confirm("Confirma que você concluiu a publicação neste aplicativo?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await onAction(item.id, "manual_published");
      setNotice("Publicação marcada como concluída por sua confirmação manual.");
    } catch (failure) { setError(messageFrom(failure, "Não foi possível registrar a confirmação.")); }
    finally { setBusy(false); }
  }

  async function markFailed() {
    if (!window.confirm("Registrar que a tentativa manual não foi concluída? Você poderá editar e reagendar.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await onAction(item.id, "manual_failed");
      setNotice("Tentativa marcada como falha. Você poderá editar e reagendar.");
    } catch (failure) { setError(messageFrom(failure, "Não foi possível registrar a falha.")); }
    finally { setBusy(false); }
  }

  return <article className="space-y-3 rounded-xl border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">{item.publication_title}</h3>
        <p className="text-sm text-muted">{item.product_title} · {item.source_marketplace} · {publicationDestinations.find(value => value.id === item.destination)?.label ?? item.destination}</p>
        <p className="mt-1 text-xs text-muted">
          {item.scheduled_at ? `${formatPublicationDate(item.scheduled_at, item.timezone)} (${item.timezone})` : "Sem horário programado"}
        </p>
      </div>
      <span className="rounded-full bg-background px-3 py-1 text-xs">{publicationStatusLabel(item.status)}</span>
    </div>
    {mediaUrl && (item.media_type.startsWith("video/")
      ? <video src={mediaUrl} controls playsInline className="max-h-64 w-full rounded-lg" />
      : <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Ver mídia</a>)}
    <p className="whitespace-pre-wrap break-words text-sm">{campaignCaption(item.caption, item.affiliate_url, item.hashtags)}</p>
    {item.attempts.length > 0 && <details className="text-sm">
      <summary className="cursor-pointer text-primary">Histórico de tentativas ({item.attempts.length})</summary>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-muted">
        {item.attempts.map(attempt => <li key={attempt.id}>{formatPublicationDate(attempt.created_at, item.timezone)} · {attempt.details}</li>)}
      </ol>
    </details>}
    {editing && <div className="space-y-3 rounded-lg bg-background p-3">
      <label className="block text-sm">Produto<input value={productTitle} maxLength={500} onChange={event => setProductTitle(event.target.value)} className={field} /></label>
      <label className="block text-sm">Marketplace de origem<input value={sourceMarketplace} maxLength={80} onChange={event => setSourceMarketplace(event.target.value)} className={field} /></label>
      <label className="block text-sm">Link HTTPS de afiliado<input type="url" value={affiliateUrl} onChange={event => setAffiliateUrl(event.target.value)} className={field} /></label>
      <label className="block text-sm">Título<input value={publicationTitle} maxLength={200} onChange={event => setPublicationTitle(event.target.value)} className={field} /></label>
      <label className="block text-sm">Descrição<textarea value={caption} maxLength={5000} onChange={event => setCaption(event.target.value)} className={field} /></label>
      <label className="block text-sm">Hashtags<input value={hashtags} maxLength={1000} onChange={event => setHashtags(event.target.value)} className={field} /></label>
      <p className="text-sm">Destino: {publicationDestinations.find(option => option.id === destination)?.label ?? destination}. Para alterar, cancele e crie uma nova publicação.</p>
      <label className="block text-sm">Substituir mídia (opcional)
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={event => setReplacement(event.target.files?.[0] ?? null)} className="mt-2 block w-full" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Nova data e horário
          <input type="datetime-local" value={dateTime} onChange={event => setDateTime(event.target.value)} className={field} />
        </label>
        <label className="block text-sm">Fuso horário
          <select value={timeZone} onChange={event => setTimeZone(event.target.value)} className={field}>
            {choices.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted">Informe um novo horário futuro para reagendar. Para manter como rascunho, deixe a data vazia somente se este item já for um rascunho.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => void saveEdit()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Salvar e reagendar</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Voltar</button>
      </div>
    </div>}
    {item.status === "awaiting_manual_action" && <div className="flex flex-wrap gap-3">
      {item.destination === "tiktok_video" && <p className="w-full text-sm text-muted">No TikTok, confira o vídeo, a legenda e o link no aplicativo antes de publicar. O Meu Vendedor não publica nem confirma a postagem automaticamente.</p>}
      <button type="button" disabled={busy} onClick={() => void shareManually()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Compartilhar manualmente</button>
      <button type="button" disabled={busy} onClick={() => void confirmPublished()} className="rounded-lg border border-border px-4 py-2 text-sm">Confirmar publicação manual</button>
      <button type="button" disabled={busy} onClick={() => void markFailed()} className="rounded-lg border border-border px-4 py-2 text-sm">Registrar falha manual</button>
    </div>}
    {canEdit && !editing && <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={beginEdit} className="rounded-lg border border-border px-4 py-2 text-sm">Editar / reagendar</button>
      {canCancel && <button type="button" disabled={busy} onClick={() => void cancel()} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>}
      {mediaUrl && <a href={mediaUrl} download={item.media_filename} className="rounded-lg border border-border px-4 py-2 text-sm">Baixar mídia</a>}
      <button type="button" disabled={busy} onClick={async () => {
        try { await navigator.clipboard.writeText(campaignCaption(item.caption, item.affiliate_url, item.hashtags)); setNotice("Texto da publicação copiado."); }
        catch { setError("Não foi possível copiar o texto da publicação."); }
      }} className="rounded-lg border border-border px-4 py-2 text-sm">Copiar texto</button>
      {item.destination === "pinterest" && <a href={`https://www.pinterest.com/pin-builder/?url=${encodeURIComponent(item.affiliate_url)}&description=${encodeURIComponent(campaignCaption(item.caption, "", item.hashtags))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm">Abrir criador de Pin</a>}
    </div>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </article>;
}

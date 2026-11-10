"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadPublicationDraft, type PublicationDraft } from "@/lib/product-campaign";
import { PublicationComposer } from "./PublicationComposer";
export function PublicationWorkspace() {
  const { user, loading } = useAuth();
  return loading ? <p role="status">Carregando conta…</p> : user ? <OwnedDraft key={user.id} userId={user.id} /> : <p><Link href="/entrar" className="text-primary underline">Entre na conta</Link> para continuar seu rascunho.</p>;
}
function OwnedDraft({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<PublicationDraft | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let alive = true; void loadPublicationDraft(userId).then(value => { if (alive) setDraft(value); }).catch(() => { if (alive) setError("Não foi possível abrir o rascunho neste navegador."); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [userId]);
  if (loading) return <p role="status">Carregando rascunho…</p>;
  return <div className="space-y-4"><p className="text-sm text-muted">O último rascunho é guardado por conta neste navegador, com mídia e link. Salvar outro substitui o anterior. A postagem é concluída no aplicativo escolhido.</p>{error && <p role="alert">{error}</p>}{draft ? <PublicationComposer product={draft.product} affiliateUrl={draft.affiliateUrl} media={draft.media} filename={draft.filename} initialCaption={draft.caption} initialHashtags={draft.hashtags} /> : <p>Abra um produto em <Link href="/" className="text-primary underline">Ofertas e produtos</Link>, crie sua mídia e salve o rascunho para continuar aqui.</p>}</div>;
}

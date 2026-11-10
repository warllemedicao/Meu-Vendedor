"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { campaignPrompt, type CampaignProduct } from "@/lib/product-campaign";
import { ProductVideoStudio } from "./ProductVideoStudio";
import { PublicationComposer } from "./PublicationComposer";
const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";
type CampaignProps = { product: CampaignProduct; initialAffiliateUrl?: string };
export function ProductCampaign(props: CampaignProps) {
  const { user } = useAuth();
  return <CampaignEditor key={`${user?.id ?? "guest"}-${props.product.id}`} {...props} />;
}
function CampaignEditor({ product, initialAffiliateUrl = "" }: CampaignProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState("ai"), [busy, setBusy] = useState(false);
  const [linkEdit, setLinkEdit] = useState({ source: initialAffiliateUrl, value: initialAffiliateUrl });
  const affiliateUrl = linkEdit.source === initialAffiliateUrl ? linkEdit.value : initialAffiliateUrl;
  const setAffiliateUrl = (value: string) => setLinkEdit({ source: initialAffiliateUrl, value });
  const [details, setDetails] = useState(""), [scene, setScene] = useState("Ambiente coerente com o produto, iluminado naturalmente");
  const [person, setPerson] = useState("Escolher pela imagem; se houver dúvida, perguntar"), [speech, setSpeech] = useState(`Olha esse produto que eu separei para você! Confira os detalhes de ${product.title.slice(0, 100)} e clique no link para conhecer.`);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{ blob: Blob; filename: string; id: string } | null>(null);
  const prompt = campaignPrompt(product, details, scene, speech, person);
  return <section className="mt-5 space-y-4 rounded-xl border border-border bg-surface p-4" aria-label="Criar divulgação deste produto">
    <h2 className="text-lg font-semibold">Criar vídeo ou imagem para divulgar</h2>
    <p className="text-sm text-muted">{product.title} · {product.platform}. Seu produto e link acompanham a criação até a publicação.</p>
    <label className="block text-sm">Seu link de afiliado<input type="url" value={affiliateUrl} onChange={e => setAffiliateUrl(e.target.value)} placeholder="Gere seu link acima ou cole um link de afiliado HTTPS" className={field} /></label>
    <div className="flex flex-wrap gap-2" aria-label="Forma de criar mídia">{[["ai", "Personagem com produto · Gemini / Flow"], ["montage", "Montar com fotos e clipes"]].map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} disabled={busy} onClick={() => setMode(id)} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${mode === id ? "border-primary text-primary" : "border-border"}`}>{label}</button>)}</div>
    {mode === "ai" && <div className="space-y-4">
      <p className="text-sm text-muted">Anexe a foto exata do anúncio no Gemini junto com a instrução abaixo. Ele analisa a peça e prepara os prompts finais em português e inglês. Depois use o prompt no Flow e importe o resultado aqui.</p>
      {product.imageUrl && <a href={product.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-primary underline">Abrir foto original do anúncio para salvar</a>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Personagem<select value={person} onChange={e => setPerson(e.target.value)} className={field}><option>Escolher pela imagem; se houver dúvida, perguntar</option><option>Homem adulto elegante e moderno</option><option>Mulher adulta estilosa e elegante</option><option>Mostrar somente mãos adultas usando o produto</option></select></label><label className="text-sm">Cenário<input value={scene} onChange={e => setScene(e.target.value)} className={field} /></label></div>
      <label className="block text-sm">Detalhes confirmados da peça ou produto<textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Cor, modelo, variante, gola e estampa. A análise visual será feita no Gemini." className={field} /></label>
      <label className="block text-sm">Fala e chamada para ação<textarea value={speech} onChange={e => setSpeech(e.target.value)} className={field} /></label>
      <details><summary className="cursor-pointer text-sm text-primary">Conferir instrução de análise e prompts bilíngues</summary><textarea readOnly value={prompt} aria-label="Instrução para gerar prompts em português e inglês" rows={12} className={field} /></details>
      <div className="flex flex-wrap gap-3 text-sm"><button type="button" className="rounded-lg bg-primary px-3 py-2 text-white" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setNotice("Instrução copiada. Cole no Gemini junto com a foto do produto."); } catch { setNotice("Abra a instrução acima, selecione e copie o texto."); } }}>Copiar instrução</button><a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2">Abrir Gemini</a><a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2">Abrir Google Flow</a></div>
      <p className="text-xs text-muted">A geração acontece na ferramenta escolhida, conforme sua conta e seus limites. O site não transfere automaticamente fotos ou prompts para essas ferramentas.</p>
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    </div>}
    <div hidden={mode !== "montage"}><ProductVideoStudio key={`${user?.id ?? "guest"}-${product.id}`} onBusyChange={setBusy} active={mode === "montage"} initialProduct={product} onResult={(blob, filename) => setResult({ blob, filename, id: crypto.randomUUID() })} /></div>
    <label className="block rounded-lg border border-dashed border-border p-4 text-sm">Importar vídeo ou imagem pronta do Flow / Gemini<input type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" className="mt-2 block w-full" onChange={e => { const file = e.target.files?.[0]; if (file) { if (!["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 150 * 1024 * 1024) { setNotice("Use MP4, WebM, JPEG, PNG ou WebP de até 150 MB."); } else { setResult({ blob: file, filename: file.name, id: crypto.randomUUID() }); setNotice(""); } } e.target.value = ""; }} /></label>
    {result && <PublicationComposer key={result.id} product={product} affiliateUrl={affiliateUrl} media={result.blob} filename={result.filename} />}
  </section>;
}

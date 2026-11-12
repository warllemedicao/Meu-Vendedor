"use client";
import { useState } from "react";
import { buildChatGPTBrief, CHATGPT_URL, MAX_MANUAL_PROMPT, type ProductBrief } from "@/lib/manual-chatgpt";
import type { useManualPromptDraft } from "@/hooks/useManualPromptDraft";
export function ManualChatGPTPrompt({ brief, draft }: { brief: ProductBrief; draft: ReturnType<typeof useManualPromptDraft> }) {
  const [notice, setNotice] = useState("");
  const prepared = buildChatGPTBrief(brief);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setNotice("Texto copiado. Revise antes de colar no serviço externo."); } catch { setNotice("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente."); } }
  return <section aria-label="Prompt manual com ChatGPT" className="my-4 min-w-0 space-y-3 rounded-xl border border-border bg-surface p-4">
    <h3 className="font-semibold">Criar roteiro e prompt no ChatGPT</h3>
    <p className="text-sm text-muted">Copie as informações, abra o ChatGPT e cole o resultado aqui. A abertura é externa; nenhum texto ou imagem é enviado automaticamente. Revise o conteúdo antes de compartilhar.</p>
    <div className="flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => void copy(prepared)} className="rounded-lg border border-border px-3 py-2">Copiar informações do produto</button><a href={CHATGPT_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-primary px-3 py-2 text-primary">Criar prompt no ChatGPT</a></div>
    <details><summary className="cursor-pointer text-sm text-primary">Conferir informações que serão copiadas</summary><textarea aria-label="Informações para copiar ao ChatGPT" readOnly rows={6} value={prepared} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" /></details>
    <label className="block text-sm">Cole aqui o prompt criado no ChatGPT<textarea value={draft.text} onChange={e => draft.setText(e.target.value)} maxLength={MAX_MANUAL_PROMPT} rows={7} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Cole o texto completo, mantendo as quebras de linha." /></label>
    <div className="flex flex-wrap gap-3 text-sm"><button type="button" disabled={!draft.text.trim()} onClick={() => { draft.apply(); setNotice("Prompt manual aplicado. Confira a direção em uso abaixo; a fala do narrador é revisada separadamente."); }} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">Usar este prompt</button><button type="button" disabled={!draft.text} onClick={() => void copy(draft.text)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-50">Copiar prompt manual</button>{draft.applied && <button type="button" onClick={draft.clearApplied} className="text-primary underline">Voltar ao prompt automático</button>}</div>
    <p className="text-xs text-muted">O rascunho é mantido nesta aba do navegador por conta e produto. Não cole credenciais. Gemini e Google Flow continuam disponíveis; seu prompt manual só é aplicado ao clicar em Usar este prompt.</p>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </section>;
}

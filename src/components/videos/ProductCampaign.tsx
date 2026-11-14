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
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Conversão de imagem indisponível");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        const jpeg = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(result => result ? resolve(result) : reject(new Error("Falha ao gerar JPEG")), "image/jpeg", 0.94));
        const href = URL.createObjectURL(jpeg);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = name.replace(/\\.(jpe?g|jfif|png|webp)$/i, "") + ".jpg";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      } finally { bitmap.close(); }
    } catch {
      setNotice("O servidor da imagem bloqueou o download ou a conversão automática. Abra a imagem original e salve-a manualmente; não basta renomear a extensão.");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
 ctx.drawImage(bitmap, 0, 0);
        const jpeg = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(result => result ? resolve(result) : reject(new Error("Falha ao gerar JPEG")), "image/jpeg", 0.94));
        const href = URL.createObjectURL(jpeg);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = name.replace(/\\.(jpe?g|jfif|png|webp)$/i, "") + ".jpg";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      } finally { bitmap.close(); }
    } catch {
      setNotice("O servidor da imagem bloqueou o download ou a conversão automática. Abra a imagem original e salve-a manualmente; não basta renomear a extensão.");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

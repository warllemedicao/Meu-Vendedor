"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Info, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  buildFlowPrompt,
  buildStoryScript,
  estimateVideoCount,
  flowCreditCost,
  flowModels,
  type StoryKind,
  type VideoModelId,
} from "@/lib/video-studio";

const FLOW_URL = "https://labs.google/fx/tools/flow";
const STORAGE_KEY = "mv-flow-credit-estimate-v1";
const STORAGE_EVENT = "mv-flow-credit-estimate-updated";
const SERVER_SNAPSHOT = "__server_snapshot__";
const STORAGE_READ_ERROR = "__storage_read_error__";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

const characters = [
  { id: "morango", emoji: "🍓", name: "Mimi Morango", description: "um morango antropomórfico alegre, curioso e expressivo", color: "from-rose-100 to-pink-50" },
  { id: "banana", emoji: "🍌", name: "Bento Banana", description: "uma banana antropomórfica brincalhona, otimista e um pouco atrapalhada", color: "from-amber-100 to-yellow-50" },
  { id: "abacaxi", emoji: "🍍", name: "Paco Abacaxi", description: "um abacaxi antropomórfico aventureiro, confiante e acolhedor", color: "from-lime-100 to-yellow-50" },
  { id: "laranja", emoji: "🍊", name: "Lola Laranja", description: "uma laranja antropomórfica energética, criativa e simpática", color: "from-orange-100 to-amber-50" },
  { id: "uva", emoji: "🍇", name: "Nina Uva", description: "uma personagem de uva antropomórfica calma, esperta e bem-humorada", color: "from-violet-100 to-fuchsia-50" },
] as const;

const stories: { id: StoryKind; title: string; description: string }[] = [
  { id: "discovery", title: "Uma descoberta", description: "A personagem encontra o produto e conta o que chamou sua atenção." },
  { id: "challenge", title: "Desafio divertido", description: "Uma pequena situação divertida apresenta o produto." },
  { id: "surprise", title: "Surpresa para alguém", description: "A personagem prepara uma surpresa e mostra o produto." },
  { id: "tutorial", title: "Demonstração rápida", description: "Uma apresentação simples, com o produto em destaque." },
];

type UsageEstimate = {
  creditsRemaining: number | null;
  generationsRegistered: number;
  pendingCost: number;
  updatedAt: string | null;
};

const emptyUsage: UsageEstimate = {
  creditsRemaining: null,
  generationsRegistered: 0,
  pendingCost: 0,
  updatedAt: null,
};

function subscribeToUsage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getUsageSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return STORAGE_READ_ERROR;
  }
}

function isUsageEstimate(value: unknown): value is UsageEstimate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    (item.creditsRemaining === null || (Number.isSafeInteger(item.creditsRemaining) && Number(item.creditsRemaining) >= 0)) &&
    Number.isSafeInteger(item.generationsRegistered) &&
    Number(item.generationsRegistered) >= 0 &&
    Number.isSafeInteger(item.pendingCost) &&
    Number(item.pendingCost) >= 0 &&
    (item.updatedAt === null || typeof item.updatedAt === "string")
  );
}

export function VideoStudio() {
  const [characterId, setCharacterId] = useState<(typeof characters)[number]["id"]>("morango");
  const [storyKind, setStoryKind] = useState<StoryKind>("discovery");
  const [productName, setProductName] = useState("");
  const [productBenefit, setProductBenefit] = useState("");
  const [action, setAction] = useState("apresenta o produto para a câmera");
  const [mood, setMood] = useState("engraçado e acolhedor");
  const [voice, setVoice] = useState("feminina, animada e natural");
  const [model, setModel] = useState<VideoModelId>("omni360");
  const [duration, setDuration] = useState(8);
  const [image, setImage] = useState<File | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const usageSnapshot = useSyncExternalStore(subscribeToUsage, getUsageSnapshot, () => SERVER_SNAPSHOT);
  const ready = usageSnapshot !== SERVER_SNAPSHOT;
  const { usage, storageError } = useMemo(() => {
    if (usageSnapshot === STORAGE_READ_ERROR) {
      return { usage: emptyUsage, storageError: "Não foi possível ler o controle salvo neste navegador. Atualize o saldo antes de continuar." };
    }
    if (!usageSnapshot) return { usage: emptyUsage, storageError: "" };
    try {
      const parsed: unknown = JSON.parse(usageSnapshot);
      if (!isUsageEstimate(parsed)) throw new Error("invalid_usage_estimate");
      return { usage: parsed, storageError: "" };
    } catch {
      return { usage: emptyUsage, storageError: "O controle salvo está inválido. Atualize o saldo antes de continuar." };
    }
  }, [usageSnapshot]);

  const selectedCharacter = characters.find((item) => item.id === characterId) ?? characters[0];
  const creditCost = flowCreditCost(model, duration);
  const modelOptions = flowModels.find((item) => item.id === model) ?? flowModels[0];
  const availableVideos = usage.creditsRemaining === null ? null : estimateVideoCount(usage.creditsRemaining, creditCost);
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);

  const storyInput = useMemo(() => ({
    characterName: selectedCharacter.name,
    characterDescription: selectedCharacter.description,
    productName: productName.trim() || "[nome do produto]",
    productBenefit,
    storyKind,
    action,
    mood,
    voice,
    durationSeconds: duration,
  }), [selectedCharacter, productName, productBenefit, storyKind, action, mood, voice, duration]);

  const storyScript = buildStoryScript(storyInput);
  const prompt = buildFlowPrompt(storyInput);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function saveUsage(next: UsageEstimate): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(STORAGE_EVENT));
      setError("");
      return true;
    } catch {
      setError("Não foi possível salvar o controle neste navegador. Verifique o armazenamento local e tente novamente.");
      return false;
    }
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedImageTypes.has(file.type)) {
      setImage(null);
      setError("Use uma imagem PNG, JPEG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImage(null);
      setError("A imagem deve ter no máximo 10 MB.");
      event.target.value = "";
      return;
    }
    setImage(file);
  }

  function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credits = Number(balanceInput);
    if (!Number.isSafeInteger(credits) || credits < 0 || credits > 100_000) {
      setError("Informe o saldo inteiro exibido no Flow, entre 0 e 100.000 créditos.");
      return;
    }
    if (usage.pendingCost > 0) {
      setError("Conclua ou desfaça a reserva pendente antes de atualizar o saldo.");
      return;
    }
    const next = { ...usage, creditsRemaining: credits, updatedAt: new Date().toISOString() };
    if (saveUsage(next)) {
      setBalanceInput("");
      setNotice("Saldo estimado atualizado. O valor foi salvo somente neste navegador.");
    }
  }

  function openFlow(event: MouseEvent<HTMLAnchorElement>) {
    setError("");
    setNotice("");
    if (!ready || !image || !productName.trim()) {
      event.preventDefault();
      setError("Adicione uma imagem e informe o nome do produto antes de abrir o Flow.");
      return;
    }
    if (usage.pendingCost > 0) {
      event.preventDefault();
      setError("Você já tem uma geração reservada. Conclua ou desfaça essa reserva primeiro.");
      return;
    }
    if (usage.creditsRemaining === null || usage.creditsRemaining < creditCost) {
      event.preventDefault();
      setError("Saldo estimado insuficiente. Confira o saldo atual no Flow e atualize o controle.");
      return;
    }
    const next = {
      ...usage,
      creditsRemaining: usage.creditsRemaining - creditCost,
      pendingCost: creditCost,
      updatedAt: new Date().toISOString(),
    };
    if (!saveUsage(next)) event.preventDefault();
    else setNotice(`${creditCost} créditos reservados como estimativa. No Flow, anexe a foto e escolha uma saída.`);
  }

  function completeGeneration() {
    if (usage.pendingCost < 1) return;
    const next = {
      ...usage,
      pendingCost: 0,
      generationsRegistered: usage.generationsRegistered + 1,
      updatedAt: new Date().toISOString(),
    };
    if (saveUsage(next)) setNotice("Vídeo registrado neste navegador. Confira o saldo real no Flow.");
  }

  function cancelReservation() {
    if (usage.pendingCost < 1 || usage.creditsRemaining === null) return;
    const next = {
      ...usage,
      creditsRemaining: usage.creditsRemaining + usage.pendingCost,
      pendingCost: 0,
      updatedAt: new Date().toISOString(),
    };
    if (saveUsage(next)) setNotice("Reserva desfeita no controle estimado. Confira se o Flow debitou créditos antes de continuar.");
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setNotice(`${label} copiado.`);
    } catch {
      setError(`Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-5">
          <Card titulo="1. Escolha o produto e a personagem">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Nome do produto
                  <input value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={100} className={inputClass} placeholder="Ex.: garrafa térmica" />
                </label>
                <label className="block text-sm font-medium">
                  Benefício confirmado (opcional)
                  <input value={productBenefit} onChange={(event) => setProductBenefit(event.target.value)} maxLength={140} className={inputClass} placeholder="Use apenas uma informação verdadeira" />
                </label>
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-4 text-center">
                  {previewUrl ? (
                    // A imagem é somente pré-visualizada no navegador; o usuário a enviará ao Flow manualmente.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Prévia do produto escolhido" className="mb-3 max-h-40 max-w-full rounded-lg object-contain" />
                  ) : <ImagePlus className="mb-2 size-7 text-primary" aria-hidden />}
                  <span className="text-sm font-medium">{image ? image.name : "Adicionar foto do produto"}</span>
                  <span className="mt-1 text-xs text-muted">PNG, JPEG ou WebP · até 10 MB · não é enviada pelo Meu Vendedor</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} className="sr-only" aria-label="Selecionar foto do produto" />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Personagem de fruta</p>
                <div className="grid gap-2">
                  {characters.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      aria-pressed={characterId === character.id}
                      onClick={() => setCharacterId(character.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${characterId === character.id ? "border-primary bg-primary-soft" : "border-border bg-background hover:bg-surface-muted"}`}
                    >
                      <span className={`grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${character.color} text-2xl`} aria-hidden>{character.emoji}</span>
                      <span className="min-w-0"><span className="block text-sm font-semibold">{character.name}</span><span className="block text-xs text-muted">{character.description}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card titulo="2. Monte a historinha">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Ideia da história
                <select value={storyKind} onChange={(event) => setStoryKind(event.target.value as StoryKind)} className={inputClass}>
                  {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">{stories.find((item) => item.id === storyKind)?.description}</span>
              </label>
              <label className="block text-sm font-medium">
                O que a personagem faz?
                <select value={action} onChange={(event) => setAction(event.target.value)} className={inputClass}>
                  <option value="apresenta o produto para a câmera">Apresenta o produto</option>
                  <option value="demonstra cuidadosamente como o produto é usado">Demonstra o uso</option>
                  <option value="abre a embalagem e reage com surpresa">Abre a embalagem</option>
                  <option value="compartilha o produto com uma amiga">Compartilha com alguém</option>
                  <option value="mostra o produto em uma cena curta do cotidiano">Mostra no cotidiano</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Humor
                <select value={mood} onChange={(event) => setMood(event.target.value)} className={inputClass}>
                  <option value="engraçado e acolhedor">Engraçado</option>
                  <option value="fofo e carinhoso">Fofo</option>
                  <option value="animado e energético">Animado</option>
                  <option value="calmo e elegante">Calmo</option>
                  <option value="surpreso e curioso">Surpreso</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Voz desejada
                <select value={voice} onChange={(event) => setVoice(event.target.value)} className={inputClass}>
                  <option value="feminina, animada e natural">Feminina · animada</option>
                  <option value="masculina, leve e bem-humorada">Masculina · bem-humorada</option>
                  <option value="neutra, clara e acolhedora">Neutra · acolhedora</option>
                  <option value="narrador divertido, com ritmo rápido">Narrador · divertido</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">A seleção final de voz é feita manualmente no Flow.</span>
              </label>
            </div>
          </Card>

          <Card titulo="3. Roteiro e prompt para o Flow">
            <div className="grid gap-4 lg:grid-cols-2">
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Roteiro sugerido</h3>
                  <button type="button" onClick={() => void copyText(storyScript, "Roteiro")} className="inline-flex items-center gap-1 text-xs text-primary underline"><Copy className="size-3.5" aria-hidden />Copiar</button>
                </div>
                <pre className="min-h-36 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm font-sans leading-relaxed">{storyScript}</pre>
              </section>
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Prompt visual</h3>
                  <button type="button" onClick={() => void copyText(prompt, "Prompt")} className="inline-flex items-center gap-1 text-xs text-primary underline"><Copy className="size-3.5" aria-hidden />Copiar</button>
                </div>
                <textarea readOnly value={prompt} rows={7} className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed" aria-label="Prompt visual para copiar no Flow" />
              </section>
            </div>
            <p className="mt-3 text-xs text-muted">O roteiro é montado com modelos fixos a partir das suas escolhas; nenhuma IA é chamada pelo Meu Vendedor. O Flow pode alterar detalhes da embalagem ou do produto, então revise o resultado antes de publicar.</p>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card titulo="Estimativa de créditos do Flow">
            <div className="rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-semibold">Saldo local, não sincronizado</p>
              <p className="mt-1 text-xs text-muted">O Meu Vendedor não acessa a conta nem o saldo real do Flow. Informe o saldo exibido no Flow e registre aqui cada geração iniciada por este estúdio.</p>
            </div>
            <form onSubmit={saveBalance} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                Créditos restantes exibidos no Flow
                <input type="number" min="0" max="100000" step="1" value={balanceInput} onChange={(event) => setBalanceInput(event.target.value)} className={inputClass} placeholder="Ex.: 1.050" />
              </label>
              <button type="submit" disabled={!ready || usage.pendingCost > 0} className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">Atualizar saldo manualmente</button>
            </form>
            <div className="mt-4 rounded-lg bg-primary-soft p-3">
              <p className="text-xs text-muted">Vídeos estimados no modelo selecionado</p>
              <p className="mt-1 text-2xl font-bold">{availableVideos === null ? "—" : availableVideos}</p>
              <p className="text-xs text-muted">{availableVideos === null ? "Informe seu saldo atual do Flow." : `${usage.creditsRemaining} créditos ÷ ${creditCost} por saída`}</p>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Modelo e qualidade
              <select value={model} onChange={(event) => {
                const nextModel = event.target.value as VideoModelId;
                setModel(nextModel);
                const nextOptions = flowModels.find((item) => item.id === nextModel);
                if (nextOptions && !Object.hasOwn(nextOptions.creditCosts, duration)) setDuration(Number(Object.keys(nextOptions.creditCosts)[0]));
              }} className={inputClass}>
                {flowModels.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.resolution}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium">
              Duração
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={inputClass}>
                {Object.keys(modelOptions.creditCosts).map((seconds) => <option key={seconds} value={seconds}>{seconds} segundos · {modelOptions.creditCosts[Number(seconds)]} créditos</option>)}
              </select>
            </label>
            <p className="mt-3 text-xs text-muted">Custos consultados na documentação do Flow; podem mudar. Uma geração pode criar mais de uma saída. Esta estimativa considera uma saída por vez.</p>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Referência atual do AI Pro: 50 créditos diários e 1.000 mensais. O app não detecta usos feitos no site Flow ou em outros dispositivos. Confira e atualize o saldo manualmente antes de cada sessão.</p>
            </div>
            {usage.updatedAt && <p className="mt-3 text-xs text-muted">Saldo atualizado: {new Date(usage.updatedAt).toLocaleString("pt-BR")} · {usage.generationsRegistered} vídeo(s) registrado(s) neste navegador.</p>}
          </Card>

          <Card titulo="Pronto para criar?">
            <p className="text-sm text-muted">Copie o prompt, abra o Flow, anexe a mesma foto do produto e selecione o modelo, duração e voz indicados.</p>
            <p className="mt-2 text-xs text-muted">A imagem selecionada nesta página fica somente no navegador; ela não é enviada nem anexada automaticamente ao Flow.</p>
            <a
              href={FLOW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openFlow}
              aria-disabled={!ready || !image || !productName.trim() || usage.creditsRemaining === null || usage.creditsRemaining < creditCost || usage.pendingCost > 0}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${!ready || !image || !productName.trim() || usage.creditsRemaining === null || usage.creditsRemaining < creditCost || usage.pendingCost > 0 ? "pointer-events-none bg-surface-muted text-muted" : "bg-primary text-background"}`}
            >
              <ExternalLink className="size-4" aria-hidden />Abrir Flow e reservar {creditCost} créditos
            </a>
            {usage.pendingCost > 0 && (
              <div className="mt-4 space-y-2 rounded-lg border border-accent bg-accent-soft p-3">
                <p className="text-sm font-medium">Reserva estimada de {usage.pendingCost} créditos ativa.</p>
                <button type="button" onClick={completeGeneration} className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-background">Registrei o vídeo no Flow</button>
                <button type="button" onClick={cancelReservation} className="w-full rounded-lg border border-border px-3 py-2 text-sm">Desfazer reserva</button>
              </div>
            )}
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-accent-soft p-4 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Este estúdio prepara a história e acompanha uma estimativa. A geração acontece no site do Google Flow, usando sua conta e os limites definidos pelo Google.</p>
          </div>
        </aside>
      </div>

      {(storageError || error) && <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-3 text-sm">{storageError || error}</p>}
      {notice && <p role="status" className="rounded-lg border border-border bg-surface p-3 text-sm">{notice}</p>}
      {ready && usage.pendingCost === 0 && usage.generationsRegistered > 0 && <p className="sr-only" aria-live="polite"><Check aria-hidden /> Gerações registradas: {usage.generationsRegistered}</p>}
    </div>
  );
}

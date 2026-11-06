"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Film,
  ImagePlus,
  Library,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/Card";
import { getSupabase } from "@/lib/supabase/client";
import {
  createVideoPresenterAIReference,
  createVideoProductAIReference,
  createVideoAssetUrl,
  MAX_VIDEO_IMAGE_BYTES,
  MAX_VIDEO_DEMO_BYTES,
  MAX_VIDEO_RESULT_BYTES,
  uploadVideoProductImage,
  uploadVideoResult,
} from "@/lib/video-assets";
import { mockVideoProvider } from "@/lib/video-provider";
import {
  advertisingStyles,
  buildAdvertisingScript,
  buildVideoPrompt,
  createVideoLibraryRecord,
  emotionalTones,
  generationModes,
  motionModes,
  narrationModes,
  validateVideoConfiguration,
  videoScenePresets,
  videoTemplates,
  videoDurations,
  virtualPresenters,
  voiceGenders,
  voiceProfiles,
  type AdvertisingStyleId,
  type EmotionalToneId,
  type GenerationMode,
  type MotionMode,
  type PresenterId,
  type NarrationMode,
  type VideoConfiguration,
  type VideoDuration,
  type VideoFormat,
  type VideoTemplateId,
  type VideoGenerationStatus,
  type VideoLibraryRecord,
  type VideoProductInput,
  type VoiceGender,
  type VoiceProfileId,
} from "@/lib/video-studio";

const FLOW_URL = "https://labs.google/fx/tools/flow";
const LIBRARY_PREFIX = "mv-video-library-v2";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const inputClass = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:opacity-50";

interface ExistingProduct {
  id: string;
  title: string;
  image_url: string | null;
  product_url: string;
  price_min: number | null;
  price_max: number | null;
  shop_name: string | null;
}

interface VideoProjectRow {
  id: string;
  source_product_id: string | null;
  parent_id: string | null;
  product_data: VideoProductInput;
  template_id: VideoTemplateId;
  scene_preset_id: string;
  presenter_id: PresenterId;
  voice_gender: VoiceGender;
  voice_profile: VoiceProfileId;
  emotional_tone: EmotionalToneId;
  advertising_style: AdvertisingStyleId;
  narration_mode: NarrationMode;
  motion_mode: MotionMode;
  duration_seconds: number;
  aspect_ratio: VideoFormat;
  generation_mode: GenerationMode;
  target_audience: string;
  script: string;
  prompt: string;
  provider: "mock" | "google-gemini" | "huggingface" | "modal";
  provider_job_id: string | null;
  status: VideoGenerationStatus;
  result_url: string | null;
  result_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

interface VideoJobRow {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  provider: "pending" | "cloudflare-workers-ai" | "magic-hour" | "replicate";
  stage: string;
  stage_message: string | null;
  next_attempt_at: string;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
  result_object_path: string | null;
}

async function inspectTechnicalDemo(file: File): Promise<string | null> {
  const marker = new TextDecoder().decode(await file.slice(0, 1024 * 1024).arrayBuffer());
  if (!marker.includes("Still image of Ana; no AI video generation")) {
    return "O arquivo não contém o marcador do renderizador técnico local.";
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (!Number.isFinite(video.duration) || Math.abs(video.duration - 6) > 0.1) {
        resolve("O MP4 deve ter exatamente 6 segundos.");
      } else if (video.videoWidth <= 0 || video.videoHeight <= 0 || Math.abs(video.videoWidth / video.videoHeight - 9 / 16) > 0.002) {
        resolve("O MP4 deve estar no formato vertical 9:16.");
      } else {
        resolve(null);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Não foi possível ler os metadados do MP4.");
    };
    video.src = url;
  });
}

const emptyProduct: VideoProductInput = {
  sourceProductId: null,
  name: "",
  description: "",
  price: "",
  features: "",
  affiliateLink: "",
  imageUrl: "",
  imageName: "",
  imageStoragePath: "",
  clothingSize: "",
};

const statusLabels: Record<VideoGenerationStatus, string> = {
  awaiting_configuration: "Aguardando configuração",
  ready: "Pronto para gerar",
  awaiting_provider: "Aguardando integração da API",
  generating: "Gerando",
  processing: "Processando",
  completed: "Concluído",
  simulation_completed: "Simulação concluída",
  cancelled: "Cancelado",
  failed: "Falha na geração",
};

const jobStatusLabels: Record<VideoJobRow["status"], string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const jobProviderLabels: Record<VideoJobRow["provider"], string> = {
  pending: "Aguardando seleção",
  "cloudflare-workers-ai": "Cloudflare Workers AI",
  "magic-hour": "Magic Hour",
  replicate: "Replicate",
};

const jobStageLabels: Record<string, string> = {
  queued: "Aguardando processamento",
  image_generating: "Gerando imagem de referência",
  image_ready: "Preparando vídeo",
  video_submitting: "Enviando ao provedor de vídeo",
  video_processing: "Gerando vídeo",
  validating: "Validando resultado",
  awaiting_free_credits: "Aguardando créditos ou disponibilidade",
  waiting_for_free_resources: "Aguardando créditos ou disponibilidade",
  waiting_for_resources: "Aguardando créditos ou disponibilidade",
  awaiting_authorization: "Aguardando disponibilidade dos serviços",
  uncertain: "Verificação necessária",
  completed: "Vídeo concluído",
  failed: "Erro na geração",
  cancelled: "Cancelado",
  trying_another_provider: "Tentando outro provedor",
  cancel_requested_remote_continues: "Cancelamento solicitado; provedor finalizando",
  cancel_retry_pending: "Tentando cancelar no provedor",
};

const storedDurations = [6, 7, 8, 10, 15, 20, 30, 45, 60] as const;
type StoredDuration = (typeof storedDurations)[number];

function isStoredDuration(value: unknown): value is StoredDuration {
  return typeof value === "number" && (storedDurations as readonly number[]).includes(value);
}

function normalizeLibraryRecord(value: unknown): VideoLibraryRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<VideoLibraryRecord>;
  if (typeof row.id !== "string" || typeof row.script !== "string" || typeof row.prompt !== "string" ||
    typeof row.createdAt !== "string" || !row.product || typeof row.product.name !== "string" ||
    !virtualPresenters.some((item) => item.id === row.presenterId)) return null;

  const templateId = videoTemplates.some((template) => template.id === row.templateId)
    ? row.templateId!
    : "presenting-product";
  const scenePresetId = videoScenePresets.some((scene) => scene.id === row.scenePresetId && scene.templateId === templateId)
    ? row.scenePresetId!
    : videoScenePresets.find((scene) => scene.templateId === templateId)!.id;
  const durationSeconds = isStoredDuration(row.durationSeconds) ? row.durationSeconds : 8;
  const format = row.format === "1:1" || row.format === "16:9" ? row.format : "9:16";
  const narrationMode = narrationModes.some((option) => option.id === row.narrationMode) ? row.narrationMode! : "voiceover";
  const motionMode = motionModes.some((option) => option.id === row.motionMode) ? row.motionMode! : "poses";
  return {
    ...row as VideoLibraryRecord,
    templateId,
    scenePresetId,
    narrationMode,
    motionMode,
    durationSeconds,
    format,
    resultStoragePath: typeof row.resultStoragePath === "string" ? row.resultStoragePath : null,
    product: {
      ...row.product,
      imageStoragePath: row.product.imageStoragePath ?? "",
      clothingSize: row.product.clothingSize ?? "",
    },
  };
}

function readLocalLibrary(key: string): VideoLibraryRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeLibraryRecord).filter((record): record is VideoLibraryRecord => record !== null).slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeLocalLibrary(key: string, records: VideoLibraryRecord[]) {
  window.localStorage.setItem(key, JSON.stringify(records.slice(0, 50)));
}

function fromDatabaseRow(row: VideoProjectRow): VideoLibraryRecord {
  const record = normalizeLibraryRecord({
    id: row.id,
    parentId: row.parent_id,
    product: { ...row.product_data, sourceProductId: row.source_product_id },
    templateId: row.template_id,
    scenePresetId: row.scene_preset_id,
    presenterId: row.presenter_id,
    voiceGender: row.voice_gender,
    voiceProfileId: row.voice_profile,
    emotionalToneId: row.emotional_tone,
    advertisingStyleId: row.advertising_style,
    narrationMode: row.narration_mode,
    motionMode: row.motion_mode,
    durationSeconds: row.duration_seconds,
    format: row.aspect_ratio,
    mode: row.generation_mode,
    targetAudience: row.target_audience,
    script: row.script,
    prompt: row.prompt,
    provider: row.provider,
    providerJobId: row.provider_job_id,
    status: row.status,
    resultUrl: row.result_url,
    resultStoragePath: row.result_storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  if (!record) throw new Error("O projeto de vídeo salvo tem dados inválidos.");
  return record;
}

function toDatabaseRow(record: VideoLibraryRecord) {
  return {
    id: record.id,
    source_product_id: record.product.sourceProductId || null,
    parent_id: record.parentId,
    product_data: {
      name: record.product.name,
      description: record.product.description,
      price: record.product.price,
      features: record.product.features,
      affiliateLink: record.product.affiliateLink,
      imageUrl: record.product.imageUrl || "",
      imageName: record.product.imageName || "",
      imageStoragePath: record.product.imageStoragePath || "",
      clothingSize: record.product.clothingSize || "",
    },
    template_id: record.templateId,
    scene_preset_id: record.scenePresetId,
    presenter_id: record.presenterId,
    voice_gender: record.voiceGender,
    voice_profile: record.voiceProfileId,
    emotional_tone: record.emotionalToneId,
    advertising_style: record.advertisingStyleId,
    narration_mode: record.narrationMode,
    motion_mode: record.motionMode,
    duration_seconds: record.durationSeconds,
    aspect_ratio: record.format,
    generation_mode: record.mode,
    target_audience: record.targetAudience,
    script: record.script,
    prompt: record.prompt,
    provider: record.provider,
    provider_job_id: record.providerJobId,
    status: record.status,
    result_url: record.resultUrl,
  };
}

export function VideoStudio() {
  const { user, configured, loading: authLoading } = useAuth();
  const [studioView, setStudioView] = useState<"create" | "queue" | "library">("create");
  const [studioStep, setStudioStep] = useState(0);
  const [product, setProduct] = useState<VideoProductInput>(emptyProduct);
  const [templateId, setTemplateId] = useState<VideoTemplateId>("presenting-product");
  const [scenePresetId, setScenePresetId] = useState("beauty-counter");
  const [presenterId, setPresenterId] = useState<PresenterId>("ana");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("feminina");
  const [voiceProfileId, setVoiceProfileId] = useState<VoiceProfileId>("natural");
  const [emotionalToneId, setEmotionalToneId] = useState<EmotionalToneId>("alegre");
  const [advertisingStyleId, setAdvertisingStyleId] = useState<AdvertisingStyleId>("tradicional");
  const [narrationMode, setNarrationMode] = useState<NarrationMode>("voiceover");
  const [motionMode, setMotionMode] = useState<MotionMode>("poses");
  const [durationSeconds, setDurationSeconds] = useState<VideoDuration>(6);
  const format: VideoFormat = "9:16";
  const [mode, setMode] = useState<GenerationMode>("ai-video");
  const [targetAudience, setTargetAudience] = useState("");
  const [script, setScript] = useState("");
  const [scriptEdited, setScriptEdited] = useState(false);
  const [geminiScriptEnabledForUser, setGeminiScriptAvailable] = useState(false);
  const [geminiCapabilityMessage, setGeminiCapabilityMessage] = useState("Verificando disponibilidade após entrar.");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [jobManagementEnabledForUser, setJobManagementAvailable] = useState(false);
  const [videoProcessorAvailableForUser, setVideoProcessorAvailable] = useState(false);
  const [productionReadiness, setProductionReadiness] = useState<{ ready: boolean; imageReady: boolean; videoReady: boolean; checkedAt: string; message: string } | null>(null);
  const [capabilityRefresh, setCapabilityRefresh] = useState(0);
  const [checkingProduction, setCheckingProduction] = useState(false);
  const [productionServices, setProductionServices] = useState<{ name: string; configured: boolean; integrated: boolean }[]>([]);
  const [capabilityUserId, setCapabilityUserId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [enqueueingJob, setEnqueueingJob] = useState(false);
  const [demoVideoFile, setDemoVideoFile] = useState<File | null>(null);
  const [validatingDemoVideo, setValidatingDemoVideo] = useState(false);
  const [savingDemoVideo, setSavingDemoVideo] = useState(false);
  const [pendingDemoPath, setPendingDemoPath] = useState<string | null>(null);
  const [jobResultUrls, setJobResultUrls] = useState<Record<string, { userId: string; url?: string; error?: string }>>({});
  const [generationStatus, setStatus] = useState<VideoGenerationStatus>("awaiting_configuration");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<{ userId: string; path: string; url: string } | null>(null);
  const [imageError, setImageError] = useState("");
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [library, setLibrary] = useState<VideoLibraryRecord[]>([]);
  const [jobs, setJobs] = useState<VideoJobRow[]>([]);
  const [jobsLoadedForUser, setJobsLoadedForUser] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [signedResult, setSignedResult] = useState<{ userId: string; recordId: string; url?: string; error?: string } | null>(null);
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(true);
  const generationLock = useRef(false);
  const enqueueIdempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const aiReferenceCache = useRef<{
    key: string;
    product: { path: string; width: number; height: number };
    presenter: { path: string; width: number; height: number };
  } | null>(null);
  const demoVideoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const libraryKey = `${LIBRARY_PREFIX}:${user?.id ?? "guest"}`;
  const userId = user?.id;
  const geminiScriptAvailable = Boolean(userId && capabilityUserId === userId && geminiScriptEnabledForUser);
  const jobManagementAvailable = Boolean(userId && capabilityUserId === userId && jobManagementEnabledForUser);
  const queueAvailable = Boolean(userId && capabilityUserId === userId && jobManagementEnabledForUser && videoProcessorAvailableForUser);
  const geminiCapabilityNotice = userId ? geminiCapabilityMessage : "Entre na sua conta para verificar o provedor.";
  const visibleJobs = userId && jobsLoadedForUser === userId ? jobs : [];
  const visibleJobsError = userId ? jobsError : "";
  const visibleJobsLoading = Boolean(userId && jobsLoadedForUser !== userId);
  const hasActiveJobs = jobs.some((job) => job.status === "queued" || job.status === "processing");
  const hasOnlyWaitingJobs = jobs.filter((job) => job.status === "queued" || job.status === "processing").every((job) => job.stage === "awaiting_free_credits");
  const hasCompletedJobResults = jobs.some((job) => job.status === "completed" && job.result_object_path);
  const selectedSignedResult = userId && signedResult?.userId === userId && signedResult.recordId === selectedRecordId ? signedResult : null;
  const presenter = virtualPresenters.find((item) => item.id === presenterId) ?? virtualPresenters[0];
  const imagePreview = useMemo(() => productImage ? URL.createObjectURL(productImage) : userId && uploadedImagePreview?.userId === userId && uploadedImagePreview.path === product.imageStoragePath ? uploadedImagePreview.url : product.imageUrl || "", [productImage, product.imageStoragePath, product.imageUrl, uploadedImagePreview, userId]);
  const configuration = useMemo<VideoConfiguration>(() => ({
    product,
    templateId,
    scenePresetId,
    presenterId,
    voiceGender,
    voiceProfileId,
    emotionalToneId,
    advertisingStyleId,
    narrationMode,
    motionMode,
    durationSeconds,
    format,
    mode,
    targetAudience,
  }), [product, templateId, scenePresetId, presenterId, voiceGender, voiceProfileId, emotionalToneId, advertisingStyleId, narrationMode, motionMode, durationSeconds, mode, targetAudience]);
  const suggestedScript = useMemo(() => buildAdvertisingScript(configuration), [configuration]);
  const effectiveScript = scriptEdited ? script : suggestedScript;
  const prompt = useMemo(() => buildVideoPrompt(configuration, effectiveScript), [configuration, effectiveScript]);
  const validationError = validateVideoConfiguration(configuration, effectiveScript);
  const status: VideoGenerationStatus = generationStatus === "awaiting_configuration" && !validationError ? "ready" : generationStatus;

  useEffect(() => () => {
    if (productImage && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview, productImage]);

  useEffect(() => {
    const client = getSupabase();
    const path = product.imageStoragePath;
    if (!userId || !client || !path || productImage) return;
    let active = true;
    void createVideoAssetUrl(client, userId, path)
      .then((url) => { if (active) setUploadedImagePreview({ userId, path, url }); })
      .catch((uploadError: unknown) => {
        if (active) setImageError(uploadError instanceof Error ? uploadError.message : "Não foi possível acessar a imagem privada.");
      });
    return () => { active = false; };
  }, [product.imageStoragePath, productImage, userId]);

  useEffect(() => {
    const record = library.find((item) => item.id === selectedRecordId);
    if (!record || record.resultUrl || !record.resultStoragePath || !userId) return;
    const client = getSupabase();
    if (!client) return;
    let active = true;
    void createVideoAssetUrl(client, userId, record.resultStoragePath)
      .then((url) => { if (active) setSignedResult({ userId, recordId: record.id, url }); })
      .catch((assetError: unknown) => {
        if (active) setSignedResult({ userId, recordId: record.id, error: assetError instanceof Error ? assetError.message : "Não foi possível acessar o vídeo privado." });
      });
    return () => { active = false; };
  }, [library, selectedRecordId, userId]);

  useEffect(() => {
    let active = true;
    const local = readLocalLibrary(libraryKey);
    void Promise.resolve().then(() => {
      if (!active) return;
      setLibraryLoading(true);
      setLibrary(local);
    });
    const client = getSupabase();
    if (!user || !client) {
      void Promise.resolve().then(() => { if (active) setLibraryLoading(false); });
      return () => { active = false; };
    }
    void client.from("mv_video_projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (!loadError && data) {
          const remote = (data as VideoProjectRow[]).map(fromDatabaseRow);
          setLibrary(remote);
          writeLocalLibrary(libraryKey, remote);
        }
        setLibraryLoading(false);
      });
    return () => { active = false; };
  }, [libraryKey, user]);

  useEffect(() => {
    const client = getSupabase();
    if (!user || !client) return;
    let active = true;
    void client.from("mv_products")
      .select("id,title,image_url,product_url,price_min,price_max,shop_name")
      .eq("user_id", user.id)
      .eq("in_latest_sync", true)
      .order("synced_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (active) setExistingProducts((data as ExistingProduct[] | null) ?? []); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const client = getSupabase();
    if (!userId || !client) return;
    let active = true;
    void client.functions.invoke("video-generation", { body: { action: "capabilities" } })
      .then(({ data, error: invokeError }) => {
        if (!active) return;
        setCheckingProduction(false);
        if (invokeError) {
          setProductionReadiness(null);
          setCapabilityUserId(null);
          setGeminiScriptAvailable(false);
          setJobManagementAvailable(false);
          setVideoProcessorAvailable(false);
          setGeminiCapabilityMessage("Não foi possível verificar os serviços de roteiro.");
          return;
        }
        setProductionServices(Array.isArray(data?.services) ? data.services : []);
        const readiness = data?.video?.readiness;
        setProductionReadiness(readiness && typeof readiness.message === "string" &&
          typeof readiness.ready === "boolean" && typeof readiness.imageReady === "boolean" &&
          typeof readiness.videoReady === "boolean" && typeof readiness.checkedAt === "string" ? readiness : null);
        const scriptCapability = data?.script;
        const available = scriptCapability?.available === true;
        setCapabilityUserId(userId);
        setGeminiScriptAvailable(available);
        setJobManagementAvailable(data?.jobs?.enabled === true);
        setVideoProcessorAvailable(data?.jobs?.processorAvailable === true);
        setGeminiCapabilityMessage(available
          ? "Seleção automática de serviço ou sugestão local."
          : "Roteiro por IA ainda não habilitado; use a sugestão local.");
      })
      .catch(() => {
        if (active) {
          setCheckingProduction(false);
          setProductionReadiness(null);
          setCapabilityUserId(null);
          setGeminiScriptAvailable(false);
          setJobManagementAvailable(false);
          setVideoProcessorAvailable(false);
          setGeminiCapabilityMessage("Não foi possível verificar os serviços de roteiro.");
        }
      });
    return () => { active = false; };
  }, [userId, capabilityRefresh]);

  useEffect(() => {
    const client = getSupabase();
    if (!userId || !client) return;
    let active = true;
    const refreshJobs = async () => {
      const { data, error: loadError } = await client.from("mv_video_jobs")
        .select("id,status,provider,stage,stage_message,next_attempt_at,progress,created_at,updated_at,completed_at,error_code,result_object_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      if (loadError) {
        setJobsError("Não foi possível carregar o histórico de tarefas. A migração local pode ainda não estar aplicada.");
      } else {
        setJobs((data as VideoJobRow[] | null) ?? []);
        setJobsError("");
      }
      setJobsLoadedForUser(userId);
    };
    void refreshJobs();
    const waitingOnly = hasOnlyWaitingJobs;
    const timer = hasActiveJobs ? window.setInterval(() => { if (!document.hidden) void refreshJobs(); }, waitingOnly ? 30000 : 3000) : null;
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [userId, hasActiveJobs, hasOnlyWaitingJobs]);

  useEffect(() => {
    const client = getSupabase();
    if (!userId || !client) return;
    let active = true;
    for (const job of jobs) {
      if (job.status !== "completed" || !job.result_object_path ||
        (jobResultUrls[job.id]?.userId === userId && (jobResultUrls[job.id]?.url || jobResultUrls[job.id]?.error))) continue;
      void createVideoAssetUrl(client, userId, job.result_object_path)
        .then((url) => {
          if (active) setJobResultUrls((current) => ({ ...current, [job.id]: { userId, url } }));
        })
        .catch((assetError: unknown) => {
          if (active) setJobResultUrls((current) => ({
            ...current,
            [job.id]: { userId, error: assetError instanceof Error ? assetError.message : "Não foi possível acessar o vídeo privado." },
          }));
        });
    }
    return () => { active = false; };
  }, [jobs, jobResultUrls, userId]);

  useEffect(() => {
    if (!userId || !hasCompletedJobResults) return;
    const timer = window.setInterval(() => setJobResultUrls({}), 240_000);
    return () => window.clearInterval(timer);
  }, [hasCompletedJobResults, userId]);

  function updateProduct<K extends keyof VideoProductInput>(field: K, value: VideoProductInput[K]) {
    setProduct((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function selectExistingProduct(id: string) {
    const selected = existingProducts.find((item) => item.id === id);
    if (!selected) {
      setProduct({ ...emptyProduct });
      setProductImage(null);
      return;
    }
    const price = selected.price_min === null ? "" : selected.price_max !== null && selected.price_max !== selected.price_min
      ? `R$ ${selected.price_min.toFixed(2)} a R$ ${selected.price_max.toFixed(2)}`
      : `R$ ${selected.price_min.toFixed(2)}`;
    setProduct({
      sourceProductId: selected.id,
      name: selected.title,
      description: selected.shop_name ? `Produto sincronizado da loja ${selected.shop_name}.` : "Produto sincronizado da conta conectada.",
      price,
      features: "",
      affiliateLink: selected.product_url,
      imageUrl: selected.image_url || "",
      imageName: "",
      imageStoragePath: "",
      clothingSize: "",
    });
    setProductImage(null);
    setScriptEdited(false);
  }

  function chooseProductImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageError("");
    if (!file) return;
    if (!allowedImageTypes.has(file.type)) {
      setImageError("Use uma imagem PNG, JPEG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_IMAGE_BYTES) {
      setImageError("A imagem deve ter no máximo 10 MB.");
      event.target.value = "";
      return;
    }
    setProductImage(file);
    updateProduct("imageName", file.name);
    updateProduct("imageUrl", "");
    updateProduct("imageStoragePath", "");
    setUploadedImagePreview(null);
  }

  async function uploadProductImage() {
    const client = getSupabase();
    if (!user || !client || !productImage) {
      setError("Entre na sua conta e selecione uma imagem para salvá-la no armazenamento privado.");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const path = await uploadVideoProductImage(client, user.id, productImage);
      updateProduct("imageStoragePath", path);
      setNotice("Imagem salva no armazenamento privado da sua conta.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível salvar a imagem.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function generateGeminiScript() {
    const client = getSupabase();
    if (!user || !client || !geminiScriptAvailable || generatingScript) return;
    setGeneratingScript(true);
    setError("");
    setNotice("");
    try {
      const { data, error: invokeError } = await client.functions.invoke("video-generation", {
        body: { action: "generate-script", configuration },
      });
      if (invokeError) throw new Error("Não foi possível preparar o roteiro.");
      if (!data || typeof data.script !== "string") {
        const message = typeof data?.error?.message === "string" ? data.error.message : "O backend não retornou um roteiro válido.";
        throw new Error(message);
      }
      setScript(data.script);
      setScriptEdited(true);
      setNotice(data.provider === "local" ? "Roteiro preparado localmente; os serviços de IA não responderam. Revise antes de usar." : "Roteiro preparado. Revise antes de usar.");
    } catch (scriptError) {
      setError(scriptError instanceof Error ? scriptError.message : "Não foi possível gerar o roteiro.");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function cancelVideoJob(jobId: string) {
    const client = getSupabase();
    if (!user || !client || !jobManagementAvailable || cancellingJobId) return;
    setCancellingJobId(jobId);
    setJobsError("");
    try {
      const { data, error: invokeError } = await client.functions.invoke("video-generation", {
        body: { action: "cancel-job", jobId },
      });
      if (invokeError || !data?.job) throw new Error("Não foi possível solicitar o cancelamento da tarefa.");
      const updated = data.job as VideoJobRow;
      setJobs((current) => current.map((job) => job.id === jobId ? { ...job, ...updated } : job));
    } catch (cancelError) {
      setJobsError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar a tarefa.");
    } finally {
      setCancellingJobId(null);
    }
  }

  async function downloadVideoJob(jobId: string) {
    const url = jobResultUrls[jobId]?.userId === userId ? jobResultUrls[jobId]?.url : undefined;
    if (!url || downloadingJobId) return;
    setDownloadingJobId(jobId);
    try {
      const result = await fetch(url, { credentials: "omit", redirect: "error" });
      if (!result.ok) throw new Error("Não foi possível baixar o MP4.");
      const file = await result.blob();
      if (file.type !== "video/mp4" || file.size === 0 || file.size > MAX_VIDEO_RESULT_BYTES) {
        throw new Error("O arquivo baixado não corresponde a um MP4 válido.");
      }
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `meu-vendedor-${jobId}.mp4`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setJobsError(downloadError instanceof Error ? downloadError.message : "Não foi possível baixar o MP4.");
    } finally {
      setDownloadingJobId(null);
    }
  }

  async function enqueueVideoJob() {
    const client = getSupabase();
    if (!user || !client || !queueAvailable || enqueueingJob) return;
    if (presenter.referenceStatus !== "ready") {
      setError(`A referência visual de ${presenter.name} ainda não está aprovada para processamento.`);
      return;
    }
    if (!product.imageStoragePath && !productImage) {
      setError("Selecione uma imagem do produto para gerar o vídeo.");
      return;
    }
    if (durationSeconds !== 6) {
      setError("A geração de vídeo atualmente aceita somente 6 segundos.");
      return;
    }
    const invalid = validateVideoConfiguration(configuration, effectiveScript);
    if (invalid) {
      setError(invalid);
      return;
    }

    setEnqueueingJob(true);
    setError("");
    setNotice("");
    try {
      const productPath = product.imageStoragePath || await uploadVideoProductImage(client, user.id, productImage!);
      if (!product.imageStoragePath) updateProduct("imageStoragePath", productPath);
      const referenceKey = `${user.id}:${productPath}:${presenterId}`;
      let references = aiReferenceCache.current?.key === referenceKey ? aiReferenceCache.current : null;
      if (!references) {
        const clientPresenter = presenter.image;
        if (!clientPresenter) throw new Error("A referência visual deste personagem ainda não está disponível.");
        const [productReference, presenterReference] = await Promise.all([
          createVideoProductAIReference(client, user.id, productPath),
          createVideoPresenterAIReference(client, user.id, clientPresenter),
        ]);
        references = {
          key: referenceKey,
          product: productReference,
          presenter: presenterReference,
        };
        aiReferenceCache.current = references;
      }
      const request = {
        templateId,
        scenePresetId,
        durationSeconds,
        format,
        presenterId,
        voiceGender,
        voiceProfileId,
        emotionalToneId,
        advertisingStyleId,
        narrationMode,
        motionMode,
        mode,
        targetAudience,
        script: effectiveScript,
        product: {
          name: product.name,
          description: product.description,
          price: product.price,
          features: product.features,
          clothingSize: product.clothingSize ?? "",
          imageStoragePath: productPath,
          aiReferenceStoragePath: references.product.path,
          aiReferenceWidth: references.product.width,
          aiReferenceHeight: references.product.height,
        },
        presenterReferenceStoragePath: references.presenter.path,
        presenterReferenceWidth: references.presenter.width,
        presenterReferenceHeight: references.presenter.height,
      };
      const fingerprint = JSON.stringify(request);
      const idempotencyKey = enqueueIdempotency.current?.fingerprint === fingerprint
        ? enqueueIdempotency.current.key
        : crypto.randomUUID();
      enqueueIdempotency.current = { fingerprint, key: idempotencyKey };
      const { data, error: invokeError } = await client.functions.invoke("video-generation", {
        body: {
          action: "enqueue-job",
          idempotencyKey,
          projectId: null,
          request,
        },
      });
      if (invokeError || !data?.job) {
        const message = typeof data?.error?.message === "string" ? data.error.message : "Não foi possível registrar a tarefa na fila.";
        throw new Error(message);
      }
      const queuedJob = data.job as VideoJobRow;
      setJobs((current) => [queuedJob, ...current.filter((job) => job.id !== queuedJob.id)].slice(0, 20));
      enqueueIdempotency.current = null;
      setStudioView("queue");
      setNotice("Pedido registrado. A produção usa os créditos da conta, troca de serviço automaticamente e aguarda na fila se não houver opção disponível.");
    } catch (enqueueError) {
      setError(enqueueError instanceof Error ? enqueueError.message : "Não foi possível registrar a tarefa na fila.");
    } finally {
      setEnqueueingJob(false);
    }
  }

  async function chooseTechnicalDemoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDemoVideoFile(null);
    setPendingDemoPath(null);
    setError("");
    if (!file) return;
    if (file.type !== "video/mp4") {
      setError("Use um arquivo MP4.");
      event.target.value = "";
      return;
    }
    if (file.size === 0 || file.size > MAX_VIDEO_DEMO_BYTES) {
      setError("O teste técnico deve ter entre 1 byte e 10 MB.");
      event.target.value = "";
      return;
    }
    setValidatingDemoVideo(true);
    try {
      const validation = await inspectTechnicalDemo(file);
      if (validation) {
        setError(validation);
        event.target.value = "";
        return;
      }
      setDemoVideoFile(file);
      setNotice("MP4 validado: 6 segundos, 9:16. A biblioteca o identificará como teste técnico sem IA.");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Não foi possível validar o MP4.");
    } finally {
      setValidatingDemoVideo(false);
    }
  }

  async function saveTechnicalDemo() {
    const client = getSupabase();
    if (!user || !client) {
      setError("Entre na sua conta para salvar o MP4 na área privada.");
      return;
    }
    if (!pendingDemoPath && !demoVideoFile) {
      setError("Selecione primeiro o MP4 técnico local.");
      return;
    }
    setSavingDemoVideo(true);
    setError("");
    setNotice("");
    try {
      const resultStoragePath = pendingDemoPath ?? await uploadVideoResult(client, user.id, demoVideoFile!);
      setPendingDemoPath(resultStoragePath);
      const { data, error: invokeError } = await client.functions.invoke("video-generation", {
        body: { action: "save-demo-result", resultStoragePath },
      });
      if (invokeError || !data?.project) {
        const message = typeof data?.error?.message === "string"
          ? data.error.message
          : "O MP4 foi enviado para a área privada, mas não foi registrado na biblioteca. Tente novamente.";
        throw new Error(message);
      }
      const record = fromDatabaseRow(data.project as VideoProjectRow);
      const next = [record, ...library.filter((item) => item.id !== record.id)].slice(0, 50);
      setLibrary(next);
      writeLocalLibrary(libraryKey, next);
      setSelectedRecordId(record.id);
      setPendingDemoPath(null);
      setDemoVideoFile(null);
      if (demoVideoInputRef.current) demoVideoInputRef.current.value = "";
      setNotice("Teste técnico salvo na biblioteca e no Storage privado. É uma imagem fixa convertida em MP4, sem geração por IA.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o teste técnico.");
    } finally {
      setSavingDemoVideo(false);
    }
  }

  function chooseTemplate(id: VideoTemplateId) {
    setTemplateId(id);
    const firstScene = videoScenePresets.find((scene) => scene.templateId === id);
    if (firstScene) setScenePresetId(firstScene.id);
    setScriptEdited(false);
  }

  function choosePresenter(id: PresenterId) {
    const selected = virtualPresenters.find((item) => item.id === id) ?? virtualPresenters[0];
    setPresenterId(id);
    setVoiceGender(selected.defaultVoiceGender);
    setVoiceProfileId(selected.defaultVoiceProfile);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copiado.`);
      setError("");
    } catch {
      setError(`Não foi possível copiar ${label.toLowerCase()}. Selecione o texto e copie manualmente.`);
    }
  }

  async function persistRecord(record: VideoLibraryRecord) {
    const next = [record, ...library.filter((item) => item.id !== record.id)].slice(0, 50);
    setLibrary(next);
    writeLocalLibrary(libraryKey, next);
    const client = getSupabase();
    if (!user || !client) return { remote: false, error: null };
    const { error: saveError } = await client.from("mv_video_projects").insert(toDatabaseRow(record));
    return { remote: !saveError, error: saveError };
  }

  async function simulateGeneration() {
    if (generationLock.current) return;
    const approvedScript = effectiveScript;
    const invalid = validateVideoConfiguration(configuration, approvedScript) ?? mockVideoProvider.validate({ configuration, script: approvedScript, prompt });
    if (invalid) {
      setError(invalid);
      setStatus("awaiting_configuration");
      return;
    }
    generationLock.current = true;
    setError("");
    setNotice("");
    try {
      setStatus("generating");
      const job = await mockVideoProvider.start({ configuration, script: approvedScript, prompt });
      setStatus("processing");
      await mockVideoProvider.status(job.id);
      await new Promise((resolve) => setTimeout(resolve, 450));
      const now = new Date().toISOString();
      const record = createVideoLibraryRecord(configuration, approvedScript, prompt, {
        id: crypto.randomUUID(),
        now,
        parentId,
        providerJobId: job.id,
      });
      const saved = await persistRecord(record);
      setSelectedRecordId(record.id);
      setParentId(null);
      setStatus("simulation_completed");
      setNotice(saved.remote
        ? "Simulação concluída e projeto salvo na sua biblioteca. Nenhuma chamada de vídeo foi executada."
        : "Simulação concluída e salva neste navegador. Entre na sua conta para sincronizar a biblioteca.");
    } catch {
      setStatus("failed");
      setError("Não foi possível concluir a simulação. Nenhum crédito foi consumido.");
    } finally {
      generationLock.current = false;
    }
  }

  function loadRecord(record: VideoLibraryRecord, newVersion: boolean) {
    setProduct({ ...record.product });
    setProductImage(null);
    setTemplateId(record.templateId);
    setScenePresetId(record.scenePresetId);
    setPresenterId(record.presenterId);
    setVoiceGender(record.voiceGender);
    setVoiceProfileId(record.voiceProfileId);
    setEmotionalToneId(record.emotionalToneId);
    setAdvertisingStyleId(record.advertisingStyleId);
    setNarrationMode(record.narrationMode);
    setMotionMode(record.motionMode);
    setDurationSeconds(6);
    setMode(record.mode);
    setTargetAudience(record.targetAudience);
    setScript(record.script);
    setScriptEdited(true);
    setParentId(newVersion ? record.id : record.parentId);
    setSelectedRecordId(record.id);
    setStudioView("create");
    setStudioStep(0);
    setNotice(newVersion ? "Configurações carregadas para uma nova versão." : "Configurações reutilizadas.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeRecord(id: string) {
    const next = library.filter((item) => item.id !== id);
    setLibrary(next);
    writeLocalLibrary(libraryKey, next);
    if (selectedRecordId === id) setSelectedRecordId(null);
    setRemoveId(null);
    const client = getSupabase();
    if (user && client) await client.from("mv_video_projects").delete().eq("id", id).eq("user_id", user.id);
    setNotice("Projeto removido da biblioteca.");
  }

  const previewRatio = "aspect-[9/16] max-w-[13rem]";
  const busy = status === "generating" || status === "processing";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Estúdio de criação</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Seu próximo vídeo começa aqui</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">Prepare o produto e a direção criativa. Acompanhe a produção e encontre seus projetos na biblioteca.</p>
          </div>
          <span className={`rounded-full px-3 py-2 text-xs font-medium ${queueAvailable ? "bg-primary-soft text-primary" : "bg-surface-muted text-muted"}`}>
            {queueAvailable ? "Créditos da conta · fila ativa" : user ? "Configuração de geração pendente" : "Entre para gerar vídeos"}
          </span>
        </div>
        <nav aria-label="Áreas do estúdio" className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-background p-1">
          {([{ id: "create", label: "Criar vídeo" }, { id: "queue", label: `Em produção (${visibleJobs.filter((job) => job.status === "queued" || job.status === "processing").length})` }, { id: "library", label: "Biblioteca" }] as const).map((item) => (
            <button key={item.id} type="button" onClick={() => setStudioView(item.id)} aria-current={studioView === item.id ? "page" : undefined}
              className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${studioView === item.id ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-foreground"}`}>{item.label}</button>
          ))}
        </nav>
      </section>

      <div className={studioView === "create" ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" : "hidden"}>
        <div className="min-w-0 space-y-5">
          <nav aria-label="Etapas de criação" className="grid grid-cols-3 gap-2">
            {["Produto", "Direção visual", "Roteiro e revisão"].map((label, index) => (
              <button key={label} type="button" aria-current={studioStep === index ? "step" : undefined} onClick={() => setStudioStep(index)}
                className={`rounded-xl border px-2 py-3 text-sm font-medium ${studioStep === index ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted"}`}>
                <span className="mr-2 text-xs opacity-70">0{index + 1}</span>{label}
              </button>
            ))}
          </nav>
          <div hidden={studioStep !== 0}>
          <Card titulo="Produto do anúncio">
            {existingProducts.length > 0 && (
              <label className="mb-4 block text-sm font-medium">
                Produto sincronizado no Meu Vendedor
                <select value={product.sourceProductId ?? ""} onChange={(event) => selectExistingProduct(event.target.value)} className={inputClass}>
                  <option value="">Cadastrar manualmente</option>
                  {existingProducts.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium sm:col-span-2">Nome do produto
                <input value={product.name} onChange={(event) => updateProduct("name", event.target.value)} maxLength={160} className={inputClass} placeholder="Ex.: blusa feminina de linho" />
              </label>
              <label className="block text-sm font-medium">Preço ou oferta informada
                <input value={product.price} onChange={(event) => updateProduct("price", event.target.value)} maxLength={80} className={inputClass} placeholder="Ex.: R$ 89,90" />
              </label>
              {templateId === "wearing-product" && (
                <label className="block text-sm font-medium">Tamanho informado (opcional)
                  <input
                    value={product.clothingSize ?? ""}
                    onChange={(event) => updateProduct("clothingSize", event.target.value)}
                    maxLength={40}
                    list="video-clothing-sizes"
                    className={inputClass}
                    placeholder="Ex.: P, M, G, GG ou outro"
                  />
                  <datalist id="video-clothing-sizes">
                    {["PP", "P", "M", "G", "GG", "XG", "XGG", "XXG"].map((size) => <option key={size} value={size} />)}
                  </datalist>
                  <span className="mt-1 block text-xs font-normal text-muted">Informe apenas o tamanho declarado para o produto; não inferimos medidas pelo personagem.</span>
                </label>
              )}
              <label className="block text-sm font-medium">Público-alvo (opcional)
                <input value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} maxLength={100} className={inputClass} placeholder="Ex.: pessoas que trabalham em casa" />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">Descrição
                <textarea value={product.description} onChange={(event) => updateProduct("description", event.target.value)} maxLength={1200} rows={3} className={inputClass} placeholder="Descreva somente informações confirmadas." />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">Características e diferenciais
                <textarea value={product.features} onChange={(event) => updateProduct("features", event.target.value)} maxLength={1000} rows={3} className={inputClass} placeholder="Uma característica por linha. Não inclua promessas não comprovadas." />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">Link de afiliado (opcional)
                <input type="url" value={product.affiliateLink} onChange={(event) => updateProduct("affiliateLink", event.target.value)} maxLength={2048} className={inputClass} placeholder="https://…" />
              </label>
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background p-4 text-center sm:col-span-2">
                {imagePreview ? (
                  // A imagem local é usada somente na prévia desta sessão.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Prévia do produto" className="mb-3 max-h-52 max-w-full rounded-lg object-contain" />
                ) : <ImagePlus className="mb-2 size-8 text-primary" aria-hidden />}
                <span className="text-sm font-semibold">{product.imageName || (product.imageUrl ? "Imagem do produto sincronizado" : "Adicionar imagem do produto")}</span>
                <span className="mt-1 text-xs text-muted">PNG, JPEG ou WebP · até 10 MB · prévia local até salvar no armazenamento privado</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseProductImage} className="sr-only" aria-label="Adicionar imagem do produto" />
              </label>
            </div>
            {productImage && user && (
              <button type="button" disabled={uploadingImage} onClick={() => void uploadProductImage()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                {uploadingImage ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                {uploadingImage ? "Salvando imagem…" : "Salvar imagem na área privada"}
              </button>
            )}
            {imageError && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{imageError}</p>}
          </Card>

          </div>
          <div hidden={studioStep !== 1} className="space-y-5">
          <Card titulo="Cena e cenário">
            <div className="grid gap-3 md:grid-cols-3">
              {videoTemplates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  aria-pressed={templateId === template.id}
                  onClick={() => chooseTemplate(template.id)}
                  className={`rounded-xl border p-4 text-left ${templateId === template.id ? "border-primary bg-primary-soft" : "border-border"}`}
                >
                  <span className="block text-sm font-semibold">{template.name}</span>
                  <span className="mt-1 block text-xs text-muted">{template.description}</span>
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium">Cenário desejado
              <select value={scenePresetId} onChange={(event) => setScenePresetId(event.target.value)} className={inputClass}>
                {videoScenePresets.filter((scene) => scene.templateId === templateId).map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.name} · {scene.category}</option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-muted">Escolha a direção do cenário. Composições já produzidas com as mesmas referências podem ser reutilizadas por até 30 dias.</p>
          </Card>

          <Card titulo="Apresentador">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {virtualPresenters.map((character) => (
                <button
                  type="button"
                  key={character.id}
                  aria-pressed={presenterId === character.id}
                  onClick={() => choosePresenter(character.id)}
                  disabled={character.referenceStatus !== "ready"}
                  className={`overflow-hidden rounded-2xl border text-left transition ${presenterId === character.id ? "border-primary ring-2 ring-primary-soft" : "border-border hover:border-primary/50"}`}
                >
                  <div className="relative aspect-[4/5] bg-surface-muted">
                    {character.image ? (
                      <Image src={character.image} alt={`Apresentador virtual ${character.name}`} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                    ) : (
                      <div role="img" aria-label={`Imagem de referência de ${character.name} pendente`} className="absolute inset-0 grid place-items-center p-5 text-center text-sm font-medium text-muted">
                        Imagem de referência original pendente
                      </div>
                    )}
                    {presenterId === character.id && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-background"><CheckCircle2 className="size-4" aria-hidden /></span>}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold">{character.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{character.description}</p>
                    <span className="mt-2 inline-flex rounded-full bg-surface-muted px-2 py-1 text-xs font-medium">
                      Biotipo: {character.bodyType === "plus-size" ? "Plus size" : "Esguio"}
                    </span>
                    {character.referenceStatus === "pending" && <p className="mt-2 text-xs font-semibold text-muted">Referência visual pendente</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Escolha um apresentador com referência disponível para gerar seu vídeo.</p>
          </Card>

          <Card titulo="Preferências de voz e movimento">
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-medium">Tipo de voz</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {voiceGenders.map((voice) => <button key={voice.id} type="button" aria-pressed={voiceGender === voice.id} onClick={() => setVoiceGender(voice.id)} className={`rounded-xl border px-3 py-3 text-sm ${voiceGender === voice.id ? "border-primary bg-primary-soft font-semibold" : "border-border"}`}>{voice.label}</button>)}
                </div>
              </fieldset>
              <label className="block text-sm font-medium">Característica da voz
                <select value={voiceProfileId} onChange={(event) => setVoiceProfileId(event.target.value as VoiceProfileId)} className={inputClass}>
                  {voiceProfiles.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium sm:col-span-2">Tom emocional
                <select value={emotionalToneId} onChange={(event) => setEmotionalToneId(event.target.value as EmotionalToneId)} className={inputClass}>
                  {emotionalTones.map((tone) => <option key={tone.id} value={tone.id}>{tone.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Modo de narração
                <select value={narrationMode} onChange={(event) => setNarrationMode(event.target.value as NarrationMode)} className={inputClass}>
                  {narrationModes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Movimento
                <select value={motionMode} onChange={(event) => setMotionMode(event.target.value as MotionMode)} className={inputClass}>
                  {motionModes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-muted">Essas opções são instruções de briefing; não geram áudio nem garantem sincronização labial ou movimento real nesta etapa.</p>
          </Card>

          <Card titulo="Estilo e formato">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium sm:col-span-2">Estilo do anúncio
                <select value={advertisingStyleId} onChange={(event) => setAdvertisingStyleId(event.target.value as AdvertisingStyleId)} className={inputClass}>
                  {advertisingStyles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Duração final
                <select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value) as VideoDuration)} className={inputClass}>
                  {videoDurations.map((seconds) => <option key={seconds} value={seconds} disabled={seconds !== 6}>{seconds} segundos{seconds !== 6 ? " · indisponível" : ""}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">Uma cena de 6 segundos. Durações maiores exigem montagem de cenas, ainda indisponível.</span>
              </label>
              <div className="block text-sm font-medium">Formato
                <p className={`${inputClass} cursor-not-allowed text-muted`} aria-label="Formato do vídeo">Vertical 9:16 · Reels, TikTok e Shorts</p>
              </div>
            </div>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Estratégia de produção</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {generationModes.map((option) => <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => setMode(option.id)} className={`rounded-xl border p-4 text-left ${mode === option.id ? "border-primary bg-primary-soft" : "border-border"}`}><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-xs text-muted">{option.description}</span></button>)}
              </div>
            </fieldset>
          </Card>

          </div>
          <div hidden={studioStep !== 2}>
          <Card titulo="Roteiro e revisão">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">O roteiro usa somente as informações preenchidas acima.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setScript(suggestedScript); setScriptEdited(false); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><RefreshCw className="size-3.5" aria-hidden />Roteiro local</button>
                <button type="button" disabled={!geminiScriptAvailable || generatingScript} onClick={() => void generateGeminiScript()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                  {generatingScript ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <WandSparkles className="size-3.5" aria-hidden />}
                  {generatingScript ? "Gerando…" : "Gerar roteiro com IA"}
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-muted">{geminiCapabilityNotice} O roteiro local permanece disponível.</p>
            <textarea value={effectiveScript} onChange={(event) => { setScript(event.target.value); setScriptEdited(true); }} maxLength={4000} rows={9} className={inputClass} aria-label="Roteiro editável" />
            <details className="mt-4 rounded-xl border border-border bg-background p-4">
              <summary className="cursor-pointer text-sm font-semibold">Ver direção de geração</summary>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={() => void copyText(prompt, "Prompt")} className="inline-flex items-center gap-1 text-xs text-primary underline"><Copy className="size-3.5" aria-hidden />Copiar</button>
              </div>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">{prompt}</pre>
            </details>
          </Card>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
            <button type="button" disabled={studioStep === 0} onClick={() => setStudioStep((step) => step - 1)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-30">Voltar</button>
            <span className="text-xs text-muted">Etapa {studioStep + 1} de 3</span>
            {studioStep < 2 ? <button type="button" onClick={() => setStudioStep((step) => step + 1)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background">Continuar</button>
              : <button type="button" onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">Revisar produção</button>}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5">
          <div ref={previewRef}>
            <Card titulo="Pré-visualização estática">
              <div className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-border bg-surface-muted ${previewRatio}`}>
                {presenter.image ? (
                  <Image src={presenter.image} alt={`Prévia com ${presenter.name}`} fill sizes="380px" className="object-cover" />
                ) : (
                  <div role="img" aria-label={`Imagem de referência de ${presenter.name} pendente`} className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-medium text-muted">
                    Referência visual de {presenter.name} pendente
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 to-transparent p-4 text-white">
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur">Prévia · sem consumo</span>
                </div>
                {imagePreview && (
                  <div className="absolute bottom-24 right-3 size-24 overflow-hidden rounded-xl border-2 border-white bg-white shadow-lg sm:size-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Produto na prévia" className="size-full object-contain" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pt-16 text-white">
                  <p className="text-lg font-bold">{product.name || "Seu produto"}</p>
                  <p className="mt-1 text-xs text-white/80">{presenter.name} · {advertisingStyles.find((item) => item.id === advertisingStyleId)?.label} · {durationSeconds}s</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">Esta composição serve para revisar escolhas. Ela não é um quadro gerado pela API e não consome créditos.</p>
            </Card>
          </div>

          <Card titulo="Produzir vídeo">
            {userId && <div className="mb-4 rounded-xl border border-border bg-background p-3" aria-live="polite">
              <p className="text-sm font-semibold">Disponibilidade para gerar agora</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{capabilityUserId === userId && productionReadiness ? productionReadiness.message : "Verifique a disponibilidade dos serviços antes de iniciar."}</p>
              {capabilityUserId === userId && productionReadiness && <p className="mt-2 text-xs text-muted">Imagem: {productionReadiness.imageReady ? "serviço configurado" : "configuração pendente"} · Vídeo: {productionReadiness.videoReady ? "serviço configurado" : "configuração pendente"}</p>}
              <button type="button" disabled={checkingProduction} onClick={() => { setCheckingProduction(true); setCapabilityRefresh((value) => value + 1); }} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary disabled:opacity-50">
                <RefreshCw className={`size-3 ${checkingProduction ? "animate-spin" : ""}`} aria-hidden />{checkingProduction ? "Verificando…" : "Verificar disponibilidade"}
              </button>
              <p className="mt-2 text-xs text-muted">Esta verificação não gera conteúdo nem consome créditos de IA.</p>
            </div>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Formato</dt><dd className="mt-1 font-semibold">Vertical · 9:16</dd></div>
              <div><dt className="text-xs text-muted">Duração</dt><dd className="mt-1 font-semibold">6 segundos</dd></div>
              <div><dt className="text-xs text-muted">Apresentador</dt><dd className="mt-1 font-semibold">{presenter.name}</dd></div>
              <div><dt className="text-xs text-muted">Cenário</dt><dd className="mt-1 font-semibold">{videoScenePresets.find((scene) => scene.id === scenePresetId)?.name}</dd></div>
            </dl>
            {validationError && <p className="mt-4 rounded-lg bg-background p-3 text-xs text-muted">{validationError}</p>}
            {!product.imageStoragePath && !productImage && <p className="mt-3 text-xs text-muted">Adicione uma imagem do produto para liberar a geração.</p>}
            <button type="button" disabled={!queueAvailable || enqueueingJob || busy || !!validationError || durationSeconds !== 6 || (!product.imageStoragePath && !productImage) || presenter.referenceStatus !== "ready"} onClick={() => void enqueueVideoJob()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">
              {enqueueingJob ? <><LoaderCircle className="size-4 animate-spin" aria-hidden />Preparando produção…</> : <><WandSparkles className="size-4" aria-hidden />{capabilityUserId === userId && productionReadiness && !productionReadiness.ready ? "Salvar pedido na fila" : "Gerar vídeo"}</>}
            </button>
            {!queueAvailable && <p className="mt-3 text-xs text-muted">{user ? "A geração ficará disponível quando os serviços de produção estiverem configurados." : "Entre na sua conta para gerar e guardar vídeos."}</p>}
            <p className="mt-3 text-xs leading-relaxed text-muted">Usa os créditos disponíveis nas contas e troca de serviço automaticamente quando possível. O fornecedor pode cobrar conforme o plano da conta. Se não houver opção disponível, o pedido aguarda preservando as etapas prontas.</p>
            {capabilityUserId === userId && productionServices.length > 0 && <details className="mt-4 border-t border-border pt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">Serviços de produção</summary>
              <ul className="mt-3 space-y-2 text-xs">{productionServices.map((service) => <li key={service.name} className="flex justify-between gap-3"><span>{service.name}</span><span className="text-right text-muted">{!service.configured ? "Sem configuração" : service.integrated ? "Integrado · saldo não verificado" : "Credencial presente · integração pendente"}</span></li>)}</ul>
            </details>}
            <details className="mt-4 border-t border-border pt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">Testar e exportar briefing</summary>
              <p className="mt-3 text-xs text-muted">A simulação salva um projeto sem produzir MP4 ou consumir créditos de IA.</p>
              <button type="button" disabled={busy || !!validationError} onClick={() => void simulateGeneration()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}Simular sem créditos
              </button>
              <p className="mt-2 text-xs text-muted">{statusLabels[status]}</p>
              <a href={FLOW_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs text-primary underline"><ExternalLink className="size-3" aria-hidden />Abrir Google Flow</a>
            </details>
          </Card>

          {!authLoading && !user && configured && (
            <div className="rounded-xl border border-border bg-accent-soft p-4 text-sm">
              <p className="font-semibold">Salvamento local ativo</p>
              <p className="mt-1 text-muted">A biblioteca funciona neste navegador. <Link href="/entrar" className="text-primary underline">Entre na sua conta</Link> para sincronizar projetos no Supabase.</p>
            </div>
          )}
        </aside>
      </div>

      {(error || notice) && (
        <div className="space-y-2">
          {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm">{notice}</p>}
        </div>
      )}

      <section hidden={studioView !== "queue"} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Fila e histórico de tarefas</h2>
            <p className="mt-1 text-sm text-muted">O andamento é recuperado do Supabase após atualizar a página.</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{visibleJobs.length} tarefa(s)</span>
        </div>
        {visibleJobsLoading ? <p role="status" className="mt-4 text-sm text-muted">Carregando tarefas…</p> : visibleJobsError ? (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{visibleJobsError}</p>
        ) : visibleJobs.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma tarefa foi enfileirada.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {visibleJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{jobStageLabels[job.stage_message ?? job.stage] ?? jobStatusLabels[job.status]}</p>
                  <p className="text-xs text-muted">
                    {new Date(job.created_at).toLocaleString("pt-BR")}
                    {job.provider !== "pending" ? ` · Provedor: ${jobProviderLabels[job.provider]}` : ""}
                    {job.error_code && job.stage !== "awaiting_free_credits" ? ` · ${job.error_code}` : ""}
                  </p>
                </div>
                {job.stage === "awaiting_free_credits" && <p className="w-full text-xs text-muted">Suas etapas prontas foram preservadas. Nova verificação automática{job.next_attempt_at ? ` às ${new Date(job.next_attempt_at).toLocaleTimeString("pt-BR")}` : " em breve"}. O processo será retomado quando houver um serviço disponível.</p>}
                <div className="min-w-28 text-right text-xs text-muted">
                  {job.status === "processing" ? `${job.progress}%` : job.completed_at ? "Finalizada" : "Aguardando"}
                </div>
                {jobManagementAvailable && (job.status === "queued" || job.status === "processing") && (
                  <button type="button" disabled={cancellingJobId !== null} onClick={() => void cancelVideoJob(job.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs disabled:opacity-50">
                    {cancellingJobId === job.id ? "Cancelando…" : "Cancelar"}
                  </button>
                )}
                {job.status === "completed" && job.result_object_path && jobResultUrls[job.id]?.userId === userId && jobResultUrls[job.id]?.url && (
                  <div className="w-full">
                    <video controls preload="metadata" src={jobResultUrls[job.id].url} className="mt-2 w-full rounded-lg bg-black" aria-label="Resultado MP4 da tarefa" />
                    <button type="button" disabled={downloadingJobId !== null} onClick={() => void downloadVideoJob(job.id)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs disabled:opacity-50">
                      <Download className="size-3" aria-hidden />Baixar MP4
                    </button>
                  </div>
                )}
                {jobResultUrls[job.id]?.error && <p role="alert" className="w-full text-xs text-danger">{jobResultUrls[job.id].error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section hidden={studioView !== "library"} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Library className="size-5 text-primary" aria-hidden />Biblioteca de vídeos</h2>
            <p className="mt-1 text-sm text-muted">Roteiros e configurações reutilizáveis. Os vídeos gerados ficam na área Em produção.</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{library.length} projeto(s)</span>
        </div>
        <details className="mt-5 rounded-xl border border-dashed border-border bg-background p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">Importar teste técnico · sem IA</summary>
          <p className="mt-1 text-sm text-muted">
            Gere um MP4 com <code>npm run video:demo -- /caminho/video.mp4</code> e selecione-o aqui.
            O render usa somente a imagem autorizada de Ana, sem produto, áudio ou geração audiovisual.
          </p>
          <p className="mt-1 text-xs text-muted">O envio é manual e usa a cota existente do Supabase Storage; nenhum vídeo é enviado automaticamente.</p>
          <label className="mt-3 block text-sm font-medium">
            MP4 técnico (6 segundos, 9:16, até 10 MB)
            <input ref={demoVideoInputRef} type="file" accept="video/mp4,.mp4" onChange={(event) => void chooseTechnicalDemoFile(event)} className="mt-2 block w-full text-sm" aria-label="Selecionar MP4 de teste técnico" />
          </label>
          {validatingDemoVideo && <p role="status" className="mt-2 text-xs text-muted">Validando duração e proporção…</p>}
          {demoVideoFile && <p className="mt-2 text-xs text-muted">Arquivo validado: {demoVideoFile.name}</p>}
          {pendingDemoPath && <p role="status" className="mt-2 text-xs text-muted">MP4 já enviado. O registro da biblioteca pode ser repetido sem reenviar o arquivo.</p>}
          <button type="button" disabled={!user || savingDemoVideo || validatingDemoVideo || (!demoVideoFile && !pendingDemoPath)} onClick={() => void saveTechnicalDemo()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {savingDemoVideo ? <><LoaderCircle className="size-4 animate-spin" aria-hidden />Salvando teste…</> : <><Upload className="size-4" aria-hidden />Salvar MP4 no Storage privado</>}
          </button>
          {!user && <p className="mt-2 text-xs text-muted">Entre na sua conta para guardar o arquivo de forma privada.</p>}
        </details>
        {libraryLoading ? <p role="status" className="mt-5 text-sm text-muted">Carregando biblioteca…</p> : library.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
            <Film className="mx-auto size-8 text-muted" aria-hidden />
            <p className="mt-3 font-semibold">Seus projetos ficam aqui</p>
            <p className="mt-1 text-sm text-muted">Crie um vídeo ou reutilize um projeto para começar.</p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 lg:grid-cols-2">
            {library.map((record) => {
              const character = virtualPresenters.find((item) => item.id === record.presenterId) ?? virtualPresenters[0];
              return <li key={record.id} className={`rounded-xl border p-4 ${selectedRecordId === record.id ? "border-primary bg-primary-soft/40" : "border-border bg-background"}`}>
                <div className="flex gap-3">
                  {character.image ? (
                    <Image src={character.image} alt="" width={64} height={80} className="h-20 w-16 rounded-lg object-cover" />
                  ) : (
                    <div role="img" aria-label={`Imagem de referência de ${character.name} pendente`} className="grid h-20 w-16 shrink-0 place-items-center rounded-lg bg-surface-muted p-1 text-center text-[10px] text-muted">
                      Referência pendente
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div><h3 className="truncate font-semibold">{record.product.name}</h3><p className="mt-1 text-xs text-muted">{character.name} · {videoTemplates.find((item) => item.id === record.templateId)?.name ?? "Template antigo"} · {record.durationSeconds}s · {record.format}</p></div>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[10px] font-semibold">{record.provider === "mock" && record.resultStoragePath ? "Teste técnico · sem IA" : statusLabels[record.status]}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted">{new Date(record.createdAt).toLocaleString("pt-BR")}{record.parentId ? " · nova versão" : ""}</p>
                  </div>
                </div>
                {selectedRecordId === record.id && (record.resultUrl || selectedSignedResult?.url) && (
                  <video controls preload="metadata" src={record.resultUrl || selectedSignedResult?.url} className="mt-3 w-full rounded-lg bg-black" aria-label={`Vídeo de ${record.product.name}`} />
                )}
                {expandedScriptId === record.id && <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs leading-relaxed">{record.script}</pre>}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => { setSelectedRecordId(record.id); previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-lg border border-border px-2.5 py-1.5">Visualizar</button>
                  <button type="button" onClick={() => setExpandedScriptId((current) => current === record.id ? null : record.id)} className="rounded-lg border border-border px-2.5 py-1.5">Roteiro</button>
                  <button type="button" onClick={() => loadRecord(record, false)} className="rounded-lg border border-border px-2.5 py-1.5">Reutilizar</button>
                  <button type="button" onClick={() => loadRecord(record, true)} className="rounded-lg border border-border px-2.5 py-1.5">Nova versão</button>
                  {record.resultUrl || (selectedRecordId === record.id && selectedSignedResult?.url) ? (
                    <a href={record.resultUrl || selectedSignedResult?.url} download className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5"><Download className="size-3" aria-hidden />MP4</a>
                  ) : (
                    <button type="button" disabled title="MP4 indisponível no modo demonstração" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 opacity-40"><Download className="size-3" aria-hidden />MP4</button>
                  )}
                  {removeId === record.id ? <><button type="button" onClick={() => void removeRecord(record.id)} className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-danger">Confirmar exclusão</button><button type="button" onClick={() => setRemoveId(null)} className="rounded-lg border border-border px-2.5 py-1.5">Cancelar</button></> : <button type="button" onClick={() => setRemoveId(record.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-danger"><Trash2 className="size-3" aria-hidden />Excluir</button>}
                </div>
              </li>;
            })}
          </ul>
        )}
        {selectedSignedResult?.error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{selectedSignedResult.error}</p>}
      </section>
    </div>
  );
}

import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { verifiedFreeAllowance, type FreeAllowance } from "./_shared/free-only.ts";
import { productionServiceInventory } from "./_shared/provider-inventory.ts";
import { routeAdvertisingScript } from "./_shared/script-router.ts";
import { productionReadiness } from "./_shared/production-readiness.ts";
import {
  createVideoGenerationHandler,
  requestGeminiScript,
  VideoJobError,
} from "./_shared/service.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const videoAssetBucket = "mv-video-assets";
const admin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const auth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function publicJob(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const fields = [
    "id", "project_id", "status", "provider", "provider_job_id", "attempt_count",
    "progress", "estimated_cost_usd", "result_object_path", "error_code", "stage", "stage_message",
    "cancel_requested_at", "next_attempt_at", "created_at", "updated_at", "started_at", "completed_at",
  ];
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]));
}

function publicProject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const fields = [
    "id", "source_product_id", "parent_id", "product_data", "template_id",
    "scene_preset_id", "presenter_id", "voice_gender", "voice_profile",
    "emotional_tone", "advertising_style", "narration_mode", "motion_mode",
    "duration_seconds", "aspect_ratio", "generation_mode", "target_audience",
    "script", "prompt", "provider", "provider_job_id", "status", "result_url",
    "result_storage_path", "created_at", "updated_at",
  ];
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]));
}

function jobError(error: { message: string }): VideoJobError {
  const known: Record<string, { status: number; message: string }> = {
    idempotency_key_conflict: { status: 409, message: "A chave de idempotência já foi usada com outra solicitação." },
    video_daily_limit: { status: 429, message: "O limite diário de solicitações foi atingido." },
    video_concurrency_limit: { status: 429, message: "Já existem tarefas em processamento para esta conta." },
    video_project_not_found: { status: 404, message: "Projeto não encontrado para esta conta." },
    video_project_job_exists: { status: 409, message: "Este projeto já possui uma tarefa. Crie uma nova versão para tentar novamente." },
    invalid_video_job_request: { status: 400, message: "A solicitação de geração não é válida." },
    invalid_video_job_configuration: { status: 400, message: "A configuração de geração não é válida." },
  };
  const code = Object.keys(known).find((candidate) => error.message.includes(candidate));
  if (!code) return new VideoJobError(503, "job_queue_unavailable", "Não foi possível registrar a solicitação na fila.");
  return new VideoJobError(known[code].status, code, known[code].message);
}

function configuredProviders() {
  return [
    { id: "magic-hour", model: "ltx-2.5", configured: Boolean(Deno.env.get("MAGIC_HOUR_API_KEY")) },
    { id: "replicate", model: "alibaba/happyhorse-1.0", configured: Boolean(Deno.env.get("REPLICATE_API_TOKEN")) },
  ];
}

function processorAvailable() {
  // A fila continua disponível durante a espera por cotas gratuitas verificadas.
  return Boolean(admin && anonKey && (Deno.env.get("MV_VIDEO_WORKER_SECRET") ?? "").length >= 32 && Deno.env.get("MV_AI_FREE_ONLY_ENABLED") !== "false");
}

async function scriptProviderFree(providerId: string, model: string): Promise<boolean> {
  if (!admin) return false;
  const { data, error } = await admin.rpc("mv_refresh_free_allowance", { p_provider_id: providerId, p_model: model });
  return !error && verifiedFreeAllowance(data as FreeAllowance | null, providerId, model);
}

Deno.serve(createVideoGenerationHandler({
  freeOnlyMode: () => true,
  productionReadiness: () => productionReadiness(
    (provider) => provider === "cloudflare-workers-ai"
      ? Boolean(Deno.env.get("CLOUDFLARE_ACCOUNT_ID") && Deno.env.get("CLOUDFLARE_AI_API_TOKEN"))
      : configuredProviders().some((entry) => entry.id === provider && entry.configured),
    async (provider, model) => {
      if (!admin) return null;
      const { data, error } = await admin.rpc("mv_refresh_free_allowance", { p_provider_id: provider, p_model: model });
      if (error) throw new Error("free_allowance_unavailable");
      return data as FreeAllowance | null;
    },
  ),
  authenticate: async (token) => {
    const { data: { user }, error } = await auth.auth.getUser(token);
    return error ? null : user?.id ?? null;
  },
  geminiApiKey: () => Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY"),
  geminiScriptEnabled: () => Deno.env.get("MV_AI_FREE_ONLY_ENABLED") !== "false",
  scriptProvidersConfigured: () => true, // Sugestão local sempre disponível, mesmo sem provedor gratuito.
  generateScriptWithFallback: (input) => routeAdvertisingScript(input, {
    isFreeProvider: scriptProviderFree,
    geminiKey: Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY"),
    groqKey: Deno.env.get("GROQ_API_KEY"),
    openRouterKey: Deno.env.get("OPENROUTER_API_KEY"),
  }),
  videoJobsEnabled: processorAvailable,
  videoProcessorAvailable: processorAvailable,
  videoProviders: configuredProviders,
  productionServices: () => productionServiceInventory((name) => Boolean(Deno.env.get(name))),
  generateScript: (input, apiKey) => requestGeminiScript(input, apiKey),
  enqueueJob: async (userId, projectId, idempotencyKey, requestData) => {
    if (!admin) throw new VideoJobError(503, "job_queue_unavailable", "A persistência da fila não está configurada.");
    const { data, error } = await admin.rpc("mv_enqueue_video_job", {
      p_user_id: userId,
      p_project_id: projectId,
      p_idempotency_key: idempotencyKey,
      p_request_data: requestData,
    });
    if (error) throw jobError(error);
    const job = publicJob(data);
    if (!job) throw new VideoJobError(503, "job_queue_unavailable", "Não foi possível registrar a solicitação na fila.");
    return job;
  },
  kickProcessor: () => {
    const workerUrl = `${supabaseUrl}/functions/v1/video-generation-worker`;
    const kick = fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        "x-worker-secret": Deno.env.get("MV_VIDEO_WORKER_SECRET") ?? "",
      },
      body: "{}",
    }).then((result) => {
      if (!result.ok) console.error("video-worker-kick-failed");
    }).catch(() => {
      console.error("video-worker-kick-failed");
    });
    EdgeRuntime.waitUntil(kick);
  },
  getJob: async (userId, jobId) => {
    if (!admin) throw new VideoJobError(503, "job_queue_unavailable", "A persistência da fila não está configurada.");
    const { data, error } = await admin.from("mv_video_jobs")
      .select("id,project_id,status,provider,provider_job_id,attempt_count,progress,estimated_cost_usd,result_object_path,error_code,stage,stage_message,cancel_requested_at,next_attempt_at,created_at,updated_at,started_at,completed_at")
      .eq("user_id", userId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new VideoJobError(503, "job_storage_unavailable", "Não foi possível consultar a tarefa.");
    return data ? publicJob(data) : null;
  },
  cancelJob: async (userId, jobId) => {
    if (!admin) throw new VideoJobError(503, "job_queue_unavailable", "A persistência da fila não está configurada.");
    const { data, error } = await admin.rpc("mv_cancel_video_job", {
      p_user_id: userId,
      p_job_id: jobId,
    });
    if (error) throw new VideoJobError(503, "job_storage_unavailable", "Não foi possível cancelar a tarefa.");
    return data ? publicJob(data) : null;
  },
  saveDemoResult: async (userId, resultStoragePath) => {
    if (!admin) throw new VideoJobError(503, "demo_result_unavailable", "O armazenamento privado não está configurado.");

    const fileName = resultStoragePath.split("/").at(-1)!;
    const { data: files, error: storageError } = await admin.storage.from(videoAssetBucket)
      .list(`${userId}/outputs`, { limit: 1, search: fileName });
    if (storageError) throw new VideoJobError(503, "demo_storage_unavailable", "Não foi possível validar o MP4 no armazenamento privado.");
    const storedFile = files?.find((file) => file.name === fileName);
    if (!storedFile || storedFile.metadata?.mimetype !== "video/mp4") {
      throw new VideoJobError(422, "demo_result_not_found", "O MP4 não foi encontrado no armazenamento privado desta conta.");
    }
    const fileSize = Number(storedFile.metadata?.size);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 10 * 1024 * 1024) {
      throw new VideoJobError(422, "demo_result_invalid", "O MP4 de teste excede o limite de 10 MB ou está vazio.");
    }
    const { data: demoFile, error: downloadError } = await admin.storage.from(videoAssetBucket).download(resultStoragePath);
    if (downloadError || !demoFile) {
      throw new VideoJobError(503, "demo_storage_unavailable", "Não foi possível validar o MP4 no armazenamento privado.");
    }
    if (demoFile.type !== "video/mp4" ||
      !((await demoFile.slice(0, 1024 * 1024).text()).includes("Still image of Ana; no AI video generation"))) {
      throw new VideoJobError(422, "demo_result_invalid", "O arquivo não corresponde ao teste técnico local aprovado.");
    }

    const { data: existing, error: lookupError } = await admin.from("mv_video_projects")
      .select("*")
      .eq("user_id", userId)
      .eq("result_storage_path", resultStoragePath)
      .maybeSingle();
    if (lookupError) throw new VideoJobError(503, "demo_result_unavailable", "Não foi possível consultar a biblioteca.");
    if (existing) {
      const project = publicProject(existing);
      if (project) return project;
      throw new VideoJobError(503, "demo_result_unavailable", "Não foi possível consultar a biblioteca.");
    }

    const { data, error } = await admin.from("mv_video_projects").insert({
      user_id: userId,
      product_data: {
        name: "Teste técnico local",
        description: "Imagem estática autorizada de Ana; sem visualização de produto e sem geração por IA.",
        price: "",
        features: "",
        affiliateLink: "",
        imageUrl: "",
        imageName: "",
        imageStoragePath: "",
        clothingSize: "",
      },
      template_id: "presenting-product",
      scene_preset_id: "neutral-product-table",
      presenter_id: "ana",
      voice_gender: "feminina",
      voice_profile: "natural",
      emotional_tone: "calmo",
      advertising_style: "profissional",
      narration_mode: "voiceover",
      motion_mode: "poses",
      duration_seconds: 6,
      aspect_ratio: "9:16",
      generation_mode: "economy",
      target_audience: "",
      script: "Teste de codificação local com imagem fixa autorizada. Nenhum roteiro publicitário ou vídeo de IA foi gerado.",
      prompt: "TESTE TÉCNICO LOCAL: imagem estática autorizada de Ana convertida em MP4; sem IA, áudio, produto ou try-on.",
      provider: "mock",
      status: "simulation_completed",
      result_url: null,
      result_storage_path: resultStoragePath,
    }).select("*").single();
    if (error) throw new VideoJobError(503, "demo_result_unavailable", "Não foi possível salvar o teste técnico na biblioteca.");
    const project = publicProject(data);
    if (!project) throw new VideoJobError(503, "demo_result_unavailable", "Não foi possível salvar o teste técnico na biblioteca.");
    return project;
  },
}));

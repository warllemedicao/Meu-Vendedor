import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  createVideoGenerationHandler,
  requestGeminiScript,
  VideoJobError,
} from "./_shared/service.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
    "progress", "estimated_cost_usd", "result_object_path", "error_code",
    "cancel_requested_at", "created_at", "updated_at", "started_at", "completed_at",
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

Deno.serve(createVideoGenerationHandler({
  authenticate: async (token) => {
    const { data: { user }, error } = await auth.auth.getUser(token);
    return error ? null : user?.id ?? null;
  },
  geminiApiKey: () => Deno.env.get("GEMINI_API_KEY"),
  geminiScriptEnabled: () => Deno.env.get("MV_GEMINI_SCRIPT_ENABLED") === "true",
  videoJobsEnabled: () => Boolean(admin) && Deno.env.get("MV_VIDEO_JOBS_ENABLED") === "true",
  videoProcessorAvailable: () => false,
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
  getJob: async (userId, jobId) => {
    if (!admin) throw new VideoJobError(503, "job_queue_unavailable", "A persistência da fila não está configurada.");
    const { data, error } = await admin.from("mv_video_jobs")
      .select("id,project_id,status,provider,provider_job_id,attempt_count,progress,estimated_cost_usd,result_object_path,error_code,cancel_requested_at,created_at,updated_at,started_at,completed_at")
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
}));

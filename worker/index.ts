interface WorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MV_SYNC_JOB_TOKEN: string;
  MV_VIDEO_WORKER_SECRET: string;
  MV_SUPABASE_PUBLISHABLE_KEY: string;
}

const marketplaceCron = "*/30 * * * *";
const videoCron = "* * * * *";
const videoWorkerUrl = "https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/video-generation-worker";

async function syncMarketplace(env: WorkerEnv): Promise<void> {
  if (!env.MV_SYNC_JOB_TOKEN) throw new Error("marketplace_scheduler_not_configured");
  const response = await fetch("https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/marketplace", {
    method: "POST",
    headers: { "x-mv-job-token": env.MV_SYNC_JOB_TOKEN, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(140_000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`marketplace_scheduler_http_${response.status}`);
}

async function processVideoQueue(env: WorkerEnv): Promise<void> {
  if (!env.MV_VIDEO_WORKER_SECRET || !env.MV_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("video_scheduler_not_configured");
  }
  let response: Response;
  try {
    response = await fetch(videoWorkerUrl, {
      method: "POST",
      headers: {
        "apikey": env.MV_SUPABASE_PUBLISHABLE_KEY,
        "x-worker-secret": env.MV_VIDEO_WORKER_SECRET,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    const sanitized = [env.MV_VIDEO_WORKER_SECRET, env.MV_SUPABASE_PUBLISHABLE_KEY]
      .filter(Boolean).reduce((message, secret) => message.split(secret).join("[redacted]"), reason);
    console.error(JSON.stringify({ event: "video_scheduler_fetch_failed", reason: sanitized.slice(0, 300) }));
    throw new Error("video_scheduler_request_failed");
  }
  if (response.status === 503) {
    const body = (await response.text()).trim();
    if (body === '{"error":"processor_disabled"}') {
      console.warn("video_processor_disabled");
      return;
    }
  }
  if (!response.ok) throw new Error(`video_scheduler_http_${response.status}`);
}

const worker = {
  fetch(request: Request, env: WorkerEnv) {
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller: { cron: string }, env: WorkerEnv): Promise<void> {
    if (controller.cron === marketplaceCron) return syncMarketplace(env);
    if (controller.cron === videoCron) return processVideoQueue(env);
    throw new Error("unsupported_cron_trigger");
  },
};

export default worker;

import {
  AIProviderFailure,
  AIProviderRouter,
  AIRoutingError,
  type AIProviderAdapter,
  type AIProviderAttemptStore,
  type AIRoutingPolicy,
} from "./ai-provider-router.ts";
import type {
  CloudflareImageRequest,
  CloudflareImageResult,
} from "./providers/cloudflare-workers-ai.ts";
import type {
  MagicHourVideoRequest,
  MagicHourVideoStatus,
} from "./providers/magic-hour.ts";
import type {
  ReplicateVideoStatus,
} from "./providers/replicate.ts";

export type VideoJobStage =
  | "queued"
  | "image_generating"
  | "image_ready"
  | "video_submitting"
  | "video_processing"
  | "validating"
  | "awaiting_authorization"
  | "awaiting_free_credits"
  | "uncertain"
  | "completed"
  | "failed"
  | "cancelled";

export interface VideoProcessingJob {
  id: string;
  user_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  stage: VideoJobStage;
  lease_token: string;
  request_data: Record<string, unknown>;
  provider: string;
  provider_job_id: string | null;
  intermediate_image_path: string | null;
  result_object_path: string | null;
  cancel_requested_at: string | null;
  progress: number;
  status_poll_attempts: number;
  finalization_attempts?: number;
}

export interface VideoProcessorAdvance {
  stage: VideoJobStage;
  progress: number;
  provider?: string;
  providerJobId?: string;
  intermediateImagePath?: string;
  resultObjectPath?: string;
  errorCode?: string;
  delaySeconds?: number;
}

export interface VideoProcessorDependencies {
  claim(): Promise<VideoProcessingJob | null>;
  createImageRequest(job: VideoProcessingJob): Promise<CloudflareImageRequest>;
  findCachedImage?(job: VideoProcessingJob, request: CloudflareImageRequest): Promise<string | null>;
  rememberImage?(job: VideoProcessingJob, request: CloudflareImageRequest, path: string): Promise<void>;
  createImageRouter(job: VideoProcessingJob): AIProviderAdapter<CloudflareImageRequest, CloudflareImageResult> & {
    generate(request: CloudflareImageRequest, idempotencyKey: string): Promise<CloudflareImageResult>;
  };
  storeIntermediate(job: VideoProcessingJob, bytes: Uint8Array, mimeType: string): Promise<string>;
  loadIntermediate(job: VideoProcessingJob): Promise<{ bytes: Uint8Array; mimeType: MagicHourVideoRequest["imageMimeType"] }>;
  createVideoRouter(
    job: VideoProcessingJob,
    image: { bytes: Uint8Array; mimeType: MagicHourVideoRequest["imageMimeType"] },
    excludeProviders: ReadonlySet<string>,
  ): AIProviderAdapter<VideoGenerationRequest, VideoSubmission>[];
  createVideoRequest(
    job: VideoProcessingJob,
    image: { bytes: Uint8Array; mimeType: MagicHourVideoRequest["imageMimeType"] },
  ): Promise<VideoGenerationRequest>;
  videoStatus(providerId: string, remoteJobId: string): Promise<MagicHourVideoStatus | ReplicateVideoStatus>;
  cancelVideo(providerId: string, remoteJobId: string): Promise<void>;
  downloadVideo(providerId: string, url: string): Promise<Uint8Array>;
  storeResult(job: VideoProcessingJob, path: string, bytes: Uint8Array): Promise<void>;
  readStoredResult(job: VideoProcessingJob, path: string): Promise<Uint8Array | null>;
  outputUrl(providerId: string, remoteJobId: string): Promise<string | null>;
  triedVideoProviders(jobId: string): Promise<ReadonlySet<string>>;
  recordVideoStatusFailure(job: VideoProcessingJob, code: string): Promise<void>;
  advance(job: VideoProcessingJob, update: VideoProcessorAdvance): Promise<void>;
  createAttemptStore(job: VideoProcessingJob, stage: "image" | "video"): AIProviderAttemptStore;
  routingPolicy(): AIRoutingPolicy;
  now?(): number;
}

export interface VideoGenerationRequest {
  image: Uint8Array;
  imageMimeType: MagicHourVideoRequest["imageMimeType"];
  imageUrl: string;
  prompt: string;
  durationSeconds: 6;
  aspectRatio: "9:16";
}

export interface VideoSubmission {
  providerJobId: string;
  creditsCharged?: number;
  estimatedCostUsd: number;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

interface Mp4Metadata {
  durationSeconds: number;
  width: number;
  height: number;
}

function childBoxes(bytes: Uint8Array, start: number, end: number): Array<{ type: string; start: number; end: number }> {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const high = readUint32(bytes, offset + 8);
      const low = readUint32(bytes, offset + 12);
      if (high !== 0) break;
      size = low;
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    boxes.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function readMp4Metadata(bytes: Uint8Array): Mp4Metadata | null {
  if (bytes.byteLength < 32) return null;
  const top = childBoxes(bytes, 0, bytes.byteLength);
  if (top[0]?.type !== "ftyp") return null;
  const moov = top.find((box) => box.type === "moov");
  if (!moov) return null;
  const moovChildren = childBoxes(bytes, moov.start, moov.end);
  const mvhd = moovChildren.find((box) => box.type === "mvhd");
  if (!mvhd || mvhd.start + 20 > mvhd.end) return null;
  const version = bytes[mvhd.start];
  const timescaleOffset = version === 1 ? mvhd.start + 20 : mvhd.start + 12;
  const durationOffset = version === 1 ? mvhd.start + 24 : mvhd.start + 16;
  if (durationOffset + (version === 1 ? 8 : 4) > mvhd.end) return null;
  const timescale = readUint32(bytes, timescaleOffset);
  const duration = version === 1
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(durationOffset)
    : BigInt(readUint32(bytes, durationOffset));
  if (timescale === 0) return null;
  const durationSeconds = Number(duration) / timescale;

  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const trackBoxes = childBoxes(bytes, trak.start, trak.end);
    const tkhd = trackBoxes.find((box) => box.type === "tkhd");
    const mdia = trackBoxes.find((box) => box.type === "mdia");
    if (!tkhd || !mdia) continue;
    const mediaBoxes = childBoxes(bytes, mdia.start, mdia.end);
    const hdlr = mediaBoxes.find((box) => box.type === "hdlr");
    if (!hdlr || hdlr.start + 12 > hdlr.end ||
      String.fromCharCode(...bytes.slice(hdlr.start + 8, hdlr.start + 12)) !== "vide") continue;
    const tkhdVersion = bytes[tkhd.start];
    const widthOffset = tkhd.start + (tkhdVersion === 1 ? 88 : 76);
    const heightOffset = widthOffset + 4;
    if (heightOffset + 4 > tkhd.end) continue;
    const width = readUint32(bytes, widthOffset) / 65536;
    const height = readUint32(bytes, heightOffset) / 65536;
    return { durationSeconds, width, height };
  }
  return null;
}

export function validateGeneratedMp4(bytes: Uint8Array): Mp4Metadata {
  const metadata = readMp4Metadata(bytes);
  if (!metadata || !Number.isFinite(metadata.durationSeconds) ||
    Math.abs(metadata.durationSeconds - 6) > 0.1 ||
    !Number.isFinite(metadata.width) || !Number.isFinite(metadata.height) ||
    Math.abs(metadata.width / metadata.height - 9 / 16) > 0.005) {
    throw new AIProviderFailure("generated_video_validation_failed", "incompatible", "accepted");
  }
  return metadata;
}

function errorCode(error: unknown): string {
  if (error instanceof AIRoutingError) {
    if (error.code === "provider_submission_uncertain") return "provider_submission_uncertain";
    const reasons = error.attempts.map((attempt) => attempt.reason ?? "");
    if (reasons.some((reason) => reason.includes("budget"))) return "budget_authorization_required";
    if (reasons.some((reason) => reason.includes("funding") || reason.includes("commercial"))) return "provider_authorization_required";
    if (reasons.some((reason) => reason.includes("credits"))) return "provider_credits_unavailable";
    if (reasons.some((reason) => reason.includes("incompatible"))) return "provider_incompatible";
  }
  if (error instanceof AIProviderFailure) return error.code;
  return "video_processing_failed";
}

function needsAuthorization(error: unknown): boolean {
  return errorCode(error).endsWith("_required") || errorCode(error) === "provider_credits_unavailable";
}

export function createVideoProcessor(dependencies: VideoProcessorDependencies) {
  return {
    async processNext(): Promise<"idle" | VideoJobStage> {
      const job = await dependencies.claim();
      if (!job) return "idle";

      try {
        if (job.cancel_requested_at) {
          if (["queued", "image_ready", "awaiting_free_credits", "awaiting_authorization"].includes(job.stage)) {
            await dependencies.advance(job, { stage: "cancelled", progress: job.progress ?? 0 });
            return "cancelled";
          }
          if (job.provider === "replicate" && job.provider_job_id) {
            try {
              await dependencies.cancelVideo(job.provider, job.provider_job_id);
            } catch {
              await dependencies.advance(job, {
                stage: "video_processing",
                progress: job.progress ?? 0,
                errorCode: "cancel_retry_pending",
                delaySeconds: 60,
              });
              return "video_processing";
            }
            await dependencies.advance(job, { stage: "cancelled", progress: job.progress ?? 0 });
            return "cancelled";
          }
          if (!job.provider_job_id) {
            await dependencies.advance(job, { stage: "cancelled", progress: job.progress ?? 0 });
            return "cancelled";
          }
        }

        if (job.stage === "awaiting_authorization" || job.stage === "awaiting_free_credits") {
          // Reavaliar a configuração sem descartar uma imagem já produzida.
          await dependencies.advance(job, {
            stage: job.intermediate_image_path ? "image_ready" : "queued",
            progress: job.intermediate_image_path ? 35 : 0,
          });
          return job.intermediate_image_path ? "image_ready" : "queued";
        }

        if (job.stage === "queued" || job.stage === "image_generating") {
          const request = await dependencies.createImageRequest(job);
          const cachedPath = await dependencies.findCachedImage?.(job, request);
          if (cachedPath) {
            await dependencies.advance(job, { stage: "image_ready", progress: 35, intermediateImagePath: cachedPath });
            return "image_ready";
          }
          const router = dependencies.createImageRouter(job);
          const routed = await new AIProviderRouter<CloudflareImageRequest, CloudflareImageResult>(
            [router],
            dependencies.createAttemptStore(job, "image"),
            dependencies.routingPolicy(),
          ).generate(
            { task: "image", inputModes: ["text", "image-reference"], referenceImageCount: request.references.length, aspectRatio: "9:16", commercialUse: true },
            request,
            `${job.id}:image`,
          );
          const image = routed.result;
          const path = await dependencies.storeIntermediate(job, image.bytes, image.mimeType);
          // Salvar a etapa antes do índice de cache impede que falhas no cache repitam uma chamada paga.
          await dependencies.advance(job, {
            stage: "image_ready",
            progress: 35,
            intermediateImagePath: path,
          });
          await dependencies.rememberImage?.(job, request, path).catch(() => undefined);
          return "image_ready";
        }

        if (job.stage === "image_ready") {
          if (!job.intermediate_image_path) throw new Error("intermediate_image_missing");
          const image = await dependencies.loadIntermediate(job);
          const request = await dependencies.createVideoRequest(job, image);
          const excluded = await dependencies.triedVideoProviders(job.id);
          const providers = dependencies.createVideoRouter(job, image, excluded);
          const routed = await new AIProviderRouter<VideoGenerationRequest, VideoSubmission>(
            providers,
            dependencies.createAttemptStore(job, "video"),
            dependencies.routingPolicy(),
          ).generate(
            { task: "video", inputModes: ["image-reference"], referenceImageCount: 1, durationSeconds: 6, aspectRatio: "9:16", commercialUse: true },
            request,
            `${job.id}:video`,
          );
          const submission = routed.result;
          await dependencies.advance(job, {
            stage: "video_processing",
            progress: 55,
            provider: routed.providerId,
            providerJobId: submission.providerJobId,
            delaySeconds: 15,
          });
          return "video_processing";
        }

        if (job.stage === "video_processing") {
          if (!job.provider_job_id || !["magic-hour", "replicate"].includes(job.provider)) {
            throw new Error("remote_video_job_missing");
          }
          let remote: MagicHourVideoStatus | ReplicateVideoStatus;
          try {
            remote = await dependencies.videoStatus(job.provider, job.provider_job_id);
          } catch (error) {
            await dependencies.recordVideoStatusFailure(job, errorCode(error));
            const attempts = (job.status_poll_attempts ?? 0) + 1;
            if (attempts >= 120) throw new Error("remote_video_status_timeout");
            await dependencies.advance(job, {
              stage: "video_processing",
              progress: job.progress,
              delaySeconds: Math.min(300, attempts * 15),
            });
            return "video_processing";
          }
          if (remote.status === "queued" || remote.status === "processing") {
            if (job.status_poll_attempts >= 120) {
              throw new AIProviderFailure("remote_video_status_timeout", "uncertain", "accepted");
            }
            await dependencies.advance(job, {
              stage: "video_processing",
              progress: Math.max(job.progress ?? 0, 55 + Math.min(35, Math.floor(remote.progress * 0.35))),
              errorCode: job.cancel_requested_at ? "cancel_requested_remote_continues" : undefined,
              delaySeconds: 60,
            });
            return "video_processing";
          }
          if (job.cancel_requested_at) {
            await dependencies.advance(job, { stage: "cancelled", progress: job.progress ?? 0 });
            return "cancelled";
          }
          if (remote.status === "failed") {
            await dependencies.recordVideoStatusFailure(job, remote.errorCode ?? "provider_generation_failed");
            await dependencies.advance(job, {
              stage: "image_ready",
              progress: 45,
              errorCode: "trying_another_provider",
            });
            return "image_ready";
          }
          if (remote.status === "cancelled") {
            await dependencies.advance(job, { stage: "cancelled", progress: job.progress ?? 0 });
            return "cancelled";
          }
          await dependencies.advance(job, { stage: "validating", progress: 95 });
          return "validating";
        }

        if (job.stage === "validating") {
          if (!job.provider_job_id || !["magic-hour", "replicate"].includes(job.provider)) {
            throw new Error("remote_video_job_missing");
          }
          const path = `${job.user_id}/outputs/${job.id}.mp4`;
          const existing = await dependencies.readStoredResult(job, path);
          if (existing) {
            validateGeneratedMp4(existing);
            await dependencies.advance(job, { stage: "completed", progress: 100, resultObjectPath: path });
            return "completed";
          }
          const outputUrl = await dependencies.outputUrl(job.provider, job.provider_job_id);
          if (!outputUrl) throw new Error("provider_output_missing");
          const bytes = await dependencies.downloadVideo(job.provider, outputUrl);
          validateGeneratedMp4(bytes);
          await dependencies.storeResult(job, path, bytes);
          await dependencies.advance(job, { stage: "completed", progress: 100, resultObjectPath: path });
          return "completed";
        }
        throw new Error("video_job_stage_invalid");
      } catch (error) {
        const code = errorCode(error);
        if (error instanceof AIRoutingError && error.code === "free_resources_unavailable") {
          await dependencies.advance(job, {
            stage: "awaiting_free_credits", progress: job.intermediate_image_path ? 35 : 0,
            errorCode: "waiting_for_free_resources",
            delaySeconds: Math.min(3600, Math.max(60, Math.ceil(error.retryAfterMs / 1000))),
          });
          return "awaiting_free_credits";
        }
        if (job.stage === "validating" && error instanceof AIProviderFailure && error.category === "incompatible") {
          await dependencies.recordVideoStatusFailure(job, code);
          await dependencies.advance(job, { stage: "image_ready", progress: 45, errorCode: "trying_another_provider" });
          return "image_ready";
        }
        if (job.stage === "validating" && (!(error instanceof AIProviderFailure) || error.category === "transient") && (job.finalization_attempts ?? 0) < 10) {
          // Download e Storage podem ser repetidos sem gerar outro vídeo pago.
          await dependencies.advance(job, { stage: "validating", progress: 95, errorCode: "retrying_video_finalization", delaySeconds: 30 });
          return "validating";
        }
        const stage = code === "provider_submission_uncertain" || code === "remote_video_status_timeout"
          ? "uncertain"
          : needsAuthorization(error)
            ? "awaiting_authorization"
            : "failed";
        await dependencies.advance(job, {
          stage,
          progress: job.progress ?? 0,
          errorCode: code,
          delaySeconds: stage === "awaiting_authorization" ? 300 : 0,
        });
        return stage;
      }
    },
  };
}

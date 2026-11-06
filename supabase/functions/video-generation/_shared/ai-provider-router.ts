export type AITask = "image" | "video" | "audio";
export type AIInputMode = "text" | "image-reference" | "video-reference";

export interface AITaskRequirements {
  task: AITask;
  inputModes: readonly AIInputMode[];
  referenceImageCount: number;
  durationSeconds?: number;
  aspectRatio?: string;
  commercialUse: boolean;
}

export interface AIProviderCapabilities {
  id: string;
  task: AITask;
  model: string;
  inputModes: readonly AIInputMode[];
  maxReferenceImages: number;
  durationsSeconds: readonly number[] | null;
  aspectRatios: readonly string[];
  maxResolution: string | null;
  nativeAudio: boolean;
  lipSync: boolean;
  commercialUse: "confirmed" | "not-confirmed" | "not-permitted";
  freeTier: "confirmed" | "unknown" | "unavailable";
  supportsBalanceQuery: boolean;
  costUsdPerUnit: number | null;
  costUnit: "image" | "second" | "neuron" | "credit";
}

export interface AIProviderReadiness {
  authenticated: boolean;
  available: boolean;
  funding: "free-confirmed" | "paid-authorized" | "unknown" | "insufficient";
  balanceUnits: number | null;
  cooldownUntil?: number | null;
  noChargeGuaranteed?: boolean;
}

export interface AIRoutingPolicy {
  billingMode?: "free-only";
  allowPaidGeneration: boolean;
  allowUnconfirmedCommercialUse: boolean;
  maxCostUsdPerTask: number;
  remainingDailyBudgetUsd: number;
  paidProviders: ReadonlySet<string>;
}

export interface AIProviderAdapter<Request = unknown, Result = unknown> {
  capabilities: AIProviderCapabilities;
  readiness(): Promise<AIProviderReadiness>;
  estimate(request: Request): Promise<{ units: number; usd: number | null }>;
  generate(request: Request, idempotencyKey: string): Promise<Result>;
}

export interface AIAttemptRecord {
  providerId: string;
  model: string;
  status: "started" | "succeeded" | "failed" | "uncertain" | "skipped";
  reason?: string;
  estimatedCostUsd?: number | null;
}

export interface AIProviderAttemptStore {
  reserveFree?(providerId: string, units: number): Promise<boolean>;
  record(attempt: AIAttemptRecord): Promise<void>;
  reserve(providerId: string, costUsd: number, maxCostUsd: number, dailyRemainingUsd: number): Promise<boolean>;
  settle(providerId: string, costUsd: number): Promise<void>;
  release(providerId: string): Promise<void>;
  setCooldown(providerId: string, until: number): Promise<void>;
}

export class AIProviderFailure extends Error {
  readonly code: string;
  readonly category: "auth" | "credits" | "rate-limit" | "transient" | "incompatible" | "uncertain";
  readonly submission: "not-started" | "rejected" | "accepted" | "unknown";
  readonly retryAfterMs: number;

  constructor(
    code: string,
    category: "auth" | "credits" | "rate-limit" | "transient" | "incompatible" | "uncertain",
    submission: "not-started" | "rejected" | "accepted" | "unknown" = "rejected",
    retryAfterMs = 0,
  ) {
    super(code);
    this.code = code;
    this.category = category;
    this.submission = submission;
    this.retryAfterMs = retryAfterMs;
  }
}

export class AIRoutingError extends Error {
  readonly code: "no_eligible_provider" | "provider_submission_uncertain" | "all_providers_failed" | "free_resources_unavailable";
  readonly attempts: readonly AIAttemptRecord[];
  readonly retryAfterMs: number;

  constructor(
    code: "no_eligible_provider" | "provider_submission_uncertain" | "all_providers_failed" | "free_resources_unavailable",
    attempts: readonly AIAttemptRecord[],
    retryAfterMs = 900_000,
  ) {
    super(code);
    this.code = code;
    this.attempts = attempts;
    this.retryAfterMs = retryAfterMs;
  }
}

function supports(capabilities: AIProviderCapabilities, requirements: AITaskRequirements): boolean {
  if (capabilities.task !== requirements.task) return false;
  if (requirements.referenceImageCount > capabilities.maxReferenceImages) return false;
  if (!requirements.inputModes.every((mode) => capabilities.inputModes.includes(mode))) return false;
  if (requirements.aspectRatio && !capabilities.aspectRatios.includes(requirements.aspectRatio)) return false;
  if (requirements.durationSeconds !== undefined &&
    capabilities.durationsSeconds !== null &&
    !capabilities.durationsSeconds.includes(requirements.durationSeconds)) return false;
  return true;
}

function eligibilityFailure(
  capabilities: AIProviderCapabilities,
  readiness: AIProviderReadiness,
  estimate: { units: number; usd: number | null },
  requirements: AITaskRequirements,
  policy: AIRoutingPolicy,
  now: number,
): string | null {
  if (!readiness.authenticated) return "authentication_unavailable";
  if (!readiness.available) return "provider_unavailable";
  if ((readiness.cooldownUntil ?? 0) > now) return "provider_cooldown";
  if (requirements.commercialUse && capabilities.commercialUse !== "confirmed" &&
    !policy.allowUnconfirmedCommercialUse) return "commercial_use_unconfirmed";
  if (policy.billingMode === "free-only") {
    if (capabilities.freeTier !== "confirmed" || readiness.funding !== "free-confirmed" || readiness.noChargeGuaranteed !== true) return "free_billing_not_verified";
    if (!Number.isFinite(estimate.units) || estimate.units <= 0) return "invalid_free_unit_estimate";
    if (readiness.balanceUnits === null || estimate.units > readiness.balanceUnits) return "insufficient_free_credits";
    return null;
  }
  if (capabilities.freeTier === "unavailable" && !policy.allowPaidGeneration) return "paid_provider_disabled";
  if (readiness.funding === "insufficient") return "insufficient_credits";
  if (readiness.funding === "unknown") return "funding_unverified";
  if (readiness.funding === "paid-authorized" &&
    (!policy.allowPaidGeneration || !policy.paidProviders.has(capabilities.id))) return "paid_provider_not_authorized";
  if (estimate.units < 0 || !Number.isFinite(estimate.units)) return "invalid_cost_estimate";
  if (estimate.units > 0 && readiness.balanceUnits !== null && estimate.units > readiness.balanceUnits) {
    return "insufficient_credits";
  }
  if (estimate.usd === null || !Number.isFinite(estimate.usd) || estimate.usd < 0) return "cost_unknown";
  if (estimate.usd > policy.maxCostUsdPerTask || estimate.usd > policy.remainingDailyBudgetUsd) {
    return "budget_exceeded";
  }
  return null;
}

export class AIProviderRouter<Request = unknown, Result = unknown> {
  private readonly providers: readonly AIProviderAdapter<Request, Result>[];
  private readonly attempts: AIProviderAttemptStore;
  private readonly policy: AIRoutingPolicy;
  private readonly now: () => number;

  constructor(
    providers: readonly AIProviderAdapter<Request, Result>[],
    attempts: AIProviderAttemptStore,
    policy: AIRoutingPolicy,
    now: () => number = Date.now,
  ) {
    this.providers = providers;
    this.attempts = attempts;
    this.policy = policy;
    this.now = now;
  }

  async generate(
    requirements: AITaskRequirements,
    request: Request,
    idempotencyKey: string,
  ): Promise<{ providerId: string; model: string; result: Result }> {
    const attempts: AIAttemptRecord[] = [];
    const freeOnly = this.policy.billingMode === "free-only";
    let retryAfterMs = 900_000;
    const candidates = this.providers.filter((provider) => supports(provider.capabilities, requirements));

    for (const provider of candidates) {
      let readiness: AIProviderReadiness;
      let estimate: { units: number; usd: number | null };
      try {
        readiness = await provider.readiness();
        estimate = await provider.estimate(request);
      } catch (error) {
        // Nenhuma geração foi enviada: falhas de preflight não impedem o fallback.
        const failure = error instanceof AIProviderFailure ? error : null;
        const skipped: AIAttemptRecord = {
          providerId: provider.capabilities.id,
          model: provider.capabilities.model,
          status: "skipped",
          reason: failure?.code ?? "provider_preflight_unavailable",
        };
        attempts.push(skipped);
        await this.attempts.record(skipped);
        await this.attempts.setCooldown(provider.capabilities.id, this.now() + Math.max(failure?.retryAfterMs ?? 0, 60_000));
        continue;
      }
      const ineligible = eligibilityFailure(
        provider.capabilities, readiness, estimate, requirements, this.policy, this.now(),
      );
      if (readiness.cooldownUntil && readiness.cooldownUntil > this.now()) {
        retryAfterMs = Math.min(retryAfterMs, readiness.cooldownUntil - this.now());
      }
      if (ineligible) {
        const skipped = {
          providerId: provider.capabilities.id,
          model: provider.capabilities.model,
          status: "skipped" as const,
          reason: ineligible,
          estimatedCostUsd: freeOnly ? 0 : estimate.usd,
        };
        attempts.push(skipped);
        await this.attempts.record(skipped);
        continue;
      }

      const reserved = freeOnly
        ? await this.attempts.reserveFree?.(provider.capabilities.id, estimate.units) === true
        : await this.attempts.reserve(
        provider.capabilities.id,
        estimate.usd!,
        this.policy.maxCostUsdPerTask,
        this.policy.remainingDailyBudgetUsd,
      );
      if (!reserved) {
        const skipped = {
          providerId: provider.capabilities.id,
          model: provider.capabilities.model,
          status: "skipped" as const,
          reason: freeOnly ? "free_quota_reservation_failed" : "budget_reservation_failed",
          estimatedCostUsd: freeOnly ? 0 : estimate.usd,
        };
        attempts.push(skipped);
        await this.attempts.record(skipped);
        continue;
      }

      const started = {
        providerId: provider.capabilities.id,
        model: provider.capabilities.model,
        status: "started" as const,
        estimatedCostUsd: freeOnly ? 0 : estimate.usd,
      };
      attempts.push(started);
      try {
        await this.attempts.record(started);
      } catch (error) {
        await this.attempts.release(provider.capabilities.id);
        throw error;
      }

      let result: Result;
      try {
        result = await provider.generate(request, idempotencyKey);
      } catch (error) {
        const failure = error instanceof AIProviderFailure
          ? error
          : new AIProviderFailure("provider_error", "uncertain", "unknown");
        if (failure.submission === "unknown" || failure.submission === "accepted" || failure.category === "uncertain") {
          await this.attempts.settle(provider.capabilities.id, freeOnly ? 0 : estimate.usd!);
          const uncertain = { ...started, status: "uncertain" as const, reason: failure.code };
          attempts.push(uncertain);
          await this.attempts.record(uncertain);
          throw new AIRoutingError("provider_submission_uncertain", attempts);
        }

        await this.attempts.release(provider.capabilities.id);
        const failed = { ...started, status: "failed" as const, reason: failure.code };
        attempts.push(failed);
        await this.attempts.record(failed);

        if (failure.category === "auth" || failure.category === "credits" || failure.category === "rate-limit") {
          const until = this.now() + Math.max(failure.retryAfterMs, 60_000);
          retryAfterMs = Math.min(retryAfterMs, until - this.now());
          await this.attempts.setCooldown(provider.capabilities.id, until);
        }
        continue;
      }

      const reportedCost = freeOnly ? 0 : result !== null && typeof result === "object" &&
        "estimatedCostUsd" in result
        ? result.estimatedCostUsd
        : estimate.usd;
      if (typeof reportedCost !== "number" || !Number.isFinite(reportedCost) || reportedCost < 0) {
        const uncertain = { ...started, status: "uncertain" as const, reason: "provider_cost_invalid" };
        attempts.push(uncertain);
        await this.attempts.record(uncertain);
        throw new AIRoutingError("provider_submission_uncertain", attempts);
      }
      try {
        await this.attempts.settle(provider.capabilities.id, reportedCost);
      } catch {
        const uncertain = { ...started, status: "uncertain" as const, reason: "budget_settlement_failed" };
        attempts.push(uncertain);
        await this.attempts.record(uncertain);
        throw new AIRoutingError("provider_submission_uncertain", attempts);
      }
      const succeeded = { ...started, status: "succeeded" as const };
      attempts.push(succeeded);
      await this.attempts.record(succeeded);
      return {
        providerId: provider.capabilities.id,
        model: provider.capabilities.model,
        result,
      };
    }

    throw new AIRoutingError(freeOnly ? "free_resources_unavailable" : candidates.length ? "all_providers_failed" : "no_eligible_provider", attempts, retryAfterMs);
  }
}

export const initialProviderCapabilities: readonly AIProviderCapabilities[] = [
  {
    id: "cloudflare-workers-ai",
    task: "image",
    model: "@cf/black-forest-labs/flux-2-dev",
    inputModes: ["text", "image-reference"],
    maxReferenceImages: 4,
    durationsSeconds: null,
    aspectRatios: ["1:1", "4:3", "3:2", "16:9", "9:16"],
    maxResolution: "1920x1920",
    nativeAudio: false,
    lipSync: false,
    commercialUse: "not-confirmed",
    freeTier: "unknown",
    supportsBalanceQuery: false,
    costUsdPerUnit: 0.000011,
    costUnit: "neuron",
  },
  {
    id: "magic-hour",
    task: "video",
    model: "ltx-2.5",
    inputModes: ["image-reference"],
    maxReferenceImages: 1,
    durationsSeconds: [6],
    aspectRatios: ["9:16", "16:9", "1:1"],
    maxResolution: "480p",
    nativeAudio: true,
    lipSync: false,
    commercialUse: "not-confirmed",
    freeTier: "unknown",
    supportsBalanceQuery: true,
    costUsdPerUnit: null,
    costUnit: "credit",
  },
  {
    id: "replicate",
    task: "video",
    model: "alibaba/happyhorse-1.0",
    inputModes: ["image-reference"],
    maxReferenceImages: 1,
    durationsSeconds: [6],
    aspectRatios: ["9:16"],
    maxResolution: "720p",
    nativeAudio: false,
    lipSync: false,
    commercialUse: "not-confirmed",
    freeTier: "unavailable",
    supportsBalanceQuery: false,
    costUsdPerUnit: 0.14,
    costUnit: "second",
  },
];

import type { AIProviderAdapter } from "./ai-provider-router.ts";

export interface FreeAllowance {
  provider_id: string;
  model: string;
  billing_guard: "unverified" | "free-plan-hard-stop";
  remaining_units: number;
  valid_until: string;
  commercial_use_confirmed: boolean;
  enabled: boolean;
}

export function verifiedFreeAllowance(allowance: FreeAllowance | null, providerId: string, model: string, now = Date.now()): boolean {
  return Boolean(allowance && allowance.provider_id === providerId && allowance.model === model && allowance.enabled &&
    allowance.billing_guard === "free-plan-hard-stop" && allowance.commercial_use_confirmed &&
    Number.isFinite(Number(allowance.remaining_units)) && Number(allowance.remaining_units) > 0 &&
    Number.isFinite(Date.parse(allowance.valid_until)) && Date.parse(allowance.valid_until) > now);
}

export function freeOnlyAdapter<Request, Result>(
  adapter: AIProviderAdapter<Request, Result>,
  allowance: () => Promise<FreeAllowance | null>,
): AIProviderAdapter<Request, Result> {
  // Nenhum saldo de assinatura/pago é convertido automaticamente em crédito gratuito.
  return {
    ...adapter,
    capabilities: { ...adapter.capabilities, freeTier: "confirmed", commercialUse: "confirmed" },
    async readiness() {
      const grant = await allowance();
      const verified = verifiedFreeAllowance(grant, adapter.capabilities.id, adapter.capabilities.model);
      if (!verified) return { authenticated: false, available: false, funding: "unknown", balanceUnits: null, noChargeGuaranteed: false };
      const current = await adapter.readiness();
      return {
        ...current,
        funding: verified ? "free-confirmed" : "unknown",
        noChargeGuaranteed: verified,
        balanceUnits: current.balanceUnits === null ? Number(grant!.remaining_units) : Math.min(Number(grant!.remaining_units), current.balanceUnits),
      };
    },
    async generate(request, key) {
      if (!verifiedFreeAllowance(await allowance(), adapter.capabilities.id, adapter.capabilities.model)) {
        const { AIProviderFailure } = await import("./ai-provider-router.ts");
        throw new AIProviderFailure("free_allowance_expired", "credits", "not-started");
      }
      return adapter.generate(request, key);
    },
  };
}

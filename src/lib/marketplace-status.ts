import type { MarketplaceConnectionStatus } from "@/types/marketplace";

export type ShopeeSummaryState =
  | "sign_in"
  | "checking"
  | "unknown"
  | "not_connected"
  | "credentials_missing"
  | "attention"
  | "connected";

export type ShopeeCredentialAction = "connect" | "checking" | "verify" | "configure";

export function shopeeCredentialAction(hasConnection: boolean, credentialsStored: boolean | null): ShopeeCredentialAction {
  if (credentialsStored === null) return "checking";
  if (credentialsStored) return "verify";
  if (!hasConnection) return "connect";
  return "configure";
}

export function shopeeSummaryState(options: {
  authenticated: boolean;
  loading: boolean;
  error: boolean;
  status: MarketplaceConnectionStatus | null;
}): ShopeeSummaryState {
  if (!options.authenticated) return "sign_in";
  if (options.loading) return "checking";
  if (options.error || !options.status) return "unknown";
  if (options.status.status === "error" && options.status.credentialsStored) return "attention";
  if (options.status.connected) return options.status.credentialsStored ? "connected" : "credentials_missing";
  if (options.status.credentialsStored || options.status.status === "error") return "attention";
  return "not_connected";
}

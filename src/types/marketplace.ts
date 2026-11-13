export interface MarketplaceConnection {
  id: string; platform_id: string; status: "connected" | "error" | "disconnected";
  last_sync_at: string | null; last_error_code: string | null; sync_scope: string;
}
export interface MarketplaceConnectionStatus {
  connected: boolean;
  credentialsStored: boolean;
  status: "not_configured" | "connected" | "error" | "disconnected";
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  syncScope: string | null;
}
export interface MarketplaceProduct {
  id: string; connection_id: string; platform_id: string; title: string; shop_name: string | null;
  image_url: string | null; product_url: string; price_min: number | null; price_max: number | null;
  commission_rate: number | null; commission_estimate: number | null; sales: number | null;
  rating: number | null; discount_percent: number | null; offer_ends_at: string | null; synced_at: string;
}

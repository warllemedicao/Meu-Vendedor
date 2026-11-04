export const catalogPlatforms = ["amazon", "mercadolivre", "tiktok", "aliexpress", "magalu", "shein"] as const;
export type CatalogPlatform = typeof catalogPlatforms[number];
export type ImplementedPlatform = Exclude<CatalogPlatform, "magalu" | "shein">;
export interface CatalogProduct {
  id: string;
  platform: CatalogPlatform | "shopee";
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  price: number | null;
  currency: string | null;
  discountPercent: number | null;
  sales: string | null;
  rank: number | null;
  shop: string | null;
  updatedAt: string;
}
export interface CatalogResult {
  platform: CatalogPlatform;
  products: CatalogProduct[];
  scope: string;
  warnings: string[];
  fetchedAt: string;
}
export interface CatalogSourceStatus {
  platform: CatalogPlatform;
  implemented: boolean;
  configured: boolean;
  message: string;
}
export interface CatalogQuery { keywords: string; categoryId: string; discountsOnly: boolean; }
export type AccountConfig = Record<string, unknown>;
export type PublicPlatform = "shopee" | "amazon" | "tiktok";
export interface PublicCatalogResult extends Omit<CatalogResult, "platform"> { platform: PublicPlatform; }

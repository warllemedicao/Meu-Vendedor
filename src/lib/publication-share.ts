export type PublicationShareResult = "shared" | "cancelled" | "unsupported" | "failed";
type ShareNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

// The OS chooses the receiver. A resolved share promise is not a published post.
export async function sharePublication(target: ShareNavigator, data: ShareData): Promise<PublicationShareResult> {
  try {
    if (!target.share || !target.canShare?.(data)) return "unsupported";
    await target.share(data);
    return "shared";
  } catch (error) {
    return error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed";
  }
}

export function shopeeProductDestination(value?: string): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname === "shopee.com.br" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

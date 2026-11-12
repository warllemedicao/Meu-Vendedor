export type PublicationShareResult = "shared" | "cancelled" | "unsupported" | "failed";
export const publicationShareTargets = [
  { id: "tiktok_video", label: "TikTok", siteUrl: "https://www.tiktok.com/" },
  { id: "kwai", label: "Kwai", siteUrl: "https://www.kwai.com/" },
  { id: "facebook_stories", label: "Facebook Stories", siteUrl: "https://www.facebook.com/" },
  { id: "pinterest", label: "Pinterest", siteUrl: "https://www.pinterest.com/" },
  { id: "other_app", label: "Outro aplicativo compatível", siteUrl: null },
] as const;
export type PublicationShareTarget = typeof publicationShareTargets[number]["id"];

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

export async function fetchPublicationFile(
  url: string,
  filename: string,
  type: string,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error("Não foi possível carregar a mídia privada.");
  return new File([await response.blob()], filename, { type });
}

export function shopeeProductDestination(value?: string): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname === "shopee.com.br" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

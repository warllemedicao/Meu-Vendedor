export type GoogleAuthAvailability = "enabled" | "disabled" | "unavailable";

export function canAttemptGoogleSignIn(availability: GoogleAuthAvailability | "loading"): boolean {
  return availability === "enabled" || availability === "unavailable";
}

export async function googleAuthAvailability(
  supabaseUrl: string,
  publishableKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GoogleAuthAvailability> {
  try {
    const response = await fetcher(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: publishableKey }, redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "unavailable";
    const body = await response.json();
    return body?.external?.google === true ? "enabled"
      : body?.external?.google === false ? "disabled" : "unavailable";
  } catch { return "unavailable"; }
}

export function googleSignInOptions(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("invalid_auth_origin");
  }
  return {
    provider: "google" as const,
    options: { redirectTo: `${url.origin}/entrar`, scopes: "openid email profile", queryParams: { prompt: "select_account" } },
  };
}

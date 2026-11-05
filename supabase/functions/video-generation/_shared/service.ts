const allowedOrigins = new Set([
  "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev",
  "http://localhost:3000",
]);

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

export interface VideoGenerationDependencies {
  authenticate(token: string): Promise<string | null>;
  googleApiKey(): string | undefined;
  googleEnabled(): boolean;
}

function corsHeaders(request: Request): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin ?? "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > 4096) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 4096) return null;
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function response(request: Request, body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...cors } });
}

export function createVideoGenerationHandler(dependencies: VideoGenerationDependencies) {
  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(request);
    if (!cors) return new Response(null, { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return response(request, { error: { code: "method_not_allowed", message: "Método não permitido." } }, 405, cors);

    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const userId = token ? await dependencies.authenticate(token) : null;
    if (!userId) return response(request, { error: { code: "unauthorized", message: "Entre na sua conta para usar o provedor de vídeo." } }, 401, cors);

    const body = await readBody(request);
    if (!body || typeof body.action !== "string") return response(request, { error: { code: "invalid_request", message: "Solicitação inválida." } }, 400, cors);

    const configured = Boolean(dependencies.googleApiKey());
    const explicitlyEnabled = dependencies.googleEnabled();
    if (body.action === "capabilities") {
      return response(request, {
        provider: "google-gemini",
        model: "gemini-omni-1.1-flash",
        available: false,
        configured,
        enabled: explicitlyEnabled,
        supports: { referenceImages: true, nativeAudio: true, lipSync: null, costEstimate: false },
        status: configured && explicitlyEnabled ? "implementation_pending" : "awaiting_credentials",
      }, 200, cors);
    }

    if (!["generate", "status", "result"].includes(body.action)) {
      return response(request, { error: { code: "invalid_action", message: "Ação inválida." } }, 400, cors);
    }
    if (!configured || !explicitlyEnabled) {
      return response(request, { error: { code: "provider_not_configured", message: "A integração oficial do Google ainda não foi habilitada." } }, 503, cors);
    }
    return response(request, { error: { code: "provider_implementation_pending", message: "A credencial foi detectada, mas chamadas reais continuam bloqueadas até autorização e validação final." } }, 501, cors);
  };
}

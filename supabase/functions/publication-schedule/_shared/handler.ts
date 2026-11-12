export type Destination = "shopee_video" | "pinterest" | "other_app";
export type ScheduleStatus = "draft" | "scheduled";
export type PublicationAction = "share_handoff" | "manual_published" | "manual_failed";

export interface PublicationInput {
  idempotencyKey: string;
  productId: string | null;
  productTitle: string;
  sourceMarketplace: string;
  affiliateUrl: string;
  publicationTitle: string;
  caption: string;
  hashtags: string;
  destination: Destination;
  mediaPath: string;
  mediaType: string;
  mediaFilename: string;
  status: ScheduleStatus;
  scheduledAt: string | null;
  timezone: string;
}

export interface PublicationDependencies {
  authenticate(token: string): Promise<string | null>;
  list(userId: string): Promise<unknown[]>;
  create(userId: string, input: PublicationInput, destinations: Destination[]): Promise<unknown[]>;
  update(userId: string, id: string, input: PublicationInput): Promise<unknown>;
  cancel(userId: string, id: string): Promise<unknown>;
  action(userId: string, id: string, action: PublicationAction, requestKey: string): Promise<unknown>;
}

export class PublicationServiceError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const destinations = new Set<Destination>(["shopee_video", "pinterest", "other_app"]);
const actions = new Set<PublicationAction>(["share_handoff", "manual_published", "manual_failed"]);
const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm",
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 20_000) throw new PublicationServiceError("Solicitação muito grande.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 20_000) throw new PublicationServiceError("Solicitação muito grande.", 413);
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new PublicationServiceError("Solicitação inválida.", 400); }
}

function string(value: unknown, label: string, max: number, min = 0): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new PublicationServiceError(`Revise o campo ${label}.`, 400);
  }
  return value.trim();
}

function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}

function scheduledAt(value: unknown, status: ScheduleStatus, now: number): string | null {
  if (status === "draft") {
    if (value !== null) throw new PublicationServiceError("Rascunhos não podem ter horário programado.", 400);
    return null;
  }
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now) {
    throw new PublicationServiceError("A data e o horário precisam estar no futuro.", 400);
  }
  return new Date(value).toISOString();
}

function publicationInput(body: Record<string, unknown>, userId: string, now: number): PublicationInput {
  const status = body.status;
  if (status !== "draft" && status !== "scheduled") throw new PublicationServiceError("Estado da publicação inválido.", 400);
  const productId = body.productId;
  if (productId !== null && productId !== undefined && (typeof productId !== "string" || productId.length > 200)) {
    throw new PublicationServiceError("Produto inválido.", 400);
  }
  const productTitle = string(body.productTitle, "produto", 500, 1);
  const sourceMarketplace = string(body.sourceMarketplace, "marketplace", 80, 1);
  const affiliateUrl = string(body.affiliateUrl, "link de afiliado", 2048, 1);
  let url: URL;
  try { url = new URL(affiliateUrl); } catch { throw new PublicationServiceError("Informe um link de afiliado HTTPS válido.", 400); }
  if (url.protocol !== "https:" || url.username || url.password) throw new PublicationServiceError("Informe um link de afiliado HTTPS válido.", 400);

  const publicationTitle = string(body.publicationTitle, "título", 200, 1);
  const caption = string(body.caption, "descrição", 5000);
  const hashtags = string(body.hashtags, "hashtags", 1000);
  if (typeof body.destination !== "string" || !destinations.has(body.destination as Destination)) {
    throw new PublicationServiceError("Destino de publicação inválido.", 400);
  }
  if (body.destination === "shopee_video" && sourceMarketplace !== "Shopee") {
    throw new PublicationServiceError("Shopee Vídeo só pode ser selecionado para produtos da Shopee.", 400);
  }
  const mediaType = string(body.mediaType, "tipo de mídia", 30, 1);
  const extension = mimeExtensions[mediaType];
  if (!extension) throw new PublicationServiceError("O formato da mídia não é compatível.", 400);
  const mediaPath = string(body.mediaPath, "arquivo de mídia", 300, 1);
  if (!new RegExp(`^${userId}/publications/[0-9a-f-]{36}\\.${extension}$`, "i").test(mediaPath)) {
    throw new PublicationServiceError("A mídia não pertence a esta conta ou não foi enviada para publicações.", 400);
  }
  const mediaFilename = string(body.mediaFilename, "nome do arquivo", 255, 1);
  const timezone = string(body.timezone, "fuso horário", 100, 1);
  if (!validTimeZone(timezone)) throw new PublicationServiceError("Selecione um fuso horário válido.", 400);
  const date = scheduledAt(body.scheduledAt, status, now);
  const idempotencyKey = string(body.idempotencyKey, "chave de idempotência", 36, 36);
  if (!uuid.test(idempotencyKey)) throw new PublicationServiceError("Chave de idempotência inválida.", 400);
  return {
    idempotencyKey,
    productId: typeof productId === "string" ? productId : null,
    productTitle, sourceMarketplace, affiliateUrl, publicationTitle, caption, hashtags,
    destination: body.destination as Destination, mediaPath, mediaType, mediaFilename,
    status, scheduledAt: date, timezone,
  };
}

export function createPublicationScheduleHandler(deps: PublicationDependencies, allowedOrigins: string[]) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const cors = {
      "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
    if (origin && !allowedOrigins.includes(origin)) return reply({ error: { message: "Origem não permitida." } }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: { message: "Use POST." } }, 405);

    try {
      const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
      const userId = token ? await deps.authenticate(token) : null;
      if (!userId) throw new PublicationServiceError("Entre na sua conta para acessar os agendamentos.", 401);
      const body = await readBody(request);
      const action = body.action;
      if (action === "list") return reply({ items: await deps.list(userId) });
      if (action === "create") {
        const input = publicationInput(body, userId, Date.now());
        const selected = body.destinations;
        if (!Array.isArray(selected) || selected.length < 1 || selected.length > destinations.size
          || selected.some(value => typeof value !== "string" || !destinations.has(value as Destination))
          || new Set(selected).size !== selected.length) {
          throw new PublicationServiceError("Selecione pelo menos um destino válido.", 400);
        }
        if (selected.includes("shopee_video") && input.sourceMarketplace !== "Shopee") {
          throw new PublicationServiceError("Shopee Vídeo só pode ser selecionado para produtos da Shopee.", 400);
        }
        return reply({ items: await deps.create(userId, input, selected as Destination[]) }, 201);
      }
      if (action === "update") {
        const id = string(body.id, "identificador", 36, 36);
        if (!uuid.test(id)) throw new PublicationServiceError("Identificador de publicação inválido.", 400);
        const input = publicationInput(body, userId, Date.now());
        return reply({ item: await deps.update(userId, id, input) });
      }
      if (action === "cancel") {
        const id = string(body.id, "identificador", 36, 36);
        if (!uuid.test(id)) throw new PublicationServiceError("Identificador de publicação inválido.", 400);
        return reply({ item: await deps.cancel(userId, id) });
      }
      if (action === "interaction") {
        const id = string(body.id, "identificador", 36, 36);
        const requestKey = string(body.requestKey, "chave de tentativa", 36, 36);
        if (!uuid.test(id) || !uuid.test(requestKey) || typeof body.interaction !== "string" || !actions.has(body.interaction as PublicationAction)) {
          throw new PublicationServiceError("Ação manual inválida.", 400);
        }
        return reply({ item: await deps.action(userId, id, body.interaction as PublicationAction, requestKey) });
      }
      throw new PublicationServiceError("Ação de agendamento inválida.", 400);
    } catch (error) {
      if (error instanceof PublicationServiceError) return reply({ error: { message: error.message } }, error.status);
      console.error("publication_schedule_request_failed", error instanceof Error ? error.message : "unknown");
      return reply({ error: { message: "Não foi possível concluir a operação de agendamento." } }, 503);
    }
  };
}

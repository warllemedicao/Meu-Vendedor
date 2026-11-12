import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  createPublicationScheduleHandler,
  PublicationServiceError,
  type Destination,
  type PublicationAction,
  type PublicationDependencies,
  type PublicationInput,
} from "./_shared/handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const origins = [
  "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev",
  "http://localhost:3000",
];

const dependencies: PublicationDependencies = {
  authenticate: async token => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  list: async userId => {
    const { data, error } = await admin.from("mv_publications").select("*").eq("user_id", userId)
      .order("scheduled_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    if (!data?.length) return [];
    const { data: attempts, error: attemptError } = await admin.from("mv_publication_attempts")
      .select("id,publication_id,attempt_number,action,result,details,created_at")
      .eq("user_id", userId).in("publication_id", data.map(item => item.id))
      .order("attempt_number", { ascending: true });
    if (attemptError) throw attemptError;
    return data.map(item => ({
      ...item,
      attempts: (attempts ?? []).filter(attempt => attempt.publication_id === item.id)
        .map(attempt => ({
          id: attempt.id,
          attempt_number: attempt.attempt_number,
          action: attempt.action,
          result: attempt.result,
          details: attempt.details,
          created_at: attempt.created_at,
        })),
    }));
  },
  create: async (userId, input, selected) => {
    const existing = await findIdempotent(userId, input.idempotencyKey);
    if (existing) return existingForDestinations(existing, selected, userId, input);
    const records = selected.map(destination => databaseRecord(userId, input, destination));
    const { data, error } = await admin.from("mv_publications").insert(records).select("*");
    if (!error) return data ?? [];
    const retry = await findIdempotent(userId, input.idempotencyKey);
    if (retry) return existingForDestinations(retry, selected, userId, input);
    throw new PublicationServiceError("Não foi possível salvar as publicações. Verifique a mídia e tente novamente.", 503);
  },
  update: async (userId, id, input) => {
    const { data: current, error: lookupError } = await admin.from("mv_publications").select("destination")
      .eq("id", id).eq("user_id", userId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!current) throw new PublicationServiceError("Publicação não encontrada.", 404);
    if (current.destination !== input.destination) {
      throw new PublicationServiceError("Para mudar o destino, cancele esta publicação e crie outra.", 409);
    }
    const changes = databaseRecord(userId, input, input.destination);
    delete changes.idempotency_key;
    const { data, error } = await admin.from("mv_publications").update({
      ...changes,
      updated_at: new Date().toISOString(),
      completed_at: null,
    }).eq("id", id).eq("user_id", userId)
      .in("status", ["draft", "scheduled", "awaiting_manual_action", "failed"])
      .select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new PublicationServiceError("Publicação não encontrada ou não pode mais ser editada.", 409);
    return data;
  },
  cancel: async (userId, id) => {
    const { data, error } = await admin.from("mv_publications").update({
      status: "cancelled", updated_at: new Date().toISOString(),
    }).eq("id", id).eq("user_id", userId)
      .in("status", ["draft", "scheduled", "awaiting_manual_action", "failed"])
      .select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new PublicationServiceError("Publicação não encontrada ou não pode ser cancelada.", 409);
    return data;
  },
  action: async (userId, id, action, requestKey) => {
    const { data, error } = await admin.rpc("mv_apply_publication_action", {
      p_user_id: userId, p_publication_id: id, p_action: action as PublicationAction, p_request_key: requestKey,
    });
    if (error) {
      if (error.message.includes("publication_not_found")) throw new PublicationServiceError("Publicação não encontrada.", 404);
      if (error.message.includes("publication_action_not_available")) throw new PublicationServiceError("Esta publicação não aguarda ação manual.", 409);
      throw error;
    }
    return data;
  },
};

function databaseRecord(userId: string, input: PublicationInput, destination: Destination): Record<string, string | null> {
  return {
    user_id: userId,
    idempotency_key: input.idempotencyKey,
    product_id: input.productId,
    product_title: input.productTitle,
    source_marketplace: input.sourceMarketplace,
    affiliate_url: input.affiliateUrl,
    publication_title: input.publicationTitle,
    caption: input.caption,
    hashtags: input.hashtags,
    destination,
    media_path: input.mediaPath,
    media_type: input.mediaType,
    media_filename: input.mediaFilename,
    status: input.status,
    scheduled_at: input.scheduledAt,
    timezone: input.timezone,
  };
}

async function findIdempotent(userId: string, idempotencyKey: string) {
  const { data, error } = await admin.from("mv_publications").select("*")
    .eq("user_id", userId).eq("idempotency_key", idempotencyKey);
  if (error) throw error;
  return data ?? null;
}

function existingForDestinations(
  existing: NonNullable<Awaited<ReturnType<typeof findIdempotent>>>,
  selected: Destination[],
  userId: string,
  input: PublicationInput,
) {
  const found = new Set(existing.map(record => record.destination));
  const expected = {
    user_id: userId,
    product_id: input.productId,
    product_title: input.productTitle,
    source_marketplace: input.sourceMarketplace,
    affiliate_url: input.affiliateUrl,
    publication_title: input.publicationTitle,
    caption: input.caption,
    hashtags: input.hashtags,
    media_path: input.mediaPath,
    media_type: input.mediaType,
    media_filename: input.mediaFilename,
    status: input.status,
    scheduled_at: input.scheduledAt,
    timezone: input.timezone,
  };
  if (found.size !== selected.length || selected.some(destination => !found.has(destination))
    || existing.some(record => Object.entries(expected).some(([key, value]) => record[key] !== value))) {
    throw new PublicationServiceError("A chave de repetição já foi usada para outro conjunto de destinos.", 409);
  }
  return existing;
}

Deno.serve(createPublicationScheduleHandler(dependencies, origins));

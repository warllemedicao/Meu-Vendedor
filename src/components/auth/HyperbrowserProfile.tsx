"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type ProfileResult = { configured?: boolean; profileReady?: boolean; profileId?: string; error?: string };

export function HyperbrowserProfile() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  async function run(action: "status" | "create-profile") {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase indisponível.");
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError || !auth.session) throw new Error("Entre na sua conta do Meu Vendedor.");
      const { data, error } = await client.functions.invoke<ProfileResult>("hyperbrowser-profile", { body: { action } });
      if (error || !data || data.error) throw new Error(data?.error === "hyperbrowser_key_missing" ? "Chave Hyperbrowser não encontrada no servidor." : "Não foi possível consultar o Hyperbrowser. Confira a função e seus registros no Supabase.");
      setReady(Boolean(data.profileReady));
      setStatus(data.profileReady ? "Perfil remoto registrado. A persistência do login Google ainda precisa ser testada." : data.configured ? "Chave encontrada. O perfil ainda não foi criado." : "Chave Hyperbrowser não encontrada.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao consultar a conexão.");
    } finally {
      setBusy(false);
    }
  }
  return <article className="rounded-xl border border-border bg-surface p-4 space-y-3 sm:col-span-2">
    <h3 className="font-semibold">Hyperbrowser · Google Flow</h3>
    <p className="text-sm text-muted">Verifique a chave protegida no Supabase e crie um perfil remoto individual. Criar o perfil não inicia o Chrome, não faz login e não consome créditos de vídeo.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void run("status")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Verificar Hyperbrowser</button>
      <button type="button" disabled={busy || ready} onClick={() => void run("create-profile")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Aguarde…" : "Criar perfil persistente"}</button>
    </div>
    {status && <p role="status" className="text-sm">{status}</p>}
    <p className="text-xs text-muted">A conexão anterior do Google Flow continua separada. O navegador interativo Hyperbrowser e a geração automática ainda não estão habilitados.</p>
  </article>;
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

export function AccountButton() {
  const { user, loading } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError("");
    try {
      const result = await getSupabase()?.auth.signOut({ scope: "local" });
      if (result?.error) setError("Não foi possível sair. Tente novamente.");
    } catch { setError("Falha de conexão ao sair."); }
    finally { setBusy(false); }
  }
  if (loading) return <span className="text-xs text-muted" role="status">Carregando conta…</span>;
  return <div className="flex items-center gap-2 text-sm">
    {user ? <><Link href="/entrar" className="rounded-lg border border-border px-3 py-2">Minha conta</Link><button type="button" disabled={busy} onClick={logout} className="rounded-lg border border-border px-3 py-2 disabled:opacity-50">{busy ? "Saindo…" : "Sair"}</button></> : <Link href="/entrar" className="rounded-lg bg-primary px-3 py-2 font-medium text-background">Entrar</Link>}
    {error && <span role="alert" className="max-w-40 text-xs text-danger">{error}</span>}
  </div>;
}

"use client";
import { useEffect, useState } from "react";
import { PublicProductCatalog } from "./PublicProductCatalog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMarketplace } from "./MarketplaceProvider";
import { ProductCatalog } from "./ProductCatalog";
export type CommerceView = "offers" | "dashboard" | "products" | "trends" | "top10";
const views: [CommerceView, string][] = [["offers", "Início · Ofertas"], ["dashboard", "Dashboard"], ["products", "Meus produtos"], ["trends", "Radar de Tendências"], ["top10", "Top 10"]];
export function CommerceHub({ initialView = "offers" }: { initialView?: CommerceView }) {
  const { user, loading } = useAuth(); const marketplace = useMarketplace();
  const connected = Boolean(user && marketplace.connections.some(connection => connection.platform_id === "shopee"));
  const [view, setView] = useState<CommerceView>(initialView);
  useEffect(() => { const update = () => { const value = new URLSearchParams(window.location.search).get("view"); setView(views.some(([id]) => id === value) ? value as CommerceView : initialView); }; const frame = requestAnimationFrame(update); window.addEventListener("popstate", update); return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", update); }; }, [initialView]);
  function select(next: CommerceView) { setView(next); const url = new URL(window.location.href); url.searchParams.set("view", next); window.history.pushState(null, "", url); }
  return <div className="space-y-5"><div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3" aria-label="Visualização de ofertas e produtos">{views.map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => select(id)} className={`rounded-lg px-4 py-2 text-sm ${view === id ? "bg-primary text-white" : "text-muted hover:bg-background"}`}>{label}</button>)}</div>
    {loading || (user && marketplace.loading) ? <p role="status">Carregando suas ofertas…</p> : connected || view === "products" ? <ProductCatalog key={view} view={view} /> : <PublicProductCatalog key={view} view={view} />}
  </div>;
}

"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isStandalonePublicRoute } from "@/lib/public-routes";
import { Brand } from "./Brand";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const fechar = () => setMenuAberto(false);

  if (isStandalonePublicRoute(pathname)) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Menu fixo (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Brand />
        </div>
        <Sidebar />
      </aside>

      {/* Menu em gaveta (celular) */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" onClick={fechar} className="absolute inset-0 bg-black/50" />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Brand />
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar menu"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <Sidebar onNavigate={fechar} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <Header onOpenMenu={() => setMenuAberto(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

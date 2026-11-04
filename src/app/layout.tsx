import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Meu Vendedor — Viral Commerce AI", template: "%s · Meu Vendedor" },
  description: "Plataforma web de marketing de afiliados com inteligência artificial. Ambiente demonstrativo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Aplica o tema salvo (ou o do sistema) antes da primeira pintura, evitando o "flash" de tema errado. */
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");var e=t?t==="escuro":window.matchMedia("(prefers-color-scheme: dark)").matches;if(e)document.documentElement.classList.add("dark")}catch(_){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

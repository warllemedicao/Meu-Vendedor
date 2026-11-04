"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Alterna a classe "dark" no <html> e guarda a escolha no navegador.
 * O ícone é escolhido por CSS (dark:), então não há estado React nem divergência na hidratação.
 */
export function ThemeToggle() {
  function alternar() {
    const escuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("tema", escuro ? "escuro" : "claro");
    } catch {
      /* armazenamento indisponível: o tema vale apenas para esta visita */
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar entre tema claro e escuro"
      title="Alternar tema"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground hover:bg-surface-muted"
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}

import { Menu, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border lg:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </button>
      <span className="text-sm font-semibold lg:hidden">Meu Vendedor</span>
      <div className="hidden lg:block">
        <Badge tone="demo">Ambiente demonstrativo</Badge>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="lg:hidden">
          <Badge tone="demo">Demonstrativo</Badge>
        </span>
        <ThemeToggle />
        {/* Área reservada: autenticação e perfil ainda não existem. */}
        <div
          title="Perfil do usuário (em breve)"
          aria-label="Área reservada para o perfil do usuário"
          className="flex size-9 items-center justify-center rounded-full border border-dashed border-border text-muted"
        >
          <UserRound className="size-4" aria-hidden />
        </div>
      </div>
    </header>
  );
}

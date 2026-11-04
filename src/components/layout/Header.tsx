import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AccountButton } from "@/components/auth/AccountButton";
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
        <Badge tone="demo">Meu Vendedor</Badge>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:inline lg:hidden">
          <Badge tone="demo">Afiliados</Badge>
        </span>
        <ThemeToggle />
        <AccountButton />
      </div>
    </header>
  );
}

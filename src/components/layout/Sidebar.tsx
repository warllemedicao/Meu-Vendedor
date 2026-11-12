"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketplaceDirectory } from "@/lib/marketplace-directory";
import { mainNavItems } from "@/lib/navigation";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-3">
      <ul className="space-y-0.5">
        {mainNavItems.map(({ href, label, icon: Icon }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`) || (href === "/produtos" && ["/", "/lojas", "/dashboard", "/tendencias", "/top-10", ...marketplaceDirectory.map(item => item.href)].includes(pathname));
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  ativo ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

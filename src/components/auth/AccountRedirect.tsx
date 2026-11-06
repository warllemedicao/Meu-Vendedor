"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export function AccountRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/entrar#lojas"); }, [router]);
  return <p role="status" className="text-sm text-muted">As conexões estão em <Link href="/entrar#lojas" className="text-primary underline">Conta e conexões</Link>.</p>;
}

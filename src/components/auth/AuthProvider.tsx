"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase/client";

interface AuthState { user: User | null; loading: boolean; configured: boolean; }
const AuthContext = createContext<AuthState>({ user: null, loading: true, configured: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: hasSupabaseConfig, configured: hasSupabaseConfig });
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      if (active) setState({ user: session?.user ?? null, loading: false, configured: true });
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !eventReceived) setState({ user: error ? null : data.session?.user ?? null, loading: false, configured: true });
    }).catch(() => { if (active && !eventReceived) setState({ user: null, loading: false, configured: true }); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }

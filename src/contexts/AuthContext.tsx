import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoleCode, UserProfile } from "../types/domain";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  mode: "demo" | "supabase";
  authError: string;
  loginDemo: (role: RoleCode) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const requestedMode = (import.meta.env.VITE_DATA_MODE ?? "demo") as "demo" | "supabase";
const mode: "demo" | "supabase" = requestedMode === "supabase" ? "supabase" : "demo";

const demoNames: Record<RoleCode, string> = {
  atendimento: "Atendimento Prime Tech",
  tecnico: "Técnico Prime Tech",
  gestor: "Gestor Prime Tech",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (mode !== "demo") return null;
    const saved = localStorage.getItem("prime-tech-demo-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(mode === "supabase");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (mode !== "supabase" || !supabase) return;
    const client = supabase;

    let active = true;
    const hydrate = async () => {
      try {
      const { data } = await client.auth.getSession();
      const authUser = data.session?.user;
      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data: profile, error } = await client
        .from("profiles")
        .select("id, full_name, role_code, active, email, job_title, phone")
        .eq("id", authUser.id)
        .single();
      if (error) throw error;
      if (!profile?.active) throw new Error("Seu acesso está pendente ou inativo. Procure o Gestor da Prime Tech.");
      const { data: grants, error: grantsError } = await client.from("role_permissions").select("permission_code").eq("role_code", profile.role_code);
      if (grantsError) throw grantsError;
      if (active) {
        setUser({ ...profile, permissions: (grants ?? []).map((grant) => grant.permission_code) } as UserProfile);
        setAuthError("");
        setLoading(false);
      }
      } catch (error) {
        if (active) {
          setUser(null);
          setLoading(false);
          setAuthError(error instanceof Error ? error.message : "Não foi possível verificar seu acesso. Tente novamente.");
        }
      }
    };

    hydrate();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      setTimeout(() => { if (active) void hydrate(); }, 0);
    });
    const recheck = () => { void hydrate(); };
    window.addEventListener("focus", recheck);
    const interval = window.setInterval(recheck, 30000);
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", recheck);
      window.clearInterval(interval);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    mode,
    authError,
    loginDemo(role) {
      const next = { id: `demo-${role}`, full_name: demoNames[role], role_code: role } satisfies UserProfile;
      localStorage.setItem("prime-tech-demo-user", JSON.stringify(next));
      setUser(next);
    },
    async loginWithPassword(email, password) {
      if (!supabase) throw new Error("Supabase não configurado.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async logout() {
      if (mode === "supabase" && supabase) await supabase.auth.signOut();
      localStorage.removeItem("prime-tech-demo-user");
      setUser(null);
    },
  }), [user, loading, authError]);

  if (mode === "supabase" && !isSupabaseConfigured) {
    return <main className="pt-auth-page"><div className="pt-auth-card" role="alert"><h1>Configuração pendente</h1><p>A conexão com o Supabase ainda não foi configurada neste ambiente.</p></div></main>;
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoleCode, UserProfile } from "../types/domain";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  mode: "demo" | "supabase";
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

  useEffect(() => {
    if (mode !== "supabase" || !supabase) return;
    const client = supabase;

    let active = true;
    const hydrate = async () => {
      const { data } = await client.auth.getSession();
      const authUser = data.session?.user;
      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("id, full_name, role_code")
        .eq("id", authUser.id)
        .single();
      if (active) {
        setUser((profile as UserProfile | null) ?? null);
        setLoading(false);
      }
    };

    hydrate();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      setTimeout(() => { if (active) void hydrate(); }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    mode,
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
  }), [user, loading]);

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

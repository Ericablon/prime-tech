import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { RoleCode, UserProfile } from '../types/domain';

interface AuthValue {
  user: UserProfile | null;
  loading: boolean;
  mode: 'demo' | 'supabase';
  loginDemo: (role: RoleCode) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

const requested = (import.meta.env.VITE_DATA_MODE ?? 'demo') as
  | 'demo'
  | 'supabase';

const mode: 'demo' | 'supabase' =
  requested === 'supabase' && isSupabaseConfigured ? 'supabase' : 'demo';

const names: Record<RoleCode, string> = {
  admin: 'Administrador Cronos',
  gestor: 'Gestor Prime Tech',
  atendimento: 'Atendimento Prime Tech',
  comercial: 'Comercial Prime Tech',
  tecnico: 'Técnico Prime Tech',
  estoque: 'Estoque Prime Tech',
  financeiro: 'Financeiro Prime Tech',
  fiscal: 'Fiscal Prime Tech',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (mode !== 'demo') return null;

    const raw = localStorage.getItem('cronos-user');

    return raw ? (JSON.parse(raw) as UserProfile) : null;
  });

  const [loading, setLoading] = useState(mode === 'supabase');

  useEffect(() => {
    if (mode !== 'supabase' || !supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let alive = true;

    const hydrate = async () => {
      try {
        const { data, error: sessionError } =
          await client.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const authUser = data.session?.user;

        if (!authUser) {
          if (alive) {
            setUser(null);
            setLoading(false);
          }

          return;
        }

        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (alive) {
          setUser(profile as UserProfile);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);

        if (alive) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    void hydrate();

    const { data: listener } = client.auth.onAuthStateChange(() => {
      void hydrate();
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      mode,

      loginDemo(role) {
        const next: UserProfile = {
          id: `demo-${role}`,
          full_name: names[role],
          role_code: role,
          active: true,
        };

        localStorage.setItem('cronos-user', JSON.stringify(next));
        setUser(next);
      },

      async loginWithPassword(email, password) {
        const client = supabase;

        if (!client) {
          throw new Error('Supabase não configurado');
        }

        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }
      },

      async logout() {
        const client = supabase;

        if (mode === 'supabase' && client) {
          await client.auth.signOut();
        }

        localStorage.removeItem('cronos-user');
        setUser(null);
      },
    }),
    [user, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth fora do provider');
  }

  return context;
}

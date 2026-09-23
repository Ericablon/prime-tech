import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  Permission,
  RoleCode,
  UserProfile,
} from '../types/domain';

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

function clearSessionDrafts() {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
      .filter((key): key is string => Boolean(key) && key!.startsWith('cronos:draft:'));
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // A sessão pode bloquear storage; o logout continua normalmente.
  }
}

async function loadPermissions(
  client: NonNullable<typeof supabase>,
  companyId: string,
  roleCode: RoleCode,
  accessProfileId?: string | null,
) {
  if (accessProfileId) {
    const custom = await client
      .from('access_profile_permissions')
      .select('permission_code')
      .eq('access_profile_id', accessProfileId);

    if (!custom.error) {
      return (custom.data ?? []).map((row) => String(row.permission_code) as Permission);
    }
  }

  try {
    const override = await client
      .from('company_role_overrides')
      .select('role_code')
      .eq('company_id', companyId)
      .eq('role_code', roleCode)
      .maybeSingle();

    if (!override.error && override.data) {
      const companyPermissions = await client
        .from('company_role_permissions')
        .select('permission_code')
        .eq('company_id', companyId)
        .eq('role_code', roleCode);

      if (!companyPermissions.error) {
        return (companyPermissions.data ?? []).map(
          (row) => String(row.permission_code) as Permission,
        );
      }
    }
  } catch {
    // Compatibilidade antes da migration 0014.
  }

  const basePermissions = await client
    .from('role_permissions')
    .select('permission_code')
    .eq('role_code', roleCode);

  if (basePermissions.error) throw basePermissions.error;

  return (basePermissions.data ?? []).map(
    (row) => String(row.permission_code) as Permission,
  );
}

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
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;

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
        if (profileError) throw profileError;

        let resolved = profile as UserProfile;

        try {
          let access: {
            company_id?: string | null;
            branch_id?: string | null;
            role_code?: string | null;
            access_profile_id?: string | null;
          } | null = null;

          const modernAccess = await client
            .from('user_company_access')
            .select('company_id, branch_id, role_code, access_profile_id')
            .eq('user_id', authUser.id)
            .eq('active', true)
            .order('company_id')
            .limit(1)
            .maybeSingle();

          if (!modernAccess.error) {
            access = modernAccess.data;
          } else {
            const legacyAccess = await client
              .from('user_company_access')
              .select('company_id, branch_id, role_code')
              .eq('user_id', authUser.id)
              .eq('active', true)
              .order('company_id')
              .limit(1)
              .maybeSingle();
            if (legacyAccess.error) throw legacyAccess.error;
            access = legacyAccess.data;
          }

          if (access?.company_id && access?.role_code) {
            const roleCode = access.role_code as RoleCode;
            const companyId = String(access.company_id);

            const [permissions, companyResult] = await Promise.all([
              loadPermissions(
                client,
                companyId,
                roleCode,
                access.access_profile_id ? String(access.access_profile_id) : null,
              ),
              client
                .from('companies')
                .select('organization_id')
                .eq('id', companyId)
                .maybeSingle(),
            ]);

            resolved = {
              ...resolved,
              role_code: roleCode,
              company_id: companyId,
              branch_id: access.branch_id ? String(access.branch_id) : undefined,
              organization_id: companyResult.data?.organization_id
                ? String(companyResult.data.organization_id)
                : undefined,
              permissions,
            };
          }
        } catch (tenantError) {
          console.warn(
            'Sessão carregada em modo de compatibilidade sem contexto tenant:',
            tenantError,
          );
        }

        if (alive) {
          setUser(resolved);
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
        if (!client) throw new Error('Supabase não configurado');
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },

      async logout() {
        const client = supabase;
        if (mode === 'supabase' && client) await client.auth.signOut();
        clearSessionDrafts();
        localStorage.removeItem('cronos-user');
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth fora do provider');
  return context;
}

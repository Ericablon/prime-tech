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

export interface UserAccessOption {
  key: string;
  company_id: string;
  company_name: string;
  organization_id?: string;
  branch_id?: string;
  branch_name?: string;
  role_code: RoleCode;
  access_profile_id?: string | null;
}

interface AuthValue {
  user: UserProfile | null;
  loading: boolean;
  mode: 'demo' | 'supabase';
  accesses: UserAccessOption[];
  activeAccessKey: string | null;
  switchAccess: (accessKey: string) => Promise<void>;
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
    // Storage pode estar indisponível; a sessão continua funcionando.
  }
}

function accessStorageKey(userId: string) {
  return `cronos-active-access:${userId}`;
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

async function loadAccessOptions(
  client: NonNullable<typeof supabase>,
  userId: string,
): Promise<UserAccessOption[]> {
  type AccessRow = {
    company_id: string;
    branch_id?: string | null;
    role_code: string;
    access_profile_id?: string | null;
  };

  let rows: AccessRow[] = [];
  const modern = await client
    .from('user_company_access')
    .select('company_id,branch_id,role_code,access_profile_id')
    .eq('user_id', userId)
    .eq('active', true)
    .order('company_id');

  if (!modern.error) {
    rows = (modern.data ?? []) as AccessRow[];
  } else {
    const legacy = await client
      .from('user_company_access')
      .select('company_id,branch_id,role_code')
      .eq('user_id', userId)
      .eq('active', true)
      .order('company_id');
    if (legacy.error) throw legacy.error;
    rows = (legacy.data ?? []) as AccessRow[];
  }

  if (!rows.length) return [];

  const companyIds = [...new Set(rows.map((row) => String(row.company_id)))];
  const branchIds = [...new Set(rows.map((row) => row.branch_id ? String(row.branch_id) : '').filter(Boolean))];

  const [companyResult, branchResult] = await Promise.all([
    client.from('companies').select('id,trade_name,legal_name,organization_id').in('id', companyIds),
    branchIds.length
      ? client.from('branches').select('id,name,company_id').in('id', branchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (companyResult.error) throw companyResult.error;
  if (branchResult.error) throw branchResult.error;

  const companyById = new Map((companyResult.data ?? []).map((company) => [String(company.id), company]));
  const branchById = new Map((branchResult.data ?? []).map((branch) => [String(branch.id), branch]));

  return rows.map((row) => {
    const companyId = String(row.company_id);
    const branchId = row.branch_id ? String(row.branch_id) : undefined;
    const company = companyById.get(companyId);
    const branch = branchId ? branchById.get(branchId) : undefined;
    return {
      key: `${companyId}:${branchId ?? ''}`,
      company_id: companyId,
      company_name: String(company?.trade_name ?? company?.legal_name ?? 'Empresa'),
      organization_id: company?.organization_id ? String(company.organization_id) : undefined,
      branch_id: branchId,
      branch_name: branch?.name ? String(branch.name) : undefined,
      role_code: String(row.role_code) as RoleCode,
      access_profile_id: row.access_profile_id ? String(row.access_profile_id) : null,
    };
  });
}

async function resolveProfileForAccess(
  client: NonNullable<typeof supabase>,
  profile: UserProfile,
  access: UserAccessOption,
): Promise<UserProfile> {
  const permissions = await loadPermissions(
    client,
    access.company_id,
    access.role_code,
    access.access_profile_id,
  );

  return {
    ...profile,
    role_code: access.role_code,
    company_id: access.company_id,
    branch_id: access.branch_id,
    organization_id: access.organization_id,
    permissions,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (mode !== 'demo') return null;
    const raw = localStorage.getItem('cronos-user');
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  });
  const [accesses, setAccesses] = useState<UserAccessOption[]>([]);
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
            setAccesses([]);
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

        const baseProfile = profile as UserProfile;
        let resolved = baseProfile;
        let options: UserAccessOption[] = [];

        try {
          options = await loadAccessOptions(client, authUser.id);
          if (options.length) {
            const savedKey = localStorage.getItem(accessStorageKey(authUser.id));
            const selected = options.find((option) => option.key === savedKey) ?? options[0];
            resolved = await resolveProfileForAccess(client, baseProfile, selected);
            localStorage.setItem(accessStorageKey(authUser.id), selected.key);
          }
        } catch (tenantError) {
          console.warn('Sessão carregada em modo de compatibilidade sem contexto tenant:', tenantError);
        }

        if (alive) {
          setAccesses(options);
          setUser(resolved);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        if (alive) {
          setUser(null);
          setAccesses([]);
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

  const activeAccessKey = useMemo(() => {
    if (!user?.company_id) return null;
    return `${user.company_id}:${user.branch_id ?? ''}`;
  }, [user?.branch_id, user?.company_id]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      mode,
      accesses,
      activeAccessKey,

      async switchAccess(accessKey) {
        if (mode !== 'supabase' || !supabase || !user) return;
        const selected = accesses.find((option) => option.key === accessKey);
        if (!selected || selected.key === activeAccessKey) return;

        setLoading(true);
        try {
          const resolved = await resolveProfileForAccess(supabase, user, selected);
          clearSessionDrafts();
          localStorage.setItem(accessStorageKey(user.id), selected.key);
          setUser(resolved);
        } finally {
          setLoading(false);
        }
      },

      loginDemo(role) {
        const next: UserProfile = {
          id: `demo-${role}`,
          full_name: names[role],
          role_code: role,
          active: true,
        };
        localStorage.setItem('cronos-user', JSON.stringify(next));
        setAccesses([]);
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
        if (user?.id) localStorage.removeItem(accessStorageKey(user.id));
        setAccesses([]);
        setUser(null);
      },
    }),
    [accesses, activeAccessKey, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth fora do provider');
  return context;
}

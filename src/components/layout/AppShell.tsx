import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";
import { usePrimeTech } from "../../contexts/PrimeTechContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, mode } = useAuth();
  const { pathname } = useLocation();
  const titles: Record<string, string> = { ordens: 'Ordens de Serviço', clientes: 'Clientes', equipamentos: 'Equipamentos', estoque: 'Estoque', financeiro: 'Financeiro', fiscal: 'Fiscal', agenda: 'Agenda', relatorios: 'Relatórios', administracao: 'Administração' };
  const title = titles[pathname.split('/')[1]] ?? 'Dashboard';
  const { error, loading } = usePrimeTech();
  const [dark, setDark] = useState(() => localStorage.getItem("prime-tech-theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("prime-tech-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="pt-app-shell">
      <Sidebar />
      <div className="pt-main-content ml-72 min-h-screen">
        <header className="pt-topbar justify-between">
          <div>
            <p className="text-sm font-semibold">{title}</p><p className="pt-breadcrumb">Início › {title}</p>
            
          </div>
          <div className="flex items-center gap-2"><div className="hidden sm:block mr-3 text-right"><p className="text-sm font-medium">{user?.email || user?.full_name}</p><p className="text-xs text-muted capitalize">{user?.role_code} · {mode === "demo" ? "Demonstração" : "Sessão ativa"}</p></div>
            <button className="pt-btn-secondary !px-3" onClick={() => setDark((v) => !v)} aria-label="Alternar tema">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="pt-btn-secondary" onClick={() => logout()}><LogOut size={17} /> Sair</button>
          </div>
        </header>
        <main className="p-6">{error ? <p role="alert" className="pt-card text-red-400">{error}</p> : loading ? <p role="status">Carregando dados…</p> : children}</main>
      </div>
    </div>
  );
}

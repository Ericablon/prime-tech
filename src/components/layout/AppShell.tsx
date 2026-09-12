import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, mode } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("prime-tech-theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("prime-tech-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="pt-app-shell">
      <Sidebar />
      <div className="ml-72 min-h-screen">
        <header className="pt-topbar justify-between">
          <div>
            <p className="text-sm font-medium">{user?.full_name}</p>
            <p className="text-xs text-muted capitalize">{user?.role_code} • {mode === "demo" ? "Modo demonstração" : "Supabase"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="pt-btn-secondary !px-3" onClick={() => setDark((v) => !v)} aria-label="Alternar tema">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="pt-btn-secondary" onClick={() => logout()}><LogOut size={17} /> Sair</button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

import { brandLogo } from "../lib/brand";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, UserRound, Wrench } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { RoleCode } from "../types/domain";

export function LoginPage() {
  const { user, mode, loginDemo, loginWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  const roles: Array<{ role: RoleCode; label: string; icon: typeof UserRound; description: string }> = [
    { role: "atendimento", label: "Atendimento", icon: UserRound, description: "Clientes, equipamentos, entrada, aprovação e entrega." },
    { role: "tecnico", label: "Técnico", icon: Wrench, description: "Diagnóstico, orçamento e execução da manutenção." },
    { role: "gestor", label: "Gestor", icon: ShieldCheck, description: "Visão total, financeiro, estoque, fiscal e administração." },
  ];

  return (
    <div className="pt-auth-page">
      <div className="pt-auth-card">
        <div className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-full border border-blue-400/30 shadow-[0_0_35px_rgba(22,135,255,.28)]">
          <img src={brandLogo} alt="Prime Tech" className="h-full w-full object-cover" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide">Prime Tech</h1>
          <p className="mt-1 text-sm text-muted">Sistema de Assistência Técnica</p>
        </div>

        {mode === "demo" ? (
          <div className="mt-7 space-y-3">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted">Entrar em modo demonstração</p>
            {roles.map(({ role, label, icon: Icon, description }) => (
              <button key={role} onClick={() => loginDemo(role)} className="pt-role-card w-full text-left">
                <Icon size={22} />
                <span><strong className="block">{label}</strong><small className="text-muted">{description}</small></span>
              </button>
            ))}
          </div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try { await loginWithPassword(email, password); } catch (err) { setError(err instanceof Error ? err.message : "Falha ao entrar"); }
          }}>
            <div><label className="pt-label">E-mail</label><input className="pt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label className="pt-label">Senha</label><input className="pt-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button className="pt-btn-primary w-full" type="submit">Acessar a plataforma</button>
          </form>
        )}
      </div>
    </div>
  );
}

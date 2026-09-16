import { brandLogo } from "../lib/brand";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { RoleCode } from "../types/domain";

export function LoginPage() {
  const { user, mode, authError, loginDemo, loginWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const roles: Array<{ role: RoleCode; label: string; icon: typeof UserRound; description: string }> = [
    { role: "atendimento", label: "Comercial", icon: UserRound, description: "Clientes, equipamentos, entrada, aprovação e entrega." },
    { role: "tecnico", label: "Técnico", icon: Wrench, description: "Diagnóstico, orçamento e execução da manutenção." },
    { role: "gestor", label: "Gestor", icon: ShieldCheck, description: "Visão total, financeiro, estoque, fiscal e administração." },
  ];

  return (
    <div className="pt-auth-page"><img className="pt-auth-backdrop" src={brandLogo} alt="" aria-hidden="true" />
      <div className="pt-auth-card">
        <div className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-full border border-blue-400/30 shadow-[0_0_35px_rgba(22,135,255,.28)]">
          <img src={brandLogo} alt="Prime Tech" className="h-full w-full object-cover" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide">Cronos</h1>
          <p className="mt-1 text-sm text-muted">Gestão de Assistência Técnica · Prime Tech</p>
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
          <form className="mt-8 space-y-5" onSubmit={async (e) => {
            e.preventDefault();
            setError(""); setBusy(true);
            try { await loginWithPassword(email.trim(), password); } catch (err) { setError(err instanceof Error ? err.message : "Falha ao entrar"); } finally { setBusy(false); }
          }}>
            <div><label className="pt-label" htmlFor="login-email">E-mail</label><input id="login-email" autoComplete="username" className="pt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label className="pt-label" htmlFor="login-password">Senha</label><div className="pt-password-field"><input id="login-password" autoComplete="current-password" className="pt-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required /><button type="button" className="pt-password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
            {error || authError ? <p role="alert" className="text-sm text-red-400">{error || authError}</p> : null}
            <button className="pt-btn-primary w-full" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          </form>
        )}
        <p className="pt-auth-footer">© Cronos · Prime Tech</p>
      </div>
    </div>
  );
}


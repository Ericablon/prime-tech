import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { brandLogo } from '../lib/brand';
import type { RoleCode } from '../types/domain';

const roles: Array<{
  role: RoleCode;
  label: string;
}> = [
  { role: 'gestor', label: 'Gestor' },
  { role: 'tecnico', label: 'Técnico' },
  { role: 'comercial', label: 'Comercial' },
  { role: 'atendimento', label: 'Atendimento' },
];

export function LoginPage() {
  const {
    user,
    mode,
    loginDemo,
    loginWithPassword,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoFallback, setLogoFallback] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await loginWithPassword(email, password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Falha ao entrar',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page premium-login">
      <div className="login-grid-pattern" aria-hidden="true" />
      <div className="login-glow login-glow-a" aria-hidden="true" />
      <div className="login-glow login-glow-b" aria-hidden="true" />

      <section className="premium-login-shell">
        <aside className="login-showcase">
          <div className="login-showcase-badge">
            <Sparkles size={15} />
            PRIME TECH • CRONOS
          </div>

          <div className="login-logo-stage">
            {!logoFallback ? (
              <img
                src={brandLogo}
                alt="Prime Tech"
                className="login-prime-logo"
                onError={() => setLogoFallback(true)}
              />
            ) : (
              <div className="login-logo-fallback">
                <img
                  src={`${import.meta.env.BASE_URL}brand/cronos-mark.svg`}
                  alt="Cronos"
                />
                <strong>PRIME TECH</strong>
              </div>
            )}
          </div>

          <div className="login-showcase-copy">
            <span className="eyebrow">OPERAÇÃO INTELIGENTE</span>
            <h1>
              Tecnologia que
              <br />
              <em>impulsiona sua operação.</em>
            </h1>
            <p>
              Atendimento, assistência técnica, estoque, financeiro e gestão
              em uma única visão operacional.
            </p>
          </div>

          <div className="login-security-line">
            <ShieldCheck size={17} />
            <span>Ambiente corporativo protegido</span>
          </div>
        </aside>

        <div className="login-form-panel">
          <div className="login-form-heading">
            <span className="login-kicker">CRONOS</span>
            <h2>Bem-vindo ao sistema</h2>
            <p>Acesse sua conta corporativa para continuar.</p>
          </div>

          {mode === 'demo' ? (
            <>
              <p className="demo-label">Escolha um perfil de demonstração</p>
              <div className="demo-grid premium-demo-grid">
                {roles.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    className="role-button premium-role-button"
                    onClick={() => loginDemo(item.role)}
                  >
                    <ShieldCheck size={18} />
                    <span>{item.label}</span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={handleLogin} className="premium-login-form">
              <label>
                E-mail corporativo
                <div className="login-input-wrap">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="nome@empresa.com.br"
                    required
                  />
                </div>
              </label>

              <label>
                Senha
                <div className="login-input-wrap password-wrap">
                  <LockKeyhole size={18} />
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    required
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShow((current) => !current)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {error && <p className="form-error">{error}</p>}

              <button
                className="primary-button wide premium-login-button"
                disabled={busy}
              >
                <span>{busy ? 'Entrando...' : 'Entrar no sistema'}</span>
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          <div className="login-form-footer">
            <ShieldCheck size={15} />
            <span>Prime Tech • Tecnologia que impulsiona.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

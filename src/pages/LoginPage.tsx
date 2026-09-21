import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
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

  const logo = logoFallback
    ? `${import.meta.env.BASE_URL}brand/cronos-mark.svg`
    : brandLogo;

  return (
    <main className="login-page login-v2">
      <div className="login-v2-grid" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-a" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-b" aria-hidden="true" />

      <section className="login-v2-card">
        <header className="login-v2-header">
          <div className="login-v2-logo-frame">
            <img
              src={logo}
              alt="Prime Tech"
              className={`login-v2-logo ${logoFallback ? 'fallback' : ''}`}
              onError={() => setLogoFallback(true)}
            />
          </div>

          <div className="login-v2-brand-line" aria-hidden="true">
            <span />
            <strong>PRIME TECH • CRONOS</strong>
            <span />
          </div>

          <h1>CRONOS</h1>
          <p>Gestão integrada para assistência técnica.</p>
        </header>

        {mode === 'demo' ? (
          <div className="login-v2-demo">
            <span className="login-v2-section-label">
              Acesso de demonstração
            </span>

            <div className="demo-grid login-v2-demo-grid">
              {roles.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  className="role-button login-v2-role-button"
                  onClick={() => loginDemo(item.role)}
                >
                  <ShieldCheck size={18} />
                  <span>{item.label}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="login-v2-form">
            <label>
              <span>E-mail corporativo</span>
              <div className="login-v2-input">
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
              <span>Senha</span>
              <div className="login-v2-input">
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

            {error && <p className="form-error login-v2-error">{error}</p>}

            <button
              className="primary-button wide login-v2-submit"
              disabled={busy}
            >
              <span>{busy ? 'Entrando...' : 'Entrar no sistema'}</span>
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        <footer className="login-v2-footer">
          <ShieldCheck size={15} />
          <span>Ambiente corporativo protegido</span>
        </footer>
      </section>

      <p className="login-v2-signature">
        Prime Tech • Tecnologia que impulsiona.
      </p>
    </main>
  );
}

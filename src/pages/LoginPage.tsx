import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';

import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { brandLogo, brandMark } from '../lib/brand';
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
  const { theme, toggleTheme } = useTheme();

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
    if (busy) return;

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

  const handleFormKeyDown = (
    event: React.KeyboardEvent<HTMLFormElement>,
  ) => {
    if (
      event.key !== 'Enter'
      || event.nativeEvent.isComposing
      || busy
      || !(event.target instanceof HTMLInputElement)
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  const logo = logoFallback ? brandMark : brandLogo;

  return (
    <main className="login-page login-v2 login-atlas">
      <div className="login-v2-grid" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-a" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-b" aria-hidden="true" />
      <div className="login-v2-horizon" aria-hidden="true" />
      <img src={brandLogo} alt="" className="login-v2-watermark" aria-hidden="true" />

      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <section className="login-v2-card">
        <div className="login-v2-card-shine" aria-hidden="true" />

        <header className="login-v2-header">
          <div className="login-v2-logo-stage">
            <div className="login-v2-logo-glow" aria-hidden="true" />
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
          <form
            onSubmit={handleLogin}
            onKeyDown={handleFormKeyDown}
            className="login-v2-form"
          >
            <label>
              <span>E-mail corporativo</span>
              <div className="login-v2-input">
                <Mail size={17} />
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
                <KeyRound size={17} />
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
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <div className="login-v2-form-actions">
              <span className="login-v2-secure-hint">
                <ShieldCheck size={13} /> Acesso protegido
              </span>
              <Link to="/recuperar-senha" className="login-v2-forgot-link">
                Esqueci minha senha
              </Link>
            </div>

            {error && <p className="form-error login-v2-error">{error}</p>}

            <button
              type="submit"
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

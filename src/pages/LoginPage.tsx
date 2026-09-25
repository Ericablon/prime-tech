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

export function LoginPage() {
  const {
    user,
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

  const submitCredentials = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await loginWithPassword(email.trim(), password);
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

  const handleLogin = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    void submitCredentials();
  };

  const handleInputEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    void submitCredentials();
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

        <form
          onSubmit={handleLogin}
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
                onKeyDown={handleInputEnter}
                autoComplete="username"
                enterKeyHint="next"
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
                onKeyDown={handleInputEnter}
                autoComplete="current-password"
                enterKeyHint="go"
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
            disabled={busy || !email.trim() || !password}
          >
            <span>{busy ? 'Entrando...' : 'Entrar no sistema'}</span>
            {!busy && <ArrowRight size={18} />}
          </button>
        </form>

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

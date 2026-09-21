import {
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import type { RoleCode } from '../types/domain';

const roles: Array<{
  role: RoleCode;
  label: string;
}> = [
  {
    role: 'gestor',
    label: 'Gestor',
  },
  {
    role: 'tecnico',
    label: 'Técnico',
  },
  {
    role: 'comercial',
    label: 'Comercial',
  },
  {
    role: 'atendimento',
    label: 'Atendimento',
  },
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

  const logoUrl =
    `${import.meta.env.BASE_URL}brand/prime-tech-logo.jpeg`;

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
    <main className="login-page">
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />

      <section className="login-card">
        <div className="login-brand">
          <div
            style={{
              width: '150px',
              height: '76px',
              marginBottom: '8px',
              borderRadius: '14px',
              background: '#ffffff',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              padding: '6px',
            }}
          >
            <img
              src={logoUrl}
              alt="Prime Tech"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          <span>CRONOS</span>

          <small>
            Gestão de Assistência Técnica
          </small>
        </div>

        {mode === 'demo' ? (
          <>
            <p className="demo-label">
              Ambiente de demonstração
            </p>

            <div className="demo-grid">
              {roles.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  className="role-button"
                  onClick={() =>
                    loginDemo(item.role)
                  }
                >
                  <ShieldCheck size={18} />

                  <span>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={handleLogin}>
            <label>
              E-mail

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="username"
                required
              />
            </label>

            <label>
              Senha

              <div className="password-wrap">
                <input
                  type={
                    show
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  aria-label={
                    show
                      ? 'Ocultar senha'
                      : 'Mostrar senha'
                  }
                  onClick={() =>
                    setShow(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {show ? (
                    <EyeOff />
                  ) : (
                    <Eye />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p className="form-error">
                {error}
              </p>
            )}

            <button
              className="primary-button wide"
              disabled={busy}
            >
              {busy
                ? 'Entrando...'
                : 'Entrar'}
            </button>
          </form>
        )}

        <footer>
          Cronos • Prime Tech
        </footer>
      </section>
    </main>
  );
}

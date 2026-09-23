import { ArrowLeft, Mail, Send, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { brandLogo } from '../lib/brand';
import { supabase } from '../lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    setSent(false);

    try {
      if (!supabase) throw new Error('Supabase não configurado.');

      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a recuperação de senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page login-v2">
      <div className="login-v2-grid" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-a" aria-hidden="true" />
      <div className="login-v2-glow login-v2-glow-b" aria-hidden="true" />

      <section className="login-v2-card">
        <header className="login-v2-header">
          <div className="login-v2-logo-frame">
            <img src={brandLogo} alt="Prime Tech" className="login-v2-logo" />
          </div>
          <div className="login-v2-brand-line" aria-hidden="true"><span /><strong>PRIME TECH • CRONOS</strong><span /></div>
          <h1>Recuperar senha</h1>
          <p>Informe seu e-mail de acesso. Enviaremos um link seguro para criar uma nova senha.</p>
        </header>

        <form onSubmit={submit} className="login-v2-form">
          <label>
            <span>E-mail corporativo</span>
            <div className="login-v2-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                required
              />
            </div>
          </label>

          {sent && (
            <div className="notice">
              <ShieldCheck size={18} />
              <div>
                <strong>E-mail enviado</strong>
                <p>Se este e-mail estiver cadastrado, você receberá o link de redefinição. Verifique também o spam.</p>
              </div>
            </div>
          )}

          {error && <p className="form-error login-v2-error">{error}</p>}

          <button type="submit" className="primary-button wide login-v2-submit" disabled={busy || !email.trim()}>
            <span>{busy ? 'Enviando...' : 'Enviar link de recuperação'}</span>
            {!busy && <Send size={18} />}
          </button>

          <Link to="/login" className="ghost-button" style={{ justifyContent: 'center' }}>
            <ArrowLeft size={16} /> Voltar para o login
          </Link>
        </form>

        <footer className="login-v2-footer">
          <ShieldCheck size={15} />
          <span>O Cronos nunca solicita sua senha por e-mail.</span>
        </footer>
      </section>
    </main>
  );
}

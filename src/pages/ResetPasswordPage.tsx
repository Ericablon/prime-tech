import { ArrowLeft, Eye, EyeOff, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { brandLogo } from '../lib/brand';
import { supabase } from '../lib/supabase';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase não configurado.');
      setChecking(false);
      return;
    }

    let alive = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setReady(Boolean(data.session));
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || success) return;

    setError('');

    if (password.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas informadas não são iguais.');
      return;
    }

    setBusy(true);
    try {
      if (!supabase) throw new Error('Supabase não configurado.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.');
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
          <h1>Nova senha</h1>
          <p>Crie uma nova senha para continuar usando o Cronos.</p>
        </header>

        {checking ? (
          <div className="notice"><ShieldCheck size={18} /><div><strong>Validando link</strong><p>Aguarde um instante.</p></div></div>
        ) : !ready ? (
          <div className="login-v2-form">
            <div className="notice"><ShieldCheck size={18} /><div><strong>Link inválido ou expirado</strong><p>Solicite um novo e-mail de recuperação.</p></div></div>
            <Link to="/recuperar-senha" className="primary-button wide" style={{ justifyContent: 'center' }}>Solicitar novo link</Link>
            <Link to="/login" className="ghost-button" style={{ justifyContent: 'center' }}><ArrowLeft size={16} /> Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="login-v2-form">
            <label>
              <span>Nova senha</span>
              <div className="login-v2-input">
                <LockKeyhole size={18} />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  required
                />
                <button type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow((value) => !value)}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              <span>Confirmar nova senha</span>
              <div className="login-v2-input">
                <LockKeyhole size={18} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  required
                />
                <button type="button" aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowConfirm((value) => !value)}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {success && <div className="notice"><ShieldCheck size={18} /><div><strong>Senha atualizada</strong><p>Entrando no Cronos...</p></div></div>}
            {error && <p className="form-error login-v2-error">{error}</p>}

            <button type="submit" className="primary-button wide login-v2-submit" disabled={busy || success}>
              <span>{busy ? 'Salvando...' : 'Salvar nova senha'}</span>
              {!busy && <Save size={18} />}
            </button>
          </form>
        )}

        <footer className="login-v2-footer"><ShieldCheck size={15} /><span>Recuperação segura pelo Supabase Auth</span></footer>
      </section>
    </main>
  );
}

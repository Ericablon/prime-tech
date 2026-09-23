import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Save, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function AccountPasswordPage() {
  const { mode, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (mode !== 'supabase' || !supabase) {
      setError('A troca de senha exige conexão com o Supabase.');
      return;
    }
    if (!currentPassword) {
      setError('Informe sua senha atual.');
      return;
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha precisa ser diferente da senha atual.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const email = authData.user?.email ?? user?.email;
      if (!email) throw new Error('Não foi possível identificar o e-mail da sua conta.');

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) throw new Error('Senha atual incorreta.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Senha alterada com sucesso.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar sua senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Minha conta"
        title="Alterar minha senha"
        description="Troque sua senha sem sair do Cronos. Para sua segurança, confirme primeiro a senha atual."
      />

      {(error || success) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <div>
            <strong>{error ? 'Não foi possível alterar a senha' : 'Senha atualizada'}</strong>
            <p>{error || success}</p>
          </div>
        </section>
      )}

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Segurança</span><h2>Credenciais de acesso</h2></div>
          <ShieldCheck size={22} />
        </div>

        <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 16 }}>
          <div className="form-grid">
            <label>
              <span>Senha atual</span>
              <div className="password-field-inline">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="icon-button" onClick={() => setShowCurrent((value) => !value)} aria-label={showCurrent ? 'Ocultar senha atual' : 'Mostrar senha atual'}>
                  {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <label>
              <span>Nova senha</span>
              <div className="password-field-inline">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button type="button" className="icon-button" onClick={() => setShowNew((value) => !value)} aria-label={showNew ? 'Ocultar nova senha' : 'Mostrar nova senha'}>
                  {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <small className="muted">Mínimo de 8 caracteres. Regras adicionais do Supabase também serão respeitadas.</small>
            </label>

            <label>
              <span>Confirmar nova senha</span>
              <div className="password-field-inline">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button type="button" className="icon-button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}>
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          </div>

          <div className="notice" style={{ marginBottom: 0 }}>
            <KeyRound size={18} />
            <div><strong>Alteração autenticada</strong><p>O Cronos valida sua senha atual antes de gravar a nova senha.</p></div>
          </div>

          <div className="quick-actions">
            <button type="submit" className="primary-button" disabled={busy || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}>
              <Save size={16} /> {busy ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

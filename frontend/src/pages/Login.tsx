import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/auth';
import { Alert, Field } from '../components/ui';
export function Login() {
  const { user, login } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(String(data.get('email')), String(data.get('password')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <Building2 />
          ImobiTech.
        </div>
        <div>
          <p className="eyebrow">GESTÃO COM MAIS CLAREZA</p>
          <h1>
            Seu próximo passo.
            <br />
            Tudo em um só lugar.
          </h1>
          <p>Organize imóveis e conecte as pessoas que fazem parte da sua operação.</p>
          <div className="building-art" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </div>
        <small>Grupo 06 · Universidade Católica de Brasília</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="login-mark">
            <Building2 size={28} />
          </div>
          <p className="eyebrow">BEM-VINDO AO IMOBITECH</p>
          <h1>Acesse sua conta</h1>
          <p className="muted">Entre com suas credenciais para continuar.</p>
          <Alert>{error}</Alert>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="seu@email.com"
              required
              maxLength={254}
            />
          </Field>
          <Field label="Senha">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
              maxLength={128}
            />
          </Field>
          <button className="button" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar na plataforma'}
            <ArrowRight size={18} />
          </button>
          <p className="login-note">
            <ShieldCheck size={17} />
            Acesso exclusivo para usuários cadastrados.
          </p>
          <p className="muted small">
            Precisa de acesso? Entre em contato com o administrador da sua equipe.
          </p>
        </form>
      </section>
    </div>
  );
}

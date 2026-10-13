import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Building2, House, Users, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/auth';
import { roleLabels } from '../types';
import { Alert } from '../components/ui';
export function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <span className="brand">
          <Building2 /> ImobiTech
        </span>
        <button
          className="button secondary icon"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-symbol">
            <Building2 size={25} />
          </span>
          ImobiTech<span className="brand-dot">.</span>
        </div>
        <p className="sidebar-caption">GESTÃO IMOBILIÁRIA</p>
        <nav onClick={() => setOpen(false)}>
          <NavLink end to="/">
            <House size={19} />
            Início
          </NavLink>
          {user?.role !== 'tenant' && (
            <NavLink to="/properties">
              <Building2 size={19} />
              {user?.role === 'owner' ? 'Meus imóveis' : 'Imóveis'}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/users">
              <Users size={19} />
              Usuários
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="profile">
            <span className="avatar">{user?.name.slice(0, 1)}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>{roleLabels[user!.role]}</small>
            </div>
          </div>
          <button
            className="logout"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await logout();
              } catch {
                setError('Não foi possível sair. Tente novamente.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
            {busy ? 'Saindo…' : 'Sair da conta'}
          </button>
          <small>ImobiTech · v0.1</small>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <span>Seu espaço de gestão</span>
          <span className="topbar-role">{roleLabels[user!.role]}</span>
        </div>
        <div className="content">
          <Alert>{error}</Alert>
          <Outlet />
        </div>
        <footer>ImobiTech · Grupo 06 · Universidade Católica de Brasília</footer>
      </main>
    </div>
  );
}

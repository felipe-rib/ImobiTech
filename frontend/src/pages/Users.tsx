import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Users as UsersIcon, ArrowLeft } from 'lucide-react';
import { Alert, Badge, Field, Heading, Loading, Pagination, SearchBox } from '../components/ui';
import { useList } from '../hooks/useList';
import { api } from '../services/api';
import { roleLabels, type User, type Role } from '../types';
export function Users() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const location = useLocation();
  const q = new URLSearchParams({
    search,
    page: String(page),
    ...(role ? { role } : {}),
    ...(active ? { active } : {}),
  });
  const { data, loading, error, retry } = useList<User>(`/users?${q}`);
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO"
        title="Usuários"
        description="Pessoas e permissões, organizadas em um só lugar."
        action={{ to: '/users/new', label: 'Novo usuário' }}
      />
      <Alert success>{location.state?.message}</Alert>
      <section className="panel">
        <div className="filters">
          <SearchBox
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <select
            aria-label="Filtrar perfil"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os perfis</option>
            {Object.entries(roleLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar situação"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
        <Alert>{error}</Alert>
        {error && (
          <button className="button secondary" onClick={retry}>
            Tentar novamente
          </button>
        )}
        {loading ? (
          <Loading />
        ) : (
          !error && (
            <>
              {data.items.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>Perfil</th>
                        <th>Situação</th>
                        <th>
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="person">
                              <span className="avatar light">{u.name[0]}</span>
                              <div>
                                <strong>{u.name}</strong>
                                <small>{u.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>{roleLabels[u.role]}</td>
                          <td>
                            <Badge active={u.active}>{u.active ? 'Ativo' : 'Inativo'}</Badge>
                          </td>
                          <td>
                            <Link className="text-link" to={`/users/${u.id}`}>
                              Consultar / editar
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">
                  <UsersIcon size={35} />
                  <h3>Nenhum usuário encontrado</h3>
                  <p>Altere os filtros ou cadastre um novo usuário.</p>
                </div>
              )}
              <Pagination page={page} total={data.total} onChange={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
export function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    const c = new AbortController();
    api<User>(`/users/${id}`, { signal: c.signal })
      .then(setUser)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [id]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    const body = {
      name: f.get('name'),
      email: f.get('email'),
      identifier: f.get('identifier') || null,
      phone: f.get('phone') || null,
      role: f.get('role') as Role,
      active: f.get('active') === 'true',
      ...(!id || password ? { password } : {}),
    };
    setBusy(true);
    setError('');
    try {
      await api(id ? `/users/${id}` : '/users', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      navigate('/users', {
        state: { message: id ? 'Usuário atualizado.' : 'Usuário cadastrado.' },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to="/users">
        <ArrowLeft size={16} />
        Voltar para usuários
      </Link>
      <Heading
        eyebrow="ADMINISTRAÇÃO"
        title={id ? 'Informações do usuário' : 'Novo usuário'}
        description="Preencha apenas os dados necessários para o acesso e a identificação."
      />
      <Alert>{error}</Alert>
      {loading ? (
        <Loading />
      ) : (
        (!id || user) && (
          <form className="panel form-panel" onSubmit={submit}>
            <h2>Dados cadastrais</h2>
            <div className="form-grid">
              <Field label="Nome completo *">
                <input
                  name="name"
                  defaultValue={user?.name}
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                />
              </Field>
              <Field label="E-mail *">
                <input
                  name="email"
                  type="email"
                  defaultValue={user?.email}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </Field>
              <Field
                label="Identificação única"
                hint="Opcional. Informe somente se necessário à operação."
              >
                <input name="identifier" defaultValue={user?.identifier ?? ''} maxLength={40} />
              </Field>
              <Field label="Telefone" hint="Opcional.">
                <input name="phone" type="tel" defaultValue={user?.phone ?? ''} maxLength={25} />
              </Field>
            </div>
            <h2>Acesso à plataforma</h2>
            <div className="form-grid">
              <Field label="Perfil *">
                <select name="role" defaultValue={user?.role ?? 'tenant'}>
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Situação *">
                <select name="active" defaultValue={user?.active === false ? 'false' : 'true'}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </Field>
              <Field
                label={id ? 'Nova senha' : 'Senha *'}
                hint={
                  id
                    ? 'Deixe em branco para manter a senha. Mínimo de 12 caracteres.'
                    : 'Mínimo de 12 caracteres.'
                }
              >
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required={!id}
                  minLength={12}
                  maxLength={128}
                />
              </Field>
            </div>
            {user?.created_at && (
              <p className="muted small">
                Cadastrado em {new Date(user.created_at).toLocaleString('pt-BR')} · Atualizado em{' '}
                {new Date(user.updated_at!).toLocaleString('pt-BR')}
              </p>
            )}
            <div className="form-actions">
              <Link className="button secondary" to="/users">
                Cancelar
              </Link>
              <button className="button" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar usuário'}
              </button>
            </div>
          </form>
        )
      )}
    </>
  );
}

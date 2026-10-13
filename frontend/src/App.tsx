import { Navigate, Outlet, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './hooks/auth';
import { Alert, Loading } from './components/ui';
import { Shell } from './layouts/Shell';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Users, UserForm } from './pages/Users';
import { Properties, PropertyDetail, PropertyForm } from './pages/Properties';
import type { Role } from './types';
function Guard({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="panel empty">
        <h1>Acesso restrito</h1>
        <p>Seu perfil não tem permissão para esta página.</p>
        <Link to="/">Voltar ao início</Link>
      </div>
    );
  return <Outlet />;
}
export default function App() {
  const { loading, error, refresh } = useAuth();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="empty">
        <Alert>{error}</Alert>
        <button className="button" onClick={() => void refresh()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route element={<Guard roles={['admin']} />}>
            <Route path="users" element={<Users />} />
            <Route path="users/new" element={<UserForm key="new" />} />
            <Route path="users/:id" element={<UserForm />} />
          </Route>
          <Route element={<Guard roles={['admin', 'broker', 'owner']} />}>
            <Route path="properties" element={<Properties />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
          </Route>
          <Route element={<Guard roles={['admin', 'broker']} />}>
            <Route path="properties/new" element={<PropertyForm key="new" />} />
            <Route path="properties/:id/edit" element={<PropertyForm />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Página não encontrada</h1>
                <Link to="/">Voltar ao início</Link>
              </div>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

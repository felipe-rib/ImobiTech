import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/auth';
import { Heading } from '../components/ui';
import { roleLabels } from '../types';
export function Home() {
  const { user } = useAuth();
  return (
    <>
      <Heading
        eyebrow="VISÃO GERAL"
        title={`Olá, ${user!.name.split(' ')[0]}.`}
        description="Bem-vindo ao seu espaço no ImobiTech."
      />
      <section className="welcome">
        <div>
          <span className="badge">{roleLabels[user!.role]}</span>
          <h2>Uma gestão mais simples começa aqui.</h2>
          <p>
            {user!.role === 'tenant'
              ? 'Sua conta está ativa. Nesta versão, sua área permite confirmar suas informações de acesso.'
              : 'Acesse os cadastros disponíveis para o seu perfil e mantenha as informações organizadas.'}
          </p>
        </div>
        <Building2 size={96} strokeWidth={1} />
      </section>
      <h2 className="section-title">Seu espaço de trabalho</h2>
      <div className="shortcut-grid">
        {user!.role !== 'tenant' && (
          <Link className="shortcut" to="/properties">
            <span className="shortcut-icon">
              <Building2 />
            </span>
            <ArrowUpRight className="shortcut-arrow" />
            <h3>{user!.role === 'owner' ? 'Meus imóveis' : 'Gerenciar imóveis'}</h3>
            <p>
              {user!.role === 'owner'
                ? 'Consulte as informações dos imóveis vinculados à sua conta.'
                : 'Cadastre, consulte e atualize seu portfólio de imóveis.'}
            </p>
            <strong>Acessar imóveis →</strong>
          </Link>
        )}
        {user!.role === 'admin' && (
          <Link className="shortcut" to="/users">
            <span className="shortcut-icon">
              <Users />
            </span>
            <ArrowUpRight className="shortcut-arrow" />
            <h3>Gerenciar usuários</h3>
            <p>Organize os cadastros, os perfis e as permissões de acesso.</p>
            <strong>Acessar usuários →</strong>
          </Link>
        )}
        <div className="shortcut account">
          <span className="shortcut-icon">
            <ShieldCheck />
          </span>
          <h3>Minha conta</h3>
          <dl>
            <dt>Nome</dt>
            <dd>{user!.name}</dd>
            <dt>E-mail</dt>
            <dd>{user!.email}</dd>
            <dt>Perfil</dt>
            <dd>{roleLabels[user!.role]}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Alert, Badge, Field, Heading, Loading, Pagination, SearchBox } from '../components/ui';
import { Lookup, calendarDate, dateTime, stateLabels, type Option } from '../components/RentalUI';
import { useAuth } from '../hooks/auth';
import { useList } from '../hooks/useList';
import { useResource } from '../hooks/useResource';
import { api } from '../services/api';
import { money } from '../types';
import type { Contract, Audit } from '../types/rental';

export function Contracts({ finance = false }: { finance?: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1);
  const location = useLocation();
  const query = new URLSearchParams({ search, page: String(page), ...(status ? { status } : {}) });
  const { data, loading, error, retry } = useList<Contract>(`/contracts?${query}`);
  return (
    <>
      <Heading
        eyebrow={finance ? 'ACOMPANHAMENTO' : 'LOCAÇÕES'}
        title={finance ? 'Situação financeira' : 'Contratos'}
        description={
          finance
            ? 'Selecione um contrato para consultar pagamentos, pendências e vencimentos.'
            : 'Consulte os vínculos e acompanhe a vigência de cada locação.'
        }
        action={
          !finance && user?.role === 'admin'
            ? { to: '/contracts/new', label: 'Novo contrato' }
            : undefined
        }
      />
      <Alert success>{location.state?.message}</Alert>
      <section className="panel">
        <div className="filters">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar imóvel ou parte do contrato"
          />
          <select
            aria-label="Filtrar situação do contrato"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="active">Ativo</option>
            <option value="closed">Encerrado</option>
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
                <div className="rental-list">
                  {data.items.map((c) => (
                    <article className="rental-row" key={c.id}>
                      <div>
                        <Badge active={c.status === 'active'}>{stateLabels[c.status]}</Badge>
                        <h2>{c.property_title}</h2>
                        <p>
                          {c.owner_name} · {c.tenant_name}
                        </p>
                        <p className="small">
                          {calendarDate(c.start_date)} a {calendarDate(c.end_date)} ·{' '}
                          {money(c.monthly_rent)}/mês
                        </p>
                      </div>
                      <Link
                        className="button secondary"
                        to={`/contracts/${c.id}${finance ? '/finance' : ''}`}
                      >
                        {finance ? 'Consultar lançamentos' : 'Ver contrato'}
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <FileText size={35} />
                  <h3>Nenhum contrato encontrado</h3>
                  <p>
                    {user?.role === 'admin'
                      ? 'Cadastre uma locação ou ajuste os filtros.'
                      : 'Não há contratos vinculados à sua conta com estes filtros.'}
                  </p>
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
export function ContractForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    data: c,
    loading,
    error: loadError,
  } = useResource<Contract>(id ? `/contracts/${id}` : null);
  const [property, setProperty] = useState<Option | null>(null),
    [tenant, setTenant] = useState<Option | null>(null),
    [startDate, setStartDate] = useState(() =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    ),
    [baseRent, setBaseRent] = useState(''),
    [discount, setDiscount] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const annualEnd = (start: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
    const date = new Date(`${start}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  };
  const baseCents = Math.round(Number(baseRent) * 100);
  const discountCents = Math.round(Number(discount || 0) * 100);
  const validRent =
    Number.isFinite(baseCents) &&
    baseCents > 0 &&
    Number.isFinite(discountCents) &&
    discountCents >= 0 &&
    discountCents < baseCents;
  const finalRent = validRent ? ((baseCents - discountCents) / 100).toFixed(2) : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const body = {
      start_date: f.get('start_date'),
      end_date: f.get('end_date'),
      monthly_rent: id ? Number(f.get('monthly_rent')) : Number(finalRent),
      due_day: Number(f.get('due_day')),
      ...(!id
        ? { property_id: property?.id, owner_id: property?.owner_id, tenant_id: tenant?.id }
        : {}),
    };
    setBusy(true);
    setError('');
    try {
      const result = await api<Contract>(id ? `/contracts/${id}` : '/contracts', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      navigate(`/contracts/${result.id}`, {
        state: {
          message: id
            ? 'Contrato atualizado.'
            : 'Contrato criado. O imóvel está indisponível para nova locação.',
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={id ? `/contracts/${id}` : '/contracts'}>
        <ArrowLeft size={16} />
        Voltar
      </Link>
      <Heading
        eyebrow="LOCAÇÕES"
        title={id ? 'Editar contrato' : 'Novo contrato'}
        description="Mantenha a vigência e as condições da locação registradas."
      />
      <Alert>{loadError || error}</Alert>
      {loading ? (
        <Loading />
      ) : (
        (!id || c) && (
          <form className="panel form-panel" onSubmit={submit}>
            {id ? (
              <div className="contract-parties">
                <h2>{c!.property_title}</h2>
                <p>Proprietário: {c!.owner_name}</p>
                <p>Inquilino: {c!.tenant_name}</p>
                <p className="muted small">Os vínculos são preservados para manter o histórico.</p>
              </div>
            ) : (
              <>
                <h2>Imóvel e partes</h2>
                <div className="form-grid">
                  <Lookup
                    label="Imóvel disponível"
                    path="/contracts/options?kind=properties"
                    value={property}
                    onSelect={(option) => {
                      setProperty(option);
                      setBaseRent(option?.rent ?? '');
                      setDiscount('');
                    }}
                    emptyMessage="Nenhum imóvel disponível. Cadastre um imóvel ou confira sua situação."
                  />
                  <Lookup
                    label="Inquilino"
                    path="/contracts/options?kind=tenants"
                    value={tenant}
                    onSelect={setTenant}
                    emptyMessage="Nenhum inquilino ativo cadastrado. Cadastre um em Usuários."
                  />
                </div>
                {property && (
                  <p className="muted">
                    Proprietário vinculado: <strong>{property.owner_name}</strong>
                  </p>
                )}
              </>
            )}
            <h2>Condições da locação</h2>
            {!id && <p className="muted">Prazo anual: 12 meses a partir da data de início.</p>}
            <div className="form-grid">
              <Field label="Início da vigência *">
                <input
                  type="date"
                  name="start_date"
                  required
                  value={id ? undefined : startDate}
                  defaultValue={id ? c?.start_date : undefined}
                  onChange={id ? undefined : (e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="Término da vigência *">
                <input
                  type="date"
                  name="end_date"
                  required
                  readOnly={!id}
                  value={id ? undefined : annualEnd(startDate)}
                  defaultValue={id ? c?.end_date : undefined}
                />
              </Field>
              {!id && (
                <>
                  <Field
                    label="Aluguel do imóvel (R$) *"
                    hint={
                      property?.rent
                        ? 'Preenchido pelo cadastro do imóvel.'
                        : 'Informe o aluguel antes de continuar.'
                    }
                  >
                    <input
                      type="number"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      required
                      value={baseRent}
                      onChange={(e) => setBaseRent(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Desconto mensal (R$)"
                    hint="Opcional. Aplicado ao valor mensal do contrato."
                  >
                    <input
                      type="number"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0,00"
                    />
                  </Field>
                </>
              )}
              <Field label="Valor mensal (R$) *">
                <input
                  type="number"
                  name="monthly_rent"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  required
                  readOnly={!id}
                  value={id ? undefined : finalRent}
                  defaultValue={id ? c?.monthly_rent : undefined}
                />
              </Field>
              <Field
                label="Dia de vencimento *"
                hint="De 1 a 31. Nos meses menores, utilize o último dia do mês nos lançamentos."
              >
                <input
                  type="number"
                  name="due_day"
                  min="1"
                  max="31"
                  required
                  defaultValue={c?.due_day ?? 10}
                />
              </Field>
            </div>
            <div className="form-actions">
              <Link className="button secondary" to="/contracts">
                Cancelar
              </Link>
              <button
                className="button"
                disabled={
                  busy ||
                  (!id && (!property || !tenant || !validRent || !annualEnd(startDate))) ||
                  c?.status === 'closed'
                }
              >
                {busy ? 'Salvando…' : 'Salvar contrato'}
              </button>
            </div>
          </form>
        )
      )}
    </>
  );
}
export function ContractDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data: c, loading, error: loadError, reload } = useResource<Contract>(`/contracts/${id}`);
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [showHistory, setShowHistory] = useState(false);
  const history = useResource<Audit[]>(showHistory ? `/contracts/${id}/history` : null);
  async function close() {
    setBusy(true);
    setError('');
    try {
      await api(`/contracts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      setConfirm(false);
      reload();
      history.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to="/contracts">
        <ArrowLeft size={16} />
        Voltar para contratos
      </Link>
      <Alert>{loadError || error}</Alert>
      <Alert success>{location.state?.message}</Alert>
      {loading ? (
        <Loading />
      ) : (
        c && (
          <>
            <Heading
              eyebrow="LOCAÇÃO"
              title={c.property_title}
              description="Dados do contrato e acesso aos lançamentos financeiros."
              action={
                user?.role === 'admin' && c.status === 'active'
                  ? { to: `/contracts/${id}/edit`, label: 'Editar contrato' }
                  : undefined
              }
            />
            <section className="panel detail-panel">
              <Badge active={c.status === 'active'}>{stateLabels[c.status]}</Badge>
              <dl className="facts-grid">
                <div>
                  <dt>Proprietário</dt>
                  <dd>{c.owner_name}</dd>
                </div>
                <div>
                  <dt>Inquilino</dt>
                  <dd>{c.tenant_name}</dd>
                </div>
                <div>
                  <dt>Vigência</dt>
                  <dd>
                    {calendarDate(c.start_date)} a {calendarDate(c.end_date)}
                  </dd>
                </div>
                <div>
                  <dt>Valor mensal</dt>
                  <dd>{money(c.monthly_rent)}</dd>
                </div>
                <div>
                  <dt>Dia de vencimento</dt>
                  <dd>{c.due_day}</dd>
                </div>
                {c.closed_at && (
                  <div>
                    <dt>Encerramento</dt>
                    <dd>{dateTime(c.closed_at)}</dd>
                  </div>
                )}
              </dl>
              <div className="action-row">
                <Link className="button" to={`/contracts/${id}/finance`}>
                  Consultar financeiro
                </Link>
                {user?.role === 'admin' && (
                  <>
                    <button
                      className="button secondary"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      {showHistory ? 'Ocultar histórico' : 'Histórico de alterações'}
                    </button>
                    {c.status === 'active' && (
                      <button className="button danger" onClick={() => setConfirm(true)}>
                        Encerrar contrato
                      </button>
                    )}
                  </>
                )}
              </div>
              {confirm && (
                <div className="confirmation" role="region" aria-label="Confirmar encerramento">
                  <h3>Encerrar esta locação?</h3>
                  <p>
                    O imóvel voltará a ficar disponível. O contrato e seus pagamentos serão
                    preservados; o encerramento não poderá ser revertido.
                  </p>
                  <div className="action-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => setConfirm(false)}
                    >
                      Manter contrato ativo
                    </button>
                    <button className="button danger" disabled={busy} onClick={() => void close()}>
                      {busy ? 'Encerrando…' : 'Confirmar encerramento'}
                    </button>
                  </div>
                </div>
              )}
            </section>
            {showHistory && (
              <section className="panel detail-panel section-gap">
                <h2>Histórico de alterações</h2>
                <Alert>{history.error}</Alert>
                {history.loading ? (
                  <Loading />
                ) : (
                  history.data?.map((event) => (
                    <article className="history-item" key={event.id}>
                      <strong>
                        {event.entity_type === 'contract' ? 'Contrato' : 'Pagamento'} ·{' '}
                        {{ created: 'Cadastro', updated: 'Atualização', closed: 'Encerramento' }[
                          event.action
                        ] ?? event.action}
                      </strong>
                      <p>
                        {dateTime(event.occurred_at)} · {event.actor_name}
                      </p>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )
      )}
    </>
  );
}

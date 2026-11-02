import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { Alert, Badge, Field, Heading, Loading, Pagination, SearchBox } from '../components/ui';
import { Lookup, dateTime, stateLabels, type Option } from '../components/RentalUI';
import { useAuth } from '../hooks/auth';
import { useList } from '../hooks/useList';
import { api } from '../services/api';
import type { Visit } from '../types/rental';
export function Visits() {
  const { user } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState<string | null>(null),
    [cancelId, setCancelId] = useState<string | null>(null);
  const query = new URLSearchParams({ search, page: String(page), ...(status ? { status } : {}) });
  const result = useList<Visit>(`/visits?${query}`);
  async function change(id: string, state: string) {
    setBusy(id);
    setError('');
    setSuccess('');
    try {
      await api(`/visits/${id}`, { method: 'PATCH', body: JSON.stringify({ status: state }) });
      setCancelId(null);
      setSuccess(state === 'cancelled' ? 'Visita cancelada.' : 'Visita confirmada.');
      result.retry();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ATENDIMENTO"
        title="Visitas"
        description={
          user?.role === 'broker'
            ? 'Organize seus atendimentos e confirme os próximos horários.'
            : 'Consulte a agenda registrada pelos corretores.'
        }
        action={
          user?.role === 'broker' ? { to: '/visits/new', label: 'Agendar visita' } : undefined
        }
      />
      <Alert>{error || result.error}</Alert>
      <Alert success>{success || location.state?.message}</Alert>
      <section className="panel">
        <div className="filters">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar imóvel ou participante"
          />
          <select
            aria-label="Filtrar situação da visita"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="scheduled">Agendada</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        {result.loading ? (
          <Loading />
        ) : (
          !result.error && (
            <>
              {result.data.items.length ? (
                <div className="rental-list">
                  {result.data.items.map((v) => (
                    <article className="rental-row" key={v.id}>
                      <div>
                        <Badge active={v.status === 'confirmed'}>{stateLabels[v.status]}</Badge>
                        <h2>{v.property_title}</h2>
                        <p>
                          {dateTime(v.starts_at)} a{' '}
                          {new Date(v.ends_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p>Participante: {v.participant_name}</p>
                        {user?.role === 'admin' && <p>Corretor: {v.broker_name}</p>}
                      </div>
                      {user?.role === 'broker' &&
                        v.status !== 'cancelled' &&
                        new Date(v.starts_at).getTime() > Date.now() && (
                          <div className="action-row">
                            {v.status === 'scheduled' && (
                              <button
                                className="button secondary"
                                disabled={busy === v.id}
                                onClick={() => void change(v.id, 'confirmed')}
                              >
                                Confirmar visita
                              </button>
                            )}
                            {cancelId === v.id ? (
                              <>
                                <button
                                  className="button danger"
                                  disabled={busy === v.id}
                                  onClick={() => void change(v.id, 'cancelled')}
                                >
                                  Confirmar cancelamento
                                </button>
                                <button
                                  className="button secondary"
                                  disabled={busy === v.id}
                                  onClick={() => setCancelId(null)}
                                >
                                  Manter visita
                                </button>
                              </>
                            ) : (
                              <button
                                className="button secondary"
                                onClick={() => setCancelId(v.id)}
                              >
                                Cancelar visita
                              </button>
                            )}
                          </div>
                        )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <CalendarDays size={35} />
                  <h3>Nenhuma visita encontrada</h3>
                  <p>Os agendamentos aparecerão aqui após o cadastro.</p>
                </div>
              )}
              <Pagination page={page} total={result.data.total} onChange={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
export function VisitForm() {
  const navigate = useNavigate();
  const [property, setProperty] = useState<Option | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const body = {
        property_id: property?.id,
        participant_name: f.get('participant_name'),
        starts_at: new Date(String(f.get('starts_at'))).toISOString(),
        ends_at: new Date(String(f.get('ends_at'))).toISOString(),
      };
      await api('/visits', { method: 'POST', body: JSON.stringify(body) });
      navigate('/visits', { state: { message: 'Visita agendada.' } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to="/visits">
        <ArrowLeft size={16} />
        Voltar para visitas
      </Link>
      <Heading
        eyebrow="ATENDIMENTO"
        title="Agendar visita"
        description="Escolha um imóvel disponível e um período livre para o atendimento."
      />
      <Alert>{error}</Alert>
      <form className="panel form-panel" onSubmit={submit}>
        <Lookup
          label="Imóvel"
          path="/properties?status=available"
          value={property}
          onSelect={setProperty}
        />
        <Field label="Participante interessado *">
          <input name="participant_name" required minLength={3} maxLength={120} />
        </Field>
        <div className="form-grid">
          <Field label="Início da visita *">
            <input name="starts_at" type="datetime-local" required />
          </Field>
          <Field label="Término da visita *">
            <input name="ends_at" type="datetime-local" required />
          </Field>
        </div>
        <p className="muted small">
          Horários no fuso deste dispositivo. Visitas consecutivas são permitidas; períodos
          sobrepostos para o mesmo imóvel ou corretor são bloqueados.
        </p>
        <div className="form-actions">
          <Link className="button secondary" to="/visits">
            Cancelar
          </Link>
          <button className="button" disabled={busy || !property}>
            {busy ? 'Agendando…' : 'Salvar visita'}
          </button>
        </div>
      </form>
    </>
  );
}

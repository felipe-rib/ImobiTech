import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Wallet } from 'lucide-react';
import { Alert, Badge, Field, Heading, Loading, Pagination } from '../components/ui';
import { calendarDate, stateLabels } from '../components/RentalUI';
import { useAuth } from '../hooks/auth';
import { useResource } from '../hooks/useResource';
import { api, uploadDocument } from '../services/api';
import { money } from '../types';
import type { Contract, Payment, PaymentPage } from '../types/rental';
export function Finance() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [page, setPage] = useState(1),
    [view, setView] = useState<'next' | 'all'>('next'),
    [status, setStatus] = useState(''),
    [proofFiles, setProofFiles] = useState<Record<string, File>>({}),
    [busyId, setBusyId] = useState(''),
    [actionError, setActionError] = useState('');
  const contract = useResource<Contract>(`/contracts/${id}`);
  const result = useResource<PaymentPage>(
    `/contracts/${id}/payments?page=${view === 'next' ? 1 : page}${view === 'all' && status ? `&status=${status}` : ''}`,
  );
  const visiblePayments =
    view === 'next'
      ? (result.data?.items.filter((payment) => !payment.paid_at).slice(0, 1) ?? [])
      : (result.data?.items ?? []);
  function installmentNumber(competence: string) {
    const start = contract.data?.start_date.slice(0, 7);
    if (!start) return null;
    const [year, month] = competence.split('-').map(Number);
    const [startYear, startMonth] = start.split('-').map(Number);
    return (year - startYear) * 12 + month - startMonth + 1;
  }
  async function sendProof(paymentId: string) {
    const file = proofFiles[paymentId];
    if (!file) return;
    setBusyId(paymentId);
    setActionError('');
    try {
      await uploadDocument(`/payments/${paymentId}/proof`, file);
      setProofFiles((old) => {
        const next = { ...old };
        delete next[paymentId];
        return next;
      });
      result.reload();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusyId('');
    }
  }
  async function review(paymentId: string, decision: 'approved' | 'rejected') {
    setBusyId(paymentId);
    setActionError('');
    try {
      await api(`/payments/${paymentId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      result.reload();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusyId('');
    }
  }
  async function generate() {
    setBusyId('generate');
    setActionError('');
    try {
      await api(`/contracts/${id}/payments/generate`, { method: 'POST', body: '{}' });
      result.reload();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusyId('');
    }
  }
  return (
    <>
      <Link className="back" to="/finance">
        <ArrowLeft size={16} />
        Voltar para situação financeira
      </Link>
      <Heading
        eyebrow="FINANCEIRO"
        title={contract.data?.property_title ?? 'Lançamentos do contrato'}
        description="Consulte os pagamentos registrados e os vencimentos desta locação."
      />
      <Alert success>{location.state?.message}</Alert>
      <Alert>{contract.error || result.error || actionError}</Alert>
      {user?.role === 'tenant' && (
        <p className="muted">
          Para marcar uma parcela como paga, selecione um comprovante PDF, JPEG ou PNG no card. O
          botão de envio será habilitado após a seleção. O administrador analisará o pagamento.
        </p>
      )}
      {user?.role === 'admin' && (
        <p className="muted">
          O inquilino {contract.data?.tenant_name ?? 'vinculado'} envia o comprovante. Depois do
          envio, os botões para aprovar ou recusar aparecem no card correspondente.
        </p>
      )}
      {result.loading ? (
        <Loading />
      ) : (
        result.data && (
          <>
            <div className="finance-summary">
              <div>
                <span>Pagamentos realizados</span>
                <strong>{money(result.data.summary.paid)}</strong>
              </div>
              <div>
                <span>Total em aberto</span>
                <strong>{money(result.data.summary.pending)}</strong>
              </div>
              <div>
                <span>Em atraso (incluído em aberto)</span>
                <strong>{money(result.data.summary.overdue)}</strong>
              </div>
            </div>
            <section className="panel">
              <div className="payment-view-head">
                <div>
                  <p className="eyebrow">PARCELAS DO CONTRATO</p>
                  <h2>{view === 'next' ? 'Próximo pagamento' : 'Todos os pagamentos'}</h2>
                  <p className="muted small">
                    {view === 'next'
                      ? 'A primeira parcela que ainda não foi aprovada.'
                      : 'Consulte todas as competências do contrato.'}
                  </p>
                </div>
                <div className="payment-view-switch" role="group" aria-label="Exibir parcelas">
                  <button
                    type="button"
                    aria-pressed={view === 'next'}
                    className={view === 'next' ? 'active' : ''}
                    onClick={() => {
                      setView('next');
                      setPage(1);
                    }}
                  >
                    Próximo
                  </button>
                  <button
                    type="button"
                    aria-pressed={view === 'all'}
                    className={view === 'all' ? 'active' : ''}
                    onClick={() => {
                      setView('all');
                      setPage(1);
                    }}
                  >
                    Todos
                  </button>
                </div>
              </div>
              <div className="filters">
                {view === 'all' && (
                  <select
                    aria-label="Filtrar situação do pagamento"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Todas as situações</option>
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="overdue">Atrasado</option>
                  </select>
                )}
                <Link className="text-link" to={`/contracts/${id}`}>
                  Ver contrato
                </Link>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!!busyId}
                    onClick={() => void generate()}
                  >
                    Gerar parcelas faltantes
                  </button>
                )}
              </div>
              {visiblePayments.length ? (
                <div className={`payment-grid${view === 'next' ? ' payment-grid--next' : ''}`}>
                  {visiblePayments.map((p) => (
                    <article className={`payment-card payment-card--${p.status}`} key={p.id}>
                      <div className="payment-card-top">
                        <span className="payment-card-index">
                          Parcela {installmentNumber(p.competence) ?? '—'} de 12
                        </span>
                        <Badge active={p.status === 'paid'}>{stateLabels[p.status]}</Badge>
                      </div>
                      <div className="payment-card-main">
                        <p className="payment-card-month">
                          {new Date(`${p.competence}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })}
                        </p>
                        <strong className="payment-card-amount">{money(p.amount)}</strong>
                        <p className="payment-card-due">
                          <CalendarDays size={17} /> Vence em {calendarDate(p.due_date)}
                        </p>
                        <p className="payment-card-note">
                          {p.paid_at
                            ? `Pago em ${calendarDate(p.paid_at)}`
                            : 'Pagamento ainda não confirmado.'}
                        </p>
                        <p className="payment-card-review">
                          {p.review_status === 'submitted'
                            ? 'Comprovante enviado — aguardando análise.'
                            : p.review_status === 'rejected'
                              ? 'Pagamento não aprovado. Envie outro comprovante.'
                              : p.review_status === 'approved'
                                ? 'Pagamento aprovado pelo administrador.'
                                : 'Aguardando pagamento.'}
                        </p>
                      </div>
                      {user?.role === 'tenant' && !p.paid_at && p.review_status !== 'submitted' && (
                        <div className="payment-actions">
                          <label>
                            Comprovante (PDF, JPEG ou PNG)
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setProofFiles((old) => ({ ...old, [p.id]: file }));
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="button"
                            disabled={!proofFiles[p.id] || !!busyId}
                            title={
                              !proofFiles[p.id]
                                ? 'Selecione um comprovante para habilitar o envio.'
                                : undefined
                            }
                            onClick={() => void sendProof(p.id)}
                          >
                            Marcar como pago e enviar
                          </button>
                        </div>
                      )}
                      {p.has_proof && user?.role !== 'owner' && (
                        <a className="text-link" href={`/api/payments/${p.id}/proof`} download>
                          Baixar comprovante
                        </a>
                      )}
                      {user?.role === 'admin' && p.review_status === 'submitted' && (
                        <div className="payment-actions">
                          <button
                            type="button"
                            className="button"
                            disabled={!!busyId}
                            onClick={() => void review(p.id, 'approved')}
                          >
                            Aprovar pagamento
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={!!busyId}
                            onClick={() => void review(p.id, 'rejected')}
                          >
                            Não aprovado
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Wallet size={35} />
                  <h3>
                    {view === 'next' && result.data.total
                      ? 'Tudo em dia'
                      : 'Nenhum lançamento encontrado'}
                  </h3>
                  <p>
                    {view === 'next' && result.data.total
                      ? 'Todas as parcelas foram aprovadas. Veja o histórico em Todos.'
                      : 'Não há lançamentos para este contrato com o filtro selecionado.'}
                  </p>
                </div>
              )}
              {view === 'all' && (
                <Pagination page={page} total={result.data.total} onChange={setPage} />
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
export function PaymentForm() {
  const { id, paymentId } = useParams();
  const navigate = useNavigate();
  const payment = useResource<Payment>(paymentId ? `/payments/${paymentId}` : null);
  const contractId = id ?? payment.data?.contract_id;
  const contract = useResource<Contract>(contractId ? `/contracts/${contractId}` : null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const p = payment.data;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      competence: f.get('competence'),
      amount: Number(f.get('amount')),
      due_date: f.get('due_date'),
      paid_at: f.get('paid_at') || null,
    };
    setBusy(true);
    setError('');
    try {
      await api(paymentId ? `/payments/${paymentId}` : `/contracts/${contractId}/payments`, {
        method: paymentId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      navigate(`/contracts/${contractId}/finance`, {
        state: { message: paymentId ? 'Lançamento atualizado.' : 'Lançamento registrado.' },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to={contractId ? `/contracts/${contractId}/finance` : '/finance'}>
        <ArrowLeft size={16} />
        Voltar ao financeiro
      </Link>
      <Heading
        eyebrow="FINANCEIRO"
        title={paymentId ? 'Atualizar lançamento' : 'Novo lançamento'}
        description={
          contract.data?.property_title ??
          'Registre uma parcela e informe a data quando o pagamento ocorrer.'
        }
      />
      <Alert>{error || payment.error || contract.error}</Alert>
      {payment.loading || contract.loading ? (
        <Loading />
      ) : (
        contract.data && (
          <form className="panel form-panel" onSubmit={submit}>
            <p className="muted">
              Vigência: {calendarDate(contract.data.start_date)} a{' '}
              {calendarDate(contract.data.end_date)}. Um lançamento por competência.
            </p>
            <div className="form-grid section-gap">
              <Field label="Competência *" hint="Mês e ano da parcela, dentro da vigência.">
                <input
                  name="competence"
                  type="month"
                  required
                  min={contract.data.start_date.slice(0, 7)}
                  max={contract.data.end_date.slice(0, 7)}
                  defaultValue={p?.competence}
                />
              </Field>
              <Field label="Valor (R$) *">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="9999999999.99"
                  required
                  defaultValue={p?.amount ?? contract.data.monthly_rent}
                />
              </Field>
              <Field label="Vencimento *">
                <input name="due_date" type="date" required defaultValue={p?.due_date} />
              </Field>
              <Field
                label="Data do pagamento"
                hint="Deixe em branco enquanto a parcela estiver em aberto."
              >
                <input name="paid_at" type="date" defaultValue={p?.paid_at ?? ''} />
              </Field>
            </div>
            <p className="small muted">
              Sem data de pagamento, a situação é calculada como Pendente ou Atrasado conforme o
              vencimento, no fuso de Brasília.
            </p>
            <div className="form-actions">
              <Link className="button secondary" to={`/contracts/${contractId}/finance`}>
                Cancelar
              </Link>
              <button className="button" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar lançamento'}
              </button>
            </div>
          </form>
        )
      )}
    </>
  );
}

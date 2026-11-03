import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Alert, Field } from './ui';
export type Option = {
  id: string;
  name: string;
  email?: string;
  owner_id?: string;
  owner_name?: string;
};
export function Lookup({
  label,
  path,
  onSelect,
  value,
  required = true,
  emptyMessage = 'Nenhum registro elegível cadastrado.',
}: {
  label: string;
  path: string;
  onSelect: (option: Option | null) => void;
  value: Option | null;
  required?: boolean;
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState(''),
    [options, setOptions] = useState<Option[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError('');
    setOptions([]);
    const timer = setTimeout(() => {
      api<Option[] | { items: { id: string; title: string }[] }>(
        `${path}${path.includes('?') ? '&' : '?'}search=${encodeURIComponent(search)}`,
        { signal: c.signal },
      )
        .then((result) =>
          setOptions(
            Array.isArray(result) ? result : result.items.map((p) => ({ id: p.id, name: p.title })),
          ),
        )
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setBusy(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [path, search]);
  return (
    <div className="lookup">
      <Field label={`Buscar ${label.toLowerCase()}`}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          placeholder="Digite para filtrar ou escolha abaixo"
        />
      </Field>
      <p className="muted small" role="status">
        {busy
          ? 'Carregando cadastros…'
          : options.length
            ? `${options.length} opção(ões) encontrada(s). Clique para selecionar.`
            : search
              ? 'Nenhum resultado para esta busca.'
              : emptyMessage}
      </p>
      {!busy && !!options.length && (
        <div className="lookup-options" aria-label={`${label} cadastrados`}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`lookup-option${value?.id === option.id ? ' is-selected' : ''}`}
              aria-pressed={value?.id === option.id}
              onClick={() => onSelect(option)}
            >
              <strong>{option.name}</strong>
              {(option.email || option.owner_name) && (
                <small>{option.email || `Proprietário: ${option.owner_name}`}</small>
              )}
            </button>
          ))}
        </div>
      )}
      {value && (
        <p className="lookup-selected">
          {label} selecionado: <strong>{value.name}</strong>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label={`Limpar ${label.toLowerCase()}`}
          >
            Limpar
          </button>
        </p>
      )}
      {required && !value && (
        <p className="muted small">Selecione uma das opções para continuar.</p>
      )}
      <Alert>{error}</Alert>
    </div>
  );
}
export const calendarDate = (value: string) => value.split('T')[0].split('-').reverse().join('/');
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const stateLabels: Record<string, string> = {
  active: 'Ativo',
  closed: 'Encerrado',
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado',
};

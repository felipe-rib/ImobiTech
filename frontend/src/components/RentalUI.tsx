import { useEffect, useId, useState } from 'react';
import { api } from '../services/api';
import { Alert, Field } from './ui';
export type Option = { id: string; name: string; owner_id?: string; owner_name?: string };
export function Lookup({
  label,
  path,
  onSelect,
  value,
  required = true,
}: {
  label: string;
  path: string;
  onSelect: (option: Option | null) => void;
  value: Option | null;
  required?: boolean;
}) {
  const [search, setSearch] = useState(''),
    [options, setOptions] = useState<Option[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError('');
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
          placeholder="Digite parte do nome para pesquisar"
        />
      </Field>
      <label className="field" htmlFor={id}>
        <span>{label} *</span>
        <select
          id={id}
          required={required}
          value={value?.id ?? ''}
          onChange={(e) => onSelect(options.find((o) => o.id === e.target.value) ?? null)}
        >
          <option value="">Selecione</option>
          {value && !options.some((o) => o.id === value.id) && (
            <option value={value.id}>{value.name}</option>
          )}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <small>
          {busy
            ? 'Buscando opções…'
            : options.length
              ? 'Refine a busca se a opção não aparecer.'
              : 'Nenhum registro elegível encontrado.'}
        </small>
      </label>
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

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
export function Alert({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return children ? (
    <div role={success ? 'status' : 'alert'} className={`alert ${success ? 'success' : ''}`}>
      {children}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <span className="spinner" /> Carregando…
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action && (
        <Link className="button" to={action.to}>
          <Plus size={18} />
          {action.label}
        </Link>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} registro{total !== 1 ? 's' : ''} · Página {page} de{' '}
        {Math.max(1, Math.ceil(total / 20))}
      </span>
      <div>
        <button
          className="button secondary icon"
          aria-label="Página anterior"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="button secondary icon"
          aria-label="Próxima página"
          disabled={page * 20 >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function Badge({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`badge ${active ? 'positive' : 'neutral'}`}>
      <span />
      {children}
    </span>
  );
}

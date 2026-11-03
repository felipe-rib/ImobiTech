import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  ArrowUpRight,
  Images,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Alert, Badge, Field, Heading, Loading, Pagination, SearchBox } from '../components/ui';
import { useList } from '../hooks/useList';
import { useAuth } from '../hooks/auth';
import { api, uploadPropertyPhoto } from '../services/api';
import { typeLabels, money, type Property, type PropertyPhoto } from '../types';
const states =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export function Properties() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const location = useLocation();
  const q = new URLSearchParams({
    search,
    page: String(page),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  });
  const { data, loading, error, retry } = useList<Property>(`/properties?${q}`);
  return (
    <>
      <Heading
        eyebrow="PORTFÓLIO"
        title={user!.role === 'owner' ? 'Meus imóveis' : 'Imóveis'}
        description="Consulte os espaços, acompanhe os detalhes e mantenha tudo atualizado."
        action={
          user!.role !== 'owner' ? { to: '/properties/new', label: 'Novo imóvel' } : undefined
        }
      />
      <Alert success>{location.state?.message}</Alert>
      <div className="filters panel">
        <SearchBox
          value={search}
          placeholder="Buscar por título, cidade ou bairro"
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrar tipo"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(typeLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          <option value="available">Disponível</option>
          <option value="unavailable">Indisponível</option>
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
              <div className="property-grid">
                {data.items.map((p) => (
                  <Link className="property-card" key={p.id} to={`/properties/${p.id}`}>
                    <div className="property-illustration">
                      {p.photos?.[0] ? (
                        <img src={p.photos[0].url} alt={`Foto de ${p.title}`} loading="lazy" />
                      ) : (
                        <Building2 size={64} strokeWidth={1} />
                      )}
                      <Badge active={p.status === 'available'}>
                        {p.status === 'available' ? 'Disponível' : 'Indisponível'}
                      </Badge>
                      <span>{typeLabels[p.type]}</span>
                    </div>
                    <div className="property-body">
                      <h2>{p.title}</h2>
                      <p>
                        <MapPin size={15} />
                        {p.neighborhood}, {p.city} · {p.state}
                      </p>
                      <div className="property-price">
                        <div>
                          <small>Valor de locação</small>
                          <strong>
                            {money(p.rent)}
                            {p.rent !== null && <small> / mês</small>}
                          </strong>
                        </div>
                        <ArrowUpRight size={20} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="panel empty">
                <Building2 size={40} />
                <h3>Nenhum imóvel encontrado</h3>
                <p>
                  {user!.role === 'owner'
                    ? 'Não há imóveis vinculados à sua conta com estes filtros.'
                    : 'Cadastre seu primeiro imóvel ou ajuste os filtros da busca.'}
                </p>
              </div>
            )}
            <Pagination page={page} total={data.total} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
function useProperty(id?: string) {
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!id);
  useEffect(() => {
    if (!id) return;
    const c = new AbortController();
    api<Property>(`/properties/${id}`, { signal: c.signal })
      .then(setProperty)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [id]);
  return { property, setProperty, error, loading };
}
export function PropertyDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { property: p, error, loading } = useProperty(id);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const closePhotoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (photoIndex === null) return;
    closePhotoRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoIndex(null);
      if (p?.photos.length && event.key === 'ArrowLeft')
        setPhotoIndex((index) =>
          index === null ? null : (index - 1 + p.photos.length) % p.photos.length,
        );
      if (p?.photos.length && event.key === 'ArrowRight')
        setPhotoIndex((index) => (index === null ? null : (index + 1) % p.photos.length));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoIndex, p?.photos]);
  return (
    <>
      <Link className="back" to="/properties">
        <ArrowLeft size={16} />
        Voltar para imóveis
      </Link>
      <Alert>{error}</Alert>
      <Alert success={!location.state?.photoError}>{location.state?.message}</Alert>
      {loading ? (
        <Loading />
      ) : (
        p && (
          <>
            <Heading
              eyebrow={typeLabels[p.type]}
              title={p.title}
              description={`${p.neighborhood}, ${p.city} · ${p.state}`}
              action={
                user!.role !== 'owner'
                  ? { to: `/properties/${id}/edit`, label: 'Editar imóvel' }
                  : undefined
              }
            />
            <section className="detail-hero">
              {p.photos?.[0] ? (
                <button
                  type="button"
                  className="detail-cover-button"
                  onClick={() => setPhotoIndex(0)}
                  aria-label="Ampliar foto principal do imóvel"
                >
                  <img
                    className="detail-cover"
                    src={p.photos[0].url}
                    alt={`Foto principal de ${p.title}`}
                  />
                  <span>Ampliar foto</span>
                </button>
              ) : (
                <div className="detail-no-photo">
                  <Building2 size={54} strokeWidth={1} />
                  <span>Sem fotos cadastradas</span>
                </div>
              )}
              <div>
                <Badge active={p.status === 'available'}>
                  {p.status === 'available' ? 'Disponível' : 'Indisponível'}
                </Badge>
                <p>Valor de locação</p>
                <h2>
                  {money(p.rent)}
                  {p.rent !== null && <small> / mês</small>}
                </h2>
              </div>
            </section>
            {!!p.photos?.length && (
              <section className="property-gallery" aria-label="Fotos do imóvel">
                {p.photos.map((photo, index) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setPhotoIndex(index)}
                    aria-label={`Ampliar foto ${index + 1} do imóvel`}
                  >
                    <img src={photo.url} alt={`${p.title}, foto ${index + 1}`} loading="lazy" />
                  </button>
                ))}
              </section>
            )}
            {photoIndex !== null && p.photos[photoIndex] && (
              <div
                className="property-lightbox"
                role="presentation"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setPhotoIndex(null);
                }}
              >
                <div
                  className="property-lightbox-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Foto ${photoIndex + 1} de ${p.photos.length} de ${p.title}`}
                >
                  <button
                    ref={closePhotoRef}
                    type="button"
                    className="property-lightbox-close"
                    onClick={() => setPhotoIndex(null)}
                    aria-label="Fechar foto ampliada"
                  >
                    <X size={23} />
                  </button>
                  {p.photos.length > 1 && (
                    <button
                      type="button"
                      className="property-lightbox-nav"
                      onClick={() =>
                        setPhotoIndex((photoIndex - 1 + p.photos.length) % p.photos.length)
                      }
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft size={27} />
                    </button>
                  )}
                  <img
                    src={p.photos[photoIndex].url}
                    alt={`${p.title}, foto ${photoIndex + 1} ampliada`}
                  />
                  {p.photos.length > 1 && (
                    <button
                      type="button"
                      className="property-lightbox-nav"
                      onClick={() => setPhotoIndex((photoIndex + 1) % p.photos.length)}
                      aria-label="Próxima foto"
                    >
                      <ChevronRight size={27} />
                    </button>
                  )}
                  <span className="property-lightbox-counter">
                    {photoIndex + 1} / {p.photos.length}
                  </span>
                </div>
              </div>
            )}
            <section className="panel detail-panel">
              <h2>Sobre o imóvel</h2>
              <p className="description">{p.description || 'Descrição não informada.'}</p>
              <h2>Endereço</h2>
              <p>
                {p.street}, {p.number}
                {p.complement ? ` · ${p.complement}` : ''}
              </p>
              <p>
                {p.neighborhood} · {p.city} / {p.state}
              </p>
              <p>CEP {p.postal_code.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
              <div className="detail-meta">
                <p>Cadastro: {new Date(p.created_at).toLocaleString('pt-BR')}</p>
                <p>Última atualização: {new Date(p.updated_at).toLocaleString('pt-BR')}</p>
                <p className="small">Identificador: {p.id}</p>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
export function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { property: p, error: loadError, loading } = useProperty(id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [owner, setOwner] = useState('');
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerError, setOwnerError] = useState('');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PropertyPhoto[]>([]);
  const [photoNotice, setPhotoNotice] = useState('');
  useEffect(() => {
    if (p) {
      setOwner(p.owner_id);
      setExistingPhotos(p.photos ?? []);
    }
  }, [p]);
  useEffect(() => {
    const c = new AbortController();
    setOwnerLoading(true);
    setOwnerError('');
    api<{ id: string; name: string }[]>('/properties/owners', { signal: c.signal })
        .then(setOwners)
        .catch((e) => {
          if (!c.signal.aborted) setOwnerError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setOwnerLoading(false);
        });
    return () => {
      c.abort();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form);
    body.owner_id = owner;
    body.rent = body.rent === '' ? null : Number(body.rent);
    if (id && owner === p?.owner_id) delete body.owner_id;
    setBusy(true);
    setError('');
    try {
      const saved = await api<Property>(id ? `/properties/${id}` : '/properties', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      let failed = 0;
      for (const photo of newPhotos) {
        try {
          await uploadPropertyPhoto(saved.id, photo);
        } catch {
          failed++;
        }
      }
      navigate(`/properties/${saved.id}`, {
        state: {
          message: failed
            ? `Imóvel salvo, mas ${failed} foto(s) não foram enviadas. Edite o imóvel para tentar novamente.`
            : id
              ? 'Imóvel atualizado.'
              : 'Imóvel cadastrado.',
          photoError: failed > 0,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto(photoId: string) {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await api<void>(`/properties/${id}/photos/${photoId}`, { method: 'DELETE', body: '{}' });
      setExistingPhotos((photos) => photos.filter((photo) => photo.id !== photoId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    setPhotoNotice('');
    if (files.length + existingPhotos.length > 10) {
      setError('Selecione no máximo 10 fotos por imóvel.');
      setNewPhotos([]);
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('Cada foto deve ter até 5 MB.');
      setNewPhotos([]);
      return;
    }
    if (!id) {
      setNewPhotos(files);
      setPhotoNotice('Fotos selecionadas. Salve o imóvel para enviá-las.');
      return;
    }
    setBusy(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        try {
          const photo = await uploadPropertyPhoto(id, file);
          setExistingPhotos((photos) => [...photos, photo]);
          uploaded++;
        } catch (error) {
          setError((error as Error).message);
        }
      }
      if (uploaded) setPhotoNotice(`${uploaded} foto(s) enviada(s) e salva(s) imediatamente.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" to="/properties">
        <ArrowLeft size={16} />
        Voltar para imóveis
      </Link>
      <Heading
        eyebrow="PORTFÓLIO"
        title={id ? 'Editar imóvel' : 'Novo imóvel'}
        description="Um cadastro completo facilita a gestão do seu portfólio."
      />
      <Alert>{loadError || error}</Alert>
      <Alert success>{photoNotice}</Alert>
      {loading ? (
        <Loading />
      ) : (
        (!id || p) && (
          <form className="panel form-panel" onSubmit={submit}>
            <h2>Informações do imóvel</h2>
            <div className="form-grid">
              <Field label="Título *">
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                  defaultValue={p?.title}
                />
              </Field>
              <Field label="Tipo *">
                <select name="type" defaultValue={p?.type ?? 'apartment'}>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor mensal de locação (R$)">
                <input
                  name="rent"
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  defaultValue={p?.rent ?? ''}
                />
              </Field>
              {id ? (
                <Field label="Situação *">
                  <select name="status" defaultValue={p?.status}>
                    <option value="available">Disponível</option>
                    <option value="unavailable">Indisponível</option>
                  </select>
                </Field>
              ) : (
                <div className="field">
                  <span>Situação inicial</span>
                  <Badge active>Disponível</Badge>
                </div>
              )}
            </div>
            <Field label="Descrição">
              <textarea
                name="description"
                rows={4}
                maxLength={3000}
                defaultValue={p?.description ?? ''}
              />
            </Field>
            <h2>Endereço</h2>
            <div className="form-grid">
              <Field label="Logradouro *">
                <input
                  name="street"
                  required
                  minLength={2}
                  maxLength={180}
                  defaultValue={p?.street}
                />
              </Field>
              <Field label="Número *">
                <input name="number" required maxLength={20} defaultValue={p?.number} />
              </Field>
              <Field label="Complemento">
                <input name="complement" maxLength={100} defaultValue={p?.complement ?? ''} />
              </Field>
              <Field label="Bairro *">
                <input
                  name="neighborhood"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={p?.neighborhood}
                />
              </Field>
              <Field label="Cidade *">
                <input name="city" required minLength={2} maxLength={100} defaultValue={p?.city} />
              </Field>
              <Field label="Estado *">
                <select name="state" defaultValue={p?.state ?? 'DF'}>
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="CEP *" hint="Oito dígitos, sem hífen.">
                <input
                  name="postal_code"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  defaultValue={p?.postal_code}
                />
              </Field>
            </div>
            <h2>Proprietário</h2>
            <p className="muted small">Vincule um proprietário ativo já cadastrado.</p>
            <div className="form-grid">
              <Field label="Proprietário vinculado *">
                <select required value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Selecione um proprietário</option>
                  {owner && !owners.some((o) => o.id === owner) && (
                    <option value={owner}>Proprietário selecionado ({owner.slice(0, 8)})</option>
                  )}
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {ownerLoading && (
              <p role="status" className="small muted">
                Buscando proprietários…
              </p>
            )}
            <Alert>{ownerError}</Alert>
            {!ownerLoading && !ownerError && !owners.length && (
              <p className="muted">
                Nenhum proprietário ativo encontrado. Solicite o cadastro ao administrador.
              </p>
            )}
            <h2>Fotos do imóvel</h2>
            <p className="muted small">
              Até 10 fotos JPEG, PNG ou WebP, com no máximo 5 MB cada. A primeira foto aparece na
              listagem.
            </p>
            {!!existingPhotos.length && (
              <div className="photo-editor" aria-label="Fotos já salvas">
                {existingPhotos.map((photo, index) => (
                  <div className="photo-editor-item" key={photo.id}>
                    <img src={photo.url} alt={`Foto salva ${index + 1}`} />
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => removePhoto(photo.id)}
                      aria-label={`Remover foto ${index + 1}`}
                    >
                      <Trash2 size={16} /> Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="photo-picker">
              <Images size={22} />
              <span>
                {busy
                  ? 'Enviando fotos…'
                  : id
                    ? 'Clique para enviar fotos agora'
                    : 'Clique para selecionar fotos'}
              </span>
              <input
                type="file"
                aria-label="Selecionar fotos do imóvel"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy || existingPhotos.length >= 10}
                onChange={choosePhotos}
              />
            </label>
            {!!newPhotos.length && (
              <p className="muted small">
                {newPhotos.length} foto(s) selecionada(s):{' '}
                {newPhotos.map((file) => file.name).join(', ')}
              </p>
            )}
            <div className="form-actions">
              <Link className="button secondary" to="/properties">
                Cancelar
              </Link>
              <button className="button" disabled={busy || !owner}>
                {busy ? 'Salvando…' : 'Salvar imóvel'}
              </button>
            </div>
          </form>
        )
      )}
    </>
  );
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me')
      window.dispatchEvent(new Event('session-expired'));
    const labels: Record<string, string> = {
      name: 'Nome',
      email: 'E-mail',
      password: 'Senha',
      role: 'Perfil',
      title: 'Título',
      type: 'Tipo',
      street: 'Logradouro',
      number: 'Número',
      neighborhood: 'Bairro',
      city: 'Cidade',
      state: 'Estado',
      postal_code: 'CEP',
      owner_id: 'Proprietário',
      property_id: 'Imóvel',
      tenant_id: 'Inquilino',
      start_date: 'Início da vigência',
      end_date: 'Término da vigência',
      monthly_rent: 'Valor mensal',
      due_day: 'Dia de vencimento',
      competence: 'Competência',
      amount: 'Valor',
      due_date: 'Vencimento',
      paid_at: 'Data do pagamento',
      participant_name: 'Participante',
      starts_at: 'Início da visita',
      ends_at: 'Término da visita',
    };
    const fields = Array.isArray(body.fields)
      ? body.fields
          .map(
            (f: { field: string; message: string }) =>
              `${labels[f.field] ?? 'Dados do formulário'}: ${f.message}`,
          )
          .join(' ')
      : '';
    throw new ApiError(
      response.status,
      `${body.message || 'Não foi possível conectar ao servidor.'}${fields ? ` ${fields}` : ''}`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function uploadPropertyPhoto(propertyId: string, file: File) {
  const response = await fetch(`/api/properties/${propertyId}/photos`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message || 'Não foi possível enviar a foto.');
  }
  return response.json();
}
export async function uploadDocument(path: string, file: File) {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message || 'Não foi possível enviar o documento.');
  }
  return response.json();
}

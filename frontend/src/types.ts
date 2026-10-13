export type Role = 'admin' | 'broker' | 'owner' | 'tenant';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  identifier?: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface Property {
  id: string;
  title: string;
  type: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  description: string | null;
  rent: string | null;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
}
export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  broker: 'Corretor',
  owner: 'Proprietário',
  tenant: 'Inquilino',
};
export const typeLabels: Record<string, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  commercial: 'Comercial',
  land: 'Terreno',
};
export const money = (v: string | null) =>
  v === null
    ? 'Não informado'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

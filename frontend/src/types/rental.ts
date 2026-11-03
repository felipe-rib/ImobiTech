export interface Contract {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  property_title: string;
  owner_name: string;
  tenant_name: string;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  has_document?: boolean;
  due_day: number;
  status: 'active' | 'closed';
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface Payment {
  id: string;
  contract_id: string;
  competence: string;
  amount: string;
  due_date: string;
  paid_at: string | null;
  review_status: 'none' | 'submitted' | 'approved' | 'rejected';
  has_proof: boolean;
  submitted_at: string | null;
  status: 'paid' | 'pending' | 'overdue';
  created_at: string;
  updated_at: string;
}
export interface Visit {
  id: string;
  property_id: string;
  broker_id: string;
  property_title: string;
  broker_name: string;
  participant_name: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'confirmed' | 'cancelled';
}
export interface PaymentPage {
  items: Payment[];
  total: number;
  page: number;
  summary: { paid: string; pending: string; overdue: string };
}
export interface Audit {
  id: string;
  entity_type: string;
  action: string;
  occurred_at: string;
  actor_name: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
}

export type AuditActor = {
  id: number;
  email: string;
  name: string;
};

export type AuditTenant = {
  id: number;
  name: string;
  slug: string;
};

export type AuditRow = {
  id: number | null;
  synthesized?: boolean;
  tenant_id?: number | null;
  tenant?: AuditTenant | null;
  actor_user_id?: number | null;
  actor?: AuditActor | null;
  action: string;
  auditable_type?: string | null;
  auditable_id?: number | null;
  properties?: Record<string, unknown> | unknown[] | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
};

export type ActivityStats = {
  total: number;
  today: number;
  unique_actors: number;
};

export type LoginStats = {
  total: number;
  today: number;
  unique_users: number;
};

export type LogStats = {
  total: number;
  today: number;
  actions: { action: string; count: number }[];
};

export type AuditFilters = {
  search: string;
  tenant_id: string;
  from: string;
  to: string;
  limit: string;
};

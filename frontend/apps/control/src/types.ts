export type PlanSummary = {
  id?: number;
  code: string;
  name_en: string;
  name_ar?: string;
  price?: string | number;
  currency?: string;
  max_schools?: number;
  max_campuses?: number;
  max_students?: number;
  max_teachers?: number;
  max_storage_mb?: number;
  modules?: Record<string, boolean> | null;
  modules_json?: Record<string, boolean> | null;
};

export type TenantSubscription = {
  id: number;
  status: string;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  plan: {
    code?: string;
    name_en?: string;
    name_ar?: string;
    price?: string | number;
    currency?: string;
    limits?: {
      max_schools?: number;
      max_campuses?: number;
      max_students?: number;
      max_teachers?: number;
      max_storage_mb?: number;
    };
    modules?: Record<string, boolean> | null;
  } | null;
};

export type TenantRow = {
  id: number;
  slug: string;
  name: string;
  legal_name?: string | null;
  status: string;
  default_locale?: string;
  default_timezone?: string;
  trial_ends_at?: string | null;
  schools_count?: number;
  subscription?: TenantSubscription | null;
};

export type BillingContact = {
  user_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SchoolRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar?: string;
  status: string;
  timezone?: string;
};

export type Branding = {
  logo_path?: string | null;
  favicon_path?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  email_footer_en?: string | null;
  email_footer_ar?: string | null;
};

export type InvoiceRow = {
  id: number;
  number: string;
  currency: string;
  subtotal?: string | number;
  tax_total?: string | number;
  total: string | number;
  status: string;
  due_at?: string | null;
  issued_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
};

export type SuperAdminDashboardData = {
  role: 'super_admin';
  stats: {
    total_tenants: number;
    active: number;
    trial: number;
    suspended: number;
    closed: number;
  };
  plan_health: { plan_code: string; plan_name: string; active_subscriptions: number }[];
  plans: PlanSummary[];
  recent_tenants: TenantRow[];
  trials_ending_soon: { id: number; name: string; slug: string; trial_ends_at: string; status: string }[];
};

export type OwnerDashboardData = {
  role: 'school_owner';
  tenant: TenantRow;
  schools: SchoolRow[];
  branding: Branding | null;
  billing_contact: BillingContact;
  invoices: InvoiceRow[];
  usage: { schools: number; students: number };
};

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

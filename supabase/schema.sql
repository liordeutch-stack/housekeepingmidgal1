-- =============================================
-- MGDAL 1 TEL AVIV - Property Management Schema
-- הדבק את כל הקוד הזה ב: Supabase → SQL Editor → Run
-- =============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =============================================
-- USERS & ROLES
-- =============================================
create type user_role as enum ('admin', 'committee', 'manager', 'resident', 'readonly');

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role user_role not null default 'readonly',
  apartment_id text,  -- רק לדיירים: '1','2',...,'9','מסחר'
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- APARTMENTS
-- =============================================
create table apartments (
  id text primary key,  -- '1','2',...,'9','מסחר'
  sqm numeric(6,2) not null,
  parking_spots integer not null default 0,
  floor integer,
  owner_name text,
  owner_phone text,
  owner_email text,
  notes text,
  created_at timestamptz default now()
);

-- Insert the 10 units from the Excel file
insert into apartments (id, sqm, parking_spots, floor, owner_name) values
  ('1',   147.1, 1, 1,  ''),
  ('2',   72.2,  1, 1,  ''),
  ('3',   74.7,  1, 2,  ''),
  ('4',   76.5,  1, 2,  ''),
  ('5',   71.1,  1, 3,  ''),
  ('6',   68.2,  1, 3,  ''),
  ('7',   102.1, 1, 4,  ''),
  ('8',   130.1, 1, 4,  ''),
  ('9',   221.0, 2, 5,  ''),
  ('מסחר',123.3, 0, 0,  '');

-- =============================================
-- PAYMENTS (ועד בית)
-- =============================================
create type payment_method as enum ('bank','bit','check','cash','wire','cc');
create type payment_status as enum ('pending','confirmed','cancelled','bounced');

create table payments (
  id uuid default uuid_generate_v4() primary key,
  apartment_id text references apartments(id) not null,
  month text not null,           -- '2025-09'
  amount numeric(10,2) not null,
  vaad_amount numeric(10,2) not null,
  parking_amount numeric(10,2) not null default 0,
  method payment_method,
  status payment_status not null default 'pending',
  reference text,                -- אסמכתא
  bank_name text,
  check_number text,
  check_date date,
  last4 text,                    -- כרטיס אשראי
  paid_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(apartment_id, month)
);

-- =============================================
-- SUPPLIERS (ספקים)
-- =============================================
create table suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Insert default suppliers from the contract
insert into suppliers (name, category, phone) values
  ('ניקי ניקיון', 'ניקיון', ''),
  ('אלקטרה מעליות', 'מעלית', '03-5050500'),
  ('גנרטורים כרמי', 'גנרטור', ''),
  ('פרקומט חניון', 'חניון', '');

-- =============================================
-- INVOICES (חשבוניות)
-- =============================================
create type invoice_status as enum ('pending','paid','disputed','cancelled');

create table invoices (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references suppliers(id) not null,
  description text not null,
  amount numeric(10,2) not null,
  invoice_date date not null,
  due_date date,
  status invoice_status not null default 'pending',
  invoice_number text,
  notes text,
  paid_date date,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- ISSUES (תקלות)
-- =============================================
create type issue_priority as enum ('low','medium','high','urgent');
create type issue_status as enum ('open','inprogress','waiting','done','cancelled');

create table issues (
  id uuid default uuid_generate_v4() primary key,
  apartment_id text,             -- null = שטח משותף
  title text not null,
  description text,
  category text not null,
  priority issue_priority not null default 'medium',
  status issue_status not null default 'open',
  supplier_id uuid references suppliers(id),
  reported_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  opened_at timestamptz default now(),
  resolved_at timestamptz,
  sla_hours integer,             -- SLA: 4 שעות לדחוף לפי החוזה
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- BUDGET ITEMS (תקציב)
-- =============================================
create table budget_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  monthly_amount numeric(10,2) not null,
  notes text,
  category text,
  is_fixed boolean default true,  -- קבוע vs משתנה
  sort_order integer default 0
);

-- Insert budget from Excel
insert into budget_items (name, monthly_amount, notes, sort_order) values
  ('ניקיון', 1129, 'כמפורט בהצעה', 1),
  ('ביטוח רכוש + חניון', 3000, 'הערכה — ממתינים להצעות', 2),
  ('גנרטור', 321, '₪3,853/שנה — תשלום ספטמבר', 3),
  ('תדלוק גנרטור', 50, 'משוער', 4),
  ('מעלית', 437, '6 חודשים ראשונים חינם', 5),
  ('קו קל מעלית + כיבוי אש', 140, 'כולל חניון', 6),
  ('בודק מוסמך מעלית', 50, 'משוער', 7),
  ('חשמל', 1500, 'מעלית + חניון + לובי', 8),
  ('אינטרקום + מצלמות', 70, '2 קריאות שירות', 9),
  ('מערכת סולארית', 50, 'קולטים על הגג', 10),
  ('ספרינקלרים', 160, 'חניון + ממ"ד + גז', 11),
  ('אינסטלציה', 70, '2 קריאות שירות', 12),
  ('משאבות טבולות', 70, 'ביוב + משאבות', 13),
  ('מז"ח', 40, 'משוער', 14),
  ('הדברה', 50, 'משוער', 15),
  ('עמלות בנקים', 15, 'משוער', 16),
  ('אב בית', 1180, 'כמפורט בהצעה', 17),
  ('דמי ניהול', 1416, 'כמפורט בהצעה', 18),
  ('ניהול חשבון בנק', 236, 'כמפורט בהצעה', 19),
  ('ניקיון חלונות סנפלינג', 500, 'פעמיים בשנה', 20),
  ('נורות / חומרי אחזקה', 150, 'משוער', 21),
  ('מתקן ריח ללובי', 180, 'משוער', 22),
  ('ב.צ.מ', 100, 'משוער', 23);

-- =============================================
-- NOTIFICATIONS LOG
-- =============================================
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  type text not null,            -- 'payment_reminder','issue_update','invoice_due'
  recipient_id uuid references profiles(id),
  apartment_id text,
  message text not null,
  sent_via text,                 -- 'whatsapp','sms','email'
  sent_at timestamptz default now(),
  read_at timestamptz
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
alter table profiles    enable row level security;
alter table apartments  enable row level security;
alter table payments    enable row level security;
alter table suppliers   enable row level security;
alter table invoices    enable row level security;
alter table issues      enable row level security;
alter table budget_items enable row level security;
alter table notifications enable row level security;

-- Helper function: get current user role
create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: get current user apartment
create or replace function get_my_apartment()
returns text as $$
  select apartment_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- PROFILES
create policy "profiles_select" on profiles for select using (
  id = auth.uid() or get_my_role() in ('admin','committee','manager')
);
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (
  id = auth.uid() or get_my_role() = 'admin'
);

-- APARTMENTS: all can view, only admin/committee can edit
create policy "apartments_select" on apartments for select using (true);
create policy "apartments_update" on apartments for update using (
  get_my_role() in ('admin','committee')
);

-- PAYMENTS: residents see only their apt, others see all (with role check)
create policy "payments_select" on payments for select using (
  get_my_role() in ('admin','committee') or
  (get_my_role() = 'resident' and apartment_id = get_my_apartment())
);
create policy "payments_insert" on payments for insert with check (
  get_my_role() in ('admin','committee') or
  (get_my_role() = 'resident' and apartment_id = get_my_apartment())
);
create policy "payments_update" on payments for update using (
  get_my_role() in ('admin','committee') or
  (get_my_role() = 'resident' and apartment_id = get_my_apartment())
);

-- SUPPLIERS: manager/admin/committee can manage
create policy "suppliers_select" on suppliers for select using (
  get_my_role() in ('admin','committee','manager')
);
create policy "suppliers_insert" on suppliers for insert with check (
  get_my_role() in ('admin','committee','manager')
);
create policy "suppliers_update" on suppliers for update using (
  get_my_role() in ('admin','committee','manager')
);
create policy "suppliers_delete" on suppliers for delete using (
  get_my_role() in ('admin','committee')
);

-- INVOICES: same as suppliers
create policy "invoices_select" on invoices for select using (
  get_my_role() in ('admin','committee','manager')
);
create policy "invoices_insert" on invoices for insert with check (
  get_my_role() in ('admin','committee','manager')
);
create policy "invoices_update" on invoices for update using (
  get_my_role() in ('admin','committee','manager')
);

-- ISSUES: residents see their apt issues + common, others see all
create policy "issues_select" on issues for select using (
  get_my_role() in ('admin','committee','manager') or
  get_my_role() = 'readonly' or
  (get_my_role() = 'resident' and (apartment_id = get_my_apartment() or apartment_id is null))
);
create policy "issues_insert" on issues for insert with check (
  get_my_role() in ('admin','committee','manager') or
  (get_my_role() = 'resident' and (apartment_id = get_my_apartment() or apartment_id is null))
);
create policy "issues_update" on issues for update using (
  get_my_role() in ('admin','committee','manager')
);

-- BUDGET: readonly+ can view, only admin/committee can edit
create policy "budget_select" on budget_items for select using (
  get_my_role() in ('admin','committee','manager','readonly')
);
create policy "budget_update" on budget_items for update using (
  get_my_role() in ('admin','committee')
);

-- NOTIFICATIONS: own only
create policy "notifications_select" on notifications for select using (
  recipient_id = auth.uid() or get_my_role() in ('admin','committee')
);

-- =============================================
-- AUTO-UPDATE updated_at
-- =============================================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_profiles_updated    before update on profiles    for each row execute function update_updated_at();
create trigger trg_payments_updated    before update on payments    for each row execute function update_updated_at();
create trigger trg_invoices_updated    before update on invoices    for each row execute function update_updated_at();
create trigger trg_issues_updated      before update on issues      for each row execute function update_updated_at();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'readonly')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

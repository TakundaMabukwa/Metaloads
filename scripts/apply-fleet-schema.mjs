import dotenv from "dotenv"
import { Client } from "pg"

dotenv.config({ path: ".env.local" })
dotenv.config()

function sanitizeConnectionString(value) {
  if (!value) return value
  return value.startsWith("DATABASE_URL=") ? value.slice("DATABASE_URL=".length) : value
}

function requireConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
      source: "DATABASE_URL",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (process.env.SUPABASE_DB_URL) {
    return {
      connectionString: sanitizeConnectionString(process.env.SUPABASE_DB_URL),
      source: "SUPABASE_DB_URL",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    const host = process.env.SUPABASE_DB_HOST || `db.${projectRef}.supabase.co`
    const port = Number(process.env.SUPABASE_DB_PORT || 5432)
    const database = process.env.SUPABASE_DB_NAME || "postgres"
    const user = process.env.SUPABASE_DB_USER || "postgres"

    return {
      connectionString: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
        process.env.SUPABASE_DB_PASSWORD
      )}@${host}:${port}/${database}`,
      source: "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (
    process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGPASSWORD &&
    process.env.PGDATABASE
  ) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      source: "PGHOST/PGUSER/PGPASSWORD/PGDATABASE",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  throw new Error(
    [
      "Missing database connection.",
      "Your Supabase URL and service-role key are not enough for Postgres schema creation with the pg driver.",
      "Set one of these in .env.local:",
      "- SUPABASE_DB_PASSWORD=...  (recommended if NEXT_PUBLIC_SUPABASE_URL is already set)",
      "- optional with that: SUPABASE_DB_HOST / SUPABASE_DB_PORT / SUPABASE_DB_NAME / SUPABASE_DB_USER",
      "- DATABASE_URL=postgresql://...",
      "- SUPABASE_DB_URL=postgresql://...",
      "- or PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE",
      "You can get the connection string from Supabase: Project Settings > Database > Connection string.",
    ].join("\\n")
  )
}

const schemaSql = `
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'dispatcher', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'driver_state') then
    create type public.driver_state as enum ('active', 'off', 'inactive', 'on_leave', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'warning_level') then
    create type public.warning_level as enum ('normal', 'warning', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'allocation_status') then
    create type public.allocation_status as enum ('pending', 'active', 'locked', 'ended', 'cancelled', 'auto_reassigned');
  end if;
  if not exists (select 1 from pg_type where typname = 'allocation_type') then
    create type public.allocation_type as enum ('manual', 'automatic', 'replacement');
  end if;
  if not exists (select 1 from pg_type where typname = 'leave_status') then
    create type public.leave_status as enum ('scheduled', 'active', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'roster_match_status') then
    create type public.roster_match_status as enum ('matched', 'unmatched', 'ambiguous', 'invalid');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_entity') then
    create type public.audit_entity as enum ('driver', 'vehicle', 'allocation', 'leave', 'roster_import', 'user', 'cron_job');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$fn$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  linked_driver_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  employee_number text,
  display_name text,
  first_name text not null default '',
  surname text not null default '',
  driver_code text not null,
  status text not null default 'OFF',
  available boolean not null default true,
  cell_number text,
  email_address text,
  license_number text,
  license_expiry_date date,
  pdp_expiry_date date,
  training_last_done text,
  passport_expiry date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vehiclesc (
  id uuid primary key default gen_random_uuid(),
  registration_number text,
  vehicle_number text,
  display_label text,
  make text,
  model text,
  vehicle_type text,
  vin_number text,
  trailer_1_registration text,
  trailer_2_registration text,
  dekra_service_status text,
  vehicle_priority integer,
  driver_name text,
  driver_code text,
  driver_id uuid,
  veh_allocated_flag boolean not null default false,
  license_expiry_date date,
  status text not null default 'active',
  branch_name text,
  veh_location text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete restrict,
  vehicle_id uuid not null references public.vehiclesc(id) on delete restrict,
  status public.allocation_status not null default 'active',
  allocation_type public.allocation_type not null default 'manual',
  effective_from date not null default current_date,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  ended_reason text,
  notes text,
  replacement_of_allocation_id uuid references public.allocations(id) on delete set null,
  locked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint allocations_dates_check check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.driver_leave (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  leave_start date not null,
  leave_end date not null,
  status public.leave_status not null default 'scheduled',
  reason text,
  notes text,
  approved_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint driver_leave_dates_check check (leave_end >= leave_start)
);

alter table public.drivers
  add column if not exists employee_number text,
  add column if not exists display_name text,
  add column if not exists current_state public.driver_state not null default 'off',
  add column if not exists state_started_on date not null default current_date,
  add column if not exists last_status_change_at timestamptz not null default timezone('utc', now()),
  add column if not exists current_state_days integer not null default 0,
  add column if not exists warning_level public.warning_level not null default 'normal',
  add column if not exists current_leave_id uuid,
  add column if not exists current_allocation_id uuid,
  add column if not exists current_vehicle_id uuid,
  add column if not exists is_allocatable boolean not null default true,
  add column if not exists roster_status text not null default 'unknown',
  add column if not exists current_roster_period_end date,
  add column if not exists training_last_done text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.vehiclesc
  add column if not exists current_allocation_id uuid,
  add column if not exists current_driver_id uuid,
  add column if not exists current_driver_code text,
  add column if not exists current_allocation_status public.allocation_status,
  add column if not exists allocation_locked boolean not null default false,
  add column if not exists needs_allocation boolean not null default false,
  add column if not exists display_label text,
  add column if not exists vin_number text,
  add column if not exists trailer_1_registration text,
  add column if not exists trailer_2_registration text,
  add column if not exists dekra_service_status text,
  add column if not exists last_allocation_change_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());
`

const schemaSqlPart2 = `
create table if not exists public.allocation_history (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations(id) on delete cascade,
  event_type text not null,
  from_driver_id uuid references public.drivers(id) on delete set null,
  to_driver_id uuid references public.drivers(id) on delete set null,
  from_vehicle_id uuid references public.vehiclesc(id) on delete set null,
  to_vehicle_id uuid references public.vehiclesc(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_state_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  state public.driver_state not null,
  effective_from date not null,
  effective_to date,
  source text not null,
  reason_code text,
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint driver_state_history_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.employee_roster_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text,
  status text not null default 'uploaded',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  unmatched_rows integer not null default 0,
  ambiguous_rows integer not null default 0,
  error_rows integer not null default 0,
  imported_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.employee_roster_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.employee_roster_imports(id) on delete cascade,
  row_number integer not null,
  employee_number text,
  first_name text,
  last_name text,
  period_start date,
  period_end date,
  matched_driver_id uuid references public.drivers(id) on delete set null,
  match_status public.roster_match_status not null default 'invalid',
  errors jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (import_id, row_number)
);

create table if not exists public.driver_roster_periods (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  employee_number text not null,
  period_start date not null,
  period_end date not null,
  source_import_id uuid not null references public.employee_roster_imports(id) on delete restrict,
  source_row_id uuid references public.employee_roster_import_rows(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint driver_roster_periods_dates_check check (period_end >= period_start)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type public.audit_entity not null,
  entity_id uuid,
  action text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cron_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  triggered_by text not null default 'system',
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.vehicle_rotation_plan_items (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  source_sheet text not null default 'Truck',
  vehicle_id uuid references public.vehiclesc(id) on delete set null,
  vehicle_label text not null,
  current_driver_id uuid references public.drivers(id) on delete set null,
  current_driver_label text,
  next_driver_id uuid references public.drivers(id) on delete set null,
  next_driver_label text not null,
  cycle_start_date date,
  proposed_change_date date,
  days_on integer,
  status text not null default 'planned' check (status in ('planned', 'ready', 'completed', 'skipped', 'cancelled')),
  notes text,
  import_batch_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.users drop constraint if exists users_linked_driver_id_fkey;
alter table public.users add constraint users_linked_driver_id_fkey foreign key (linked_driver_id) references public.drivers(id) on delete set null;
alter table public.drivers drop constraint if exists drivers_current_leave_fk;
alter table public.drivers add constraint drivers_current_leave_fk foreign key (current_leave_id) references public.driver_leave(id) on delete set null;
alter table public.drivers drop constraint if exists drivers_current_allocation_fk;
alter table public.drivers add constraint drivers_current_allocation_fk foreign key (current_allocation_id) references public.allocations(id) on delete set null;
alter table public.drivers drop constraint if exists drivers_current_vehicle_fk;
alter table public.drivers add constraint drivers_current_vehicle_fk foreign key (current_vehicle_id) references public.vehiclesc(id) on delete set null;
alter table public.vehiclesc drop constraint if exists vehiclesc_current_allocation_fk;
alter table public.vehiclesc add constraint vehiclesc_current_allocation_fk foreign key (current_allocation_id) references public.allocations(id) on delete set null;
alter table public.vehiclesc drop constraint if exists vehiclesc_current_driver_fk;
alter table public.vehiclesc add constraint vehiclesc_current_driver_fk foreign key (current_driver_id) references public.drivers(id) on delete set null;
alter table public.driver_leave drop constraint if exists driver_leave_no_overlap;
alter table public.driver_leave add constraint driver_leave_no_overlap exclude using gist (driver_id with =, daterange(leave_start, leave_end, '[]') with &&) where (status in ('scheduled', 'active'));
`

const schemaSqlPart3 = `
create unique index if not exists drivers_driver_code_uidx on public.drivers (lower(driver_code));
create unique index if not exists drivers_employee_number_uidx on public.drivers (lower(employee_number)) where employee_number is not null;
create unique index if not exists vehiclesc_vehicle_number_uidx on public.vehiclesc (lower(vehicle_number));
create unique index if not exists vehiclesc_registration_number_uidx on public.vehiclesc (lower(registration_number));
create unique index if not exists allocations_open_driver_uidx on public.allocations (driver_id) where ended_at is null and status in ('pending', 'active', 'locked');
create unique index if not exists allocations_open_vehicle_uidx on public.allocations (vehicle_id) where ended_at is null and status in ('pending', 'active', 'locked');
create unique index if not exists driver_state_history_open_uidx on public.driver_state_history (driver_id) where effective_to is null;
create unique index if not exists cron_job_runs_one_running_uidx on public.cron_job_runs (job_name) where status = 'running';

create index if not exists drivers_current_state_idx on public.drivers (current_state);
create index if not exists drivers_warning_level_idx on public.drivers (warning_level);
create index if not exists drivers_is_allocatable_idx on public.drivers (is_allocatable) where is_allocatable = true;
create index if not exists vehiclesc_needs_allocation_idx on public.vehiclesc (needs_allocation) where needs_allocation = true;
create index if not exists allocation_history_allocation_idx on public.allocation_history (allocation_id, created_at desc);
create index if not exists driver_leave_driver_status_idx on public.driver_leave (driver_id, status);
create index if not exists driver_roster_periods_driver_idx on public.driver_roster_periods (driver_id, period_start desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists vehicle_rotation_plan_items_due_idx on public.vehicle_rotation_plan_items (status, proposed_change_date);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at before update on public.drivers for each row execute function public.set_updated_at();
drop trigger if exists trg_vehiclesc_updated_at on public.vehiclesc;
create trigger trg_vehiclesc_updated_at before update on public.vehiclesc for each row execute function public.set_updated_at();
drop trigger if exists trg_allocations_updated_at on public.allocations;
create trigger trg_allocations_updated_at before update on public.allocations for each row execute function public.set_updated_at();
drop trigger if exists trg_driver_leave_updated_at on public.driver_leave;
create trigger trg_driver_leave_updated_at before update on public.driver_leave for each row execute function public.set_updated_at();
drop trigger if exists trg_vehicle_rotation_plan_items_updated_at on public.vehicle_rotation_plan_items;
create trigger trg_vehicle_rotation_plan_items_updated_at before update on public.vehicle_rotation_plan_items for each row execute function public.set_updated_at();
`

const schemaSqlPart4 = `
create or replace function public.write_audit_log(
  p_entity_type public.audit_entity,
  p_entity_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $fn$
begin
  insert into public.audit_logs (entity_type, entity_id, action, actor_user_id, before_data, after_data, metadata)
  values (p_entity_type, p_entity_id, p_action, p_actor_user_id, p_before_data, p_after_data, coalesce(p_metadata, '{}'::jsonb));
end;
$fn$;

create or replace function public.refresh_driver_snapshot(p_driver_id uuid, p_actor_user_id uuid default null)
returns void
language plpgsql
as $fn$
declare
  v_driver public.drivers%rowtype;
  v_open_state public.driver_state_history%rowtype;
  v_open_leave public.driver_leave%rowtype;
  v_open_allocation public.allocations%rowtype;
  v_roster_end date;
  v_current_state_days integer := 0;
  v_warning public.warning_level := 'normal';
begin
  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found then raise exception 'Driver not found: %', p_driver_id; end if;
  select * into v_open_state from public.driver_state_history where driver_id = p_driver_id and effective_to is null order by effective_from desc, created_at desc limit 1;
  if v_open_state.id is null then
    insert into public.driver_state_history (driver_id, state, effective_from, source, reason_code, changed_by)
    values (p_driver_id, coalesce(v_driver.current_state, 'off'), coalesce(v_driver.state_started_on, current_date), 'system', 'snapshot_seed', p_actor_user_id)
    returning * into v_open_state;
  end if;
  select * into v_open_leave from public.driver_leave where driver_id = p_driver_id and status = 'active' and leave_start <= current_date and leave_end >= current_date order by leave_start desc limit 1;
  select * into v_open_allocation from public.allocations where driver_id = p_driver_id and ended_at is null and status in ('pending', 'active', 'locked') order by started_at desc limit 1;
  select period_end into v_roster_end from public.driver_roster_periods where driver_id = p_driver_id and period_start <= current_date and period_end >= current_date order by period_end desc limit 1;
  v_current_state_days := greatest(0, current_date - v_open_state.effective_from);
  if v_open_state.state = 'active' and v_current_state_days >= 33 then
    v_warning := 'critical';
  elsif v_open_state.state = 'active' and v_current_state_days > 30 then
    v_warning := 'warning';
  end if;
  update public.drivers
  set
    current_state = v_open_state.state,
    state_started_on = v_open_state.effective_from,
    last_status_change_at = timezone('utc', now()),
    current_state_days = v_current_state_days,
    warning_level = v_warning,
    current_leave_id = v_open_leave.id,
    current_allocation_id = v_open_allocation.id,
    current_vehicle_id = v_open_allocation.vehicle_id,
    is_allocatable = (v_open_state.state in ('active', 'off') and v_open_leave.id is null and v_roster_end is not null and v_open_allocation.id is null),
    roster_status = case when v_roster_end is not null then 'active' else 'missing' end,
    current_roster_period_end = v_roster_end,
    available = (v_open_state.state in ('active', 'off') and v_open_leave.id is null),
    status = upper(replace(v_open_state.state::text, '_', ' '))
  where id = p_driver_id;
end;
$fn$;

create or replace function public.refresh_vehicle_snapshot(p_vehicle_id uuid)
returns void
language plpgsql
as $fn$
declare
  v_open_allocation public.allocations%rowtype;
  v_driver public.drivers%rowtype;
begin
  perform 1 from public.vehiclesc where id = p_vehicle_id for update;
  select * into v_open_allocation from public.allocations where vehicle_id = p_vehicle_id and ended_at is null and status in ('pending', 'active', 'locked') order by started_at desc limit 1;
  if v_open_allocation.driver_id is not null then
    select * into v_driver from public.drivers where id = v_open_allocation.driver_id;
  end if;
  update public.vehiclesc
  set
    current_allocation_id = v_open_allocation.id,
    current_driver_id = v_open_allocation.driver_id,
    current_driver_code = v_driver.driver_code,
    current_allocation_status = v_open_allocation.status,
    allocation_locked = coalesce(v_open_allocation.status = 'locked', false),
    needs_allocation = v_open_allocation.id is null,
    last_allocation_change_at = timezone('utc', now()),
    driver_id = v_open_allocation.driver_id,
    driver_code = v_driver.driver_code,
    driver_name = case when v_driver.id is null then null else concat_ws(' ', v_driver.first_name, v_driver.surname) end,
    veh_allocated_flag = case when v_open_allocation.id is null then false else true end
  where id = p_vehicle_id;
end;
$fn$;
`

const schemaSqlPart5 = `
create or replace function public.upsert_driver_state_tx(p_driver_id uuid, p_new_state public.driver_state, p_reason_code text, p_note text default null, p_actor_user_id uuid default null, p_source text default 'manual')
returns jsonb
language plpgsql
as $fn$
declare
  v_open_state public.driver_state_history%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  select to_jsonb(d.*) into v_before from public.drivers d where d.id = p_driver_id;
  select * into v_open_state from public.driver_state_history where driver_id = p_driver_id and effective_to is null for update;
  if found and v_open_state.state = p_new_state then
    perform public.refresh_driver_snapshot(p_driver_id, p_actor_user_id);
    select to_jsonb(d.*) into v_after from public.drivers d where d.id = p_driver_id;
    return jsonb_build_object('driver', v_after, 'changed', false);
  end if;
  if found then
    update public.driver_state_history set effective_to = current_date where id = v_open_state.id;
  end if;
  insert into public.driver_state_history (driver_id, state, effective_from, source, reason_code, note, changed_by)
  values (p_driver_id, p_new_state, current_date, p_source, p_reason_code, p_note, p_actor_user_id);
  perform public.refresh_driver_snapshot(p_driver_id, p_actor_user_id);
  select to_jsonb(d.*) into v_after from public.drivers d where d.id = p_driver_id;
  perform public.write_audit_log('driver', p_driver_id, 'driver_state_changed', p_actor_user_id, v_before, v_after, jsonb_build_object('reason_code', p_reason_code, 'source', p_source, 'note', p_note));
  return jsonb_build_object('driver', v_after, 'changed', true);
end;
$fn$;

create or replace function public.remove_allocation_tx(p_allocation_id uuid, p_ended_reason text, p_notes text default null, p_actor_user_id uuid default null)
returns jsonb
language plpgsql
as $fn$
declare
  v_allocation public.allocations%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_allocation from public.allocations where id = p_allocation_id for update;
  if not found then raise exception 'Allocation not found: %', p_allocation_id; end if;
  if v_allocation.ended_at is not null then return jsonb_build_object('allocation_id', v_allocation.id, 'changed', false); end if;
  select to_jsonb(a.*) into v_before from public.allocations a where a.id = p_allocation_id;
  update public.allocations set ended_at = timezone('utc', now()), ended_reason = p_ended_reason, notes = coalesce(p_notes, notes), status = 'ended' where id = p_allocation_id;
  insert into public.allocation_history (allocation_id, event_type, from_driver_id, from_vehicle_id, actor_user_id, metadata)
  values (p_allocation_id, 'allocation_removed', v_allocation.driver_id, v_allocation.vehicle_id, p_actor_user_id, jsonb_build_object('ended_reason', p_ended_reason, 'notes', p_notes));
  perform public.refresh_vehicle_snapshot(v_allocation.vehicle_id);
  perform public.refresh_driver_snapshot(v_allocation.driver_id, p_actor_user_id);
  if exists (select 1 from public.drivers where id = v_allocation.driver_id and current_state not in ('on_leave', 'suspended')) then
    perform public.upsert_driver_state_tx(v_allocation.driver_id, 'off', 'allocation_removed', p_notes, p_actor_user_id, 'system');
  end if;
  select to_jsonb(a.*) into v_after from public.allocations a where a.id = p_allocation_id;
  perform public.write_audit_log('allocation', p_allocation_id, 'remove_allocation', p_actor_user_id, v_before, v_after, jsonb_build_object('ended_reason', p_ended_reason, 'notes', p_notes));
  return jsonb_build_object('allocation_id', p_allocation_id, 'changed', true);
end;
$fn$;

create or replace function public.assign_driver_to_vehicle_tx(p_vehicle_id uuid, p_driver_id uuid, p_effective_from date default current_date, p_notes text default null, p_actor_user_id uuid default null, p_allocation_type public.allocation_type default 'manual')
returns jsonb
language plpgsql
as $fn$
declare
  v_driver public.drivers%rowtype;
  v_allocation_id uuid;
  v_after jsonb;
begin
  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found then raise exception 'Driver not found: %', p_driver_id; end if;
  perform 1 from public.vehiclesc where id = p_vehicle_id for update;
  if v_driver.current_leave_id is not null then raise exception 'Driver is on leave'; end if;
  if v_driver.is_allocatable is false then raise exception 'Driver is not allocatable'; end if;
  if exists (select 1 from public.allocations where driver_id = p_driver_id and ended_at is null and status in ('pending', 'active', 'locked')) then raise exception 'Driver already has an active allocation'; end if;
  if exists (select 1 from public.allocations where vehicle_id = p_vehicle_id and ended_at is null and status in ('pending', 'active', 'locked')) then raise exception 'Vehicle already has an active allocation'; end if;
  insert into public.allocations (driver_id, vehicle_id, status, allocation_type, effective_from, started_at, notes, created_by)
  values (p_driver_id, p_vehicle_id, 'active', p_allocation_type, coalesce(p_effective_from, current_date), timezone('utc', now()), p_notes, p_actor_user_id)
  returning id into v_allocation_id;
  insert into public.allocation_history (allocation_id, event_type, to_driver_id, to_vehicle_id, actor_user_id, metadata)
  values (v_allocation_id, 'allocation_created', p_driver_id, p_vehicle_id, p_actor_user_id, jsonb_build_object('notes', p_notes, 'allocation_type', p_allocation_type));
  perform public.refresh_vehicle_snapshot(p_vehicle_id);
  perform public.refresh_driver_snapshot(p_driver_id, p_actor_user_id);
  if (select current_state from public.drivers where id = p_driver_id) <> 'active' then
    perform public.upsert_driver_state_tx(p_driver_id, 'active', 'allocation_assigned', p_notes, p_actor_user_id, 'system');
  end if;
  select jsonb_build_object('allocation', to_jsonb(a.*), 'driver', (select to_jsonb(d.*) from public.drivers d where d.id = a.driver_id), 'vehicle', (select to_jsonb(v.*) from public.vehiclesc v where v.id = a.vehicle_id))
  into v_after
  from public.allocations a
  where a.id = v_allocation_id;
  perform public.write_audit_log('allocation', v_allocation_id, 'assign_driver_to_vehicle', p_actor_user_id, null, v_after, jsonb_build_object('notes', p_notes, 'allocation_type', p_allocation_type));
  return v_after;
end;
$fn$;
`

const schemaSqlPart6 = `
create or replace function public.reassign_driver_tx(p_vehicle_id uuid, p_new_driver_id uuid, p_effective_from date default current_date, p_notes text default null, p_actor_user_id uuid default null, p_allow_override_locked boolean default false)
returns jsonb
language plpgsql
as $fn$
declare
  v_current_allocation public.allocations%rowtype;
  v_result jsonb;
  v_had_existing boolean := false;
begin
  select * into v_current_allocation from public.allocations where vehicle_id = p_vehicle_id and ended_at is null and status in ('pending', 'active', 'locked') for update;
  if found then
    v_had_existing := true;
    if v_current_allocation.status = 'locked' and not p_allow_override_locked then
      raise exception 'Current allocation is locked';
    end if;
    update public.allocations set ended_at = timezone('utc', now()), ended_reason = 'reassigned', notes = coalesce(p_notes, notes), status = 'ended' where id = v_current_allocation.id;
    insert into public.allocation_history (allocation_id, event_type, from_driver_id, from_vehicle_id, actor_user_id, metadata)
    values (v_current_allocation.id, 'allocation_reassigned_out', v_current_allocation.driver_id, v_current_allocation.vehicle_id, p_actor_user_id, jsonb_build_object('notes', p_notes, 'new_driver_id', p_new_driver_id));
    perform public.refresh_driver_snapshot(v_current_allocation.driver_id, p_actor_user_id);
    perform public.refresh_vehicle_snapshot(p_vehicle_id);
  end if;
  v_result := public.assign_driver_to_vehicle_tx(
    p_vehicle_id,
    p_new_driver_id,
    p_effective_from,
    p_notes,
    p_actor_user_id,
    case when v_had_existing then 'replacement'::public.allocation_type else 'manual'::public.allocation_type end
  );
  return jsonb_build_object('previous_allocation_id', v_current_allocation.id, 'result', v_result);
end;
$fn$;

create or replace function public.mark_driver_leave_tx(p_driver_id uuid, p_leave_start date, p_leave_end date, p_reason text default null, p_notes text default null, p_force_end_allocation boolean default false, p_actor_user_id uuid default null)
returns jsonb
language plpgsql
as $fn$
declare
  v_leave_id uuid;
  v_driver public.drivers%rowtype;
begin
  if p_leave_end < p_leave_start then raise exception 'Leave end date must be on or after start date'; end if;
  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found then raise exception 'Driver not found: %', p_driver_id; end if;
  if v_driver.current_allocation_id is not null and p_force_end_allocation then
    perform public.remove_allocation_tx(v_driver.current_allocation_id, 'driver_leave', p_notes, p_actor_user_id);
  elsif v_driver.current_allocation_id is not null and p_leave_start <= current_date then
    raise exception 'Driver has an active allocation and force_end_allocation is false';
  end if;
  insert into public.driver_leave (driver_id, leave_start, leave_end, status, reason, notes, approved_by, created_by)
  values (p_driver_id, p_leave_start, p_leave_end, case when p_leave_start <= current_date and p_leave_end >= current_date then 'active' else 'scheduled' end, p_reason, p_notes, p_actor_user_id, p_actor_user_id)
  returning id into v_leave_id;
  if p_leave_start <= current_date and p_leave_end >= current_date then
    perform public.upsert_driver_state_tx(p_driver_id, 'on_leave', 'leave_started', p_notes, p_actor_user_id, 'manual');
  else
    perform public.refresh_driver_snapshot(p_driver_id, p_actor_user_id);
  end if;
  perform public.write_audit_log('leave', v_leave_id, 'mark_driver_leave', p_actor_user_id, null, (select to_jsonb(dl.*) from public.driver_leave dl where dl.id = v_leave_id), jsonb_build_object('driver_id', p_driver_id, 'reason', p_reason, 'notes', p_notes));
  return jsonb_build_object('leave_id', v_leave_id, 'driver', (select to_jsonb(d.*) from public.drivers d where d.id = p_driver_id), 'leave', (select to_jsonb(dl.*) from public.driver_leave dl where dl.id = v_leave_id));
end;
$fn$;

create or replace function public.end_driver_leave_tx(p_leave_id uuid, p_end_date date default current_date, p_notes text default null, p_actor_user_id uuid default null)
returns jsonb
language plpgsql
as $fn$
declare
  v_leave public.driver_leave%rowtype;
begin
  select * into v_leave from public.driver_leave where id = p_leave_id for update;
  if not found then raise exception 'Leave not found: %', p_leave_id; end if;
  update public.driver_leave set leave_end = least(v_leave.leave_end, coalesce(p_end_date, current_date)), status = 'completed', notes = coalesce(p_notes, notes) where id = p_leave_id;
  if exists (select 1 from public.drivers where id = v_leave.driver_id and current_state = 'on_leave') then
    perform public.upsert_driver_state_tx(v_leave.driver_id, 'off', 'leave_completed', p_notes, p_actor_user_id, 'system');
  else
    perform public.refresh_driver_snapshot(v_leave.driver_id, p_actor_user_id);
  end if;
  perform public.write_audit_log('leave', p_leave_id, 'end_driver_leave', p_actor_user_id, null, (select to_jsonb(dl.*) from public.driver_leave dl where dl.id = p_leave_id), jsonb_build_object('notes', p_notes));
  return jsonb_build_object('leave', (select to_jsonb(dl.*) from public.driver_leave dl where dl.id = p_leave_id), 'driver', (select to_jsonb(d.*) from public.drivers d where d.id = v_leave.driver_id));
end;
$fn$;

create or replace function public.start_cron_job_run(p_job_name text, p_triggered_by text default 'system')
returns uuid
language plpgsql
as $fn$
declare v_id uuid;
begin
  insert into public.cron_job_runs (job_name, status, triggered_by) values (p_job_name, 'running', p_triggered_by) returning id into v_id;
  return v_id;
exception when unique_violation then
  return null;
end;
$fn$;

create or replace function public.finish_cron_job_run(p_run_id uuid, p_status text, p_summary jsonb default '{}'::jsonb, p_error_message text default null)
returns void
language plpgsql
as $fn$
begin
  update public.cron_job_runs set status = p_status, finished_at = timezone('utc', now()), summary = coalesce(p_summary, '{}'::jsonb), error_message = p_error_message where id = p_run_id;
end;
$fn$;

create or replace view public.v_driver_live_status as
select d.id, d.driver_code, d.employee_number, d.first_name, d.surname, d.current_state, d.state_started_on, d.current_state_days, d.warning_level, d.available, d.is_allocatable, d.current_leave_id, d.current_vehicle_id, d.current_allocation_id, d.roster_status, d.current_roster_period_end,
case when d.current_state = 'active' then greatest(0, 33 - d.current_state_days) when d.current_state = 'off' then greatest(0, 7 - d.current_state_days) else null end as days_left
from public.drivers d;

create or replace view public.v_dashboard_summary as
select
  (select count(*) from public.drivers) as total_drivers,
  (select count(*) from public.drivers where current_state = 'active') as active_drivers,
  (select count(*) from public.drivers where current_state = 'inactive') as inactive_drivers,
  (select count(*) from public.drivers where current_state = 'off') as off_drivers,
  (select count(*) from public.drivers where current_state = 'on_leave') as on_leave_drivers,
  (select count(*) from public.vehiclesc) as total_vehicles,
  (select count(*) from public.vehiclesc where current_allocation_id is not null) as allocated_vehicles,
  (select count(*) from public.vehiclesc where current_allocation_id is null) as unallocated_vehicles,
  (select count(*) from public.drivers where current_state = 'active' and current_state_days between 30 and 32) as warning_drivers,
  (select count(*) from public.drivers where current_state = 'active' and current_state_days >= 33) as critical_drivers;
`

const verificationSql = `
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'drivers','vehiclesc','users','allocations','allocation_history','driver_state_history',
    'driver_leave','employee_roster_imports','employee_roster_import_rows','driver_roster_periods',
    'audit_logs','cron_job_runs','vehicle_rotation_plan_items'
  )
order by table_name;
`

const functionVerificationSql = `
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'set_updated_at','write_audit_log','refresh_driver_snapshot','refresh_vehicle_snapshot',
    'upsert_driver_state_tx','remove_allocation_tx','assign_driver_to_vehicle_tx',
    'reassign_driver_tx','mark_driver_leave_tx','end_driver_leave_tx',
    'start_cron_job_run','finish_cron_job_run'
  )
order by proname;
`

async function main() {
  const connectionConfig = requireConnectionConfig()
  const client = new Client(connectionConfig)
  const fullSql = [
    schemaSql,
    schemaSqlPart2,
    schemaSqlPart3,
    schemaSqlPart4,
    schemaSqlPart5,
    schemaSqlPart6,
  ].join("\n")

  console.log("Connecting to database...")
  console.log(`Connection source: ${connectionConfig.source ?? "custom"}`)
  await client.connect()

  try {
    console.log("Applying fleet schema...")
    await client.query("begin")
    await client.query(fullSql)
    await client.query("commit")
    console.log("Schema applied.")

    const tables = await client.query(verificationSql)
    const functions = await client.query(functionVerificationSql)

    console.log("\\nVerified tables:")
    for (const row of tables.rows) console.log(`- ${row.table_name}`)

    console.log("\\nVerified functions:")
    for (const row of functions.rows) console.log(`- ${row.proname}`)
  } catch (error) {
    await client.query("rollback").catch(() => {})
    console.error("\\nSchema apply failed.")
    console.error(error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

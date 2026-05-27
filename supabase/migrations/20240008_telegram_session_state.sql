create table if not exists public.telegram_sessions (
  chat_id text primary key,
  step text not null default 'choosing_language',
  telegram_name text,
  telegram_username text,
  selected_vehicle_id text,
  selected_vehicle_model text,
  daily_rate int,
  requested_start_date date,
  requested_days int,
  requested_end_date date,
  total_amount int,
  id_file_id text,
  license_file_id text,
  updated_at timestamptz default now()
);

alter table public.telegram_sessions enable row level security;

do $$
begin
  if to_regclass('public.telegram_sessions') is not null then
    execute 'drop policy if exists "Allow all on telegram_sessions" on public.telegram_sessions';
    execute 'drop policy if exists "Service role only on telegram_sessions" on public.telegram_sessions';
    execute 'create policy "Service role only on telegram_sessions" on public.telegram_sessions for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end
$$;

alter table if exists public.telegram_sessions
  add column if not exists session_data jsonb;

alter table if exists public.telegram_sessions
  add column if not exists license_back_file_id text;

alter table if exists public.telegram_sessions
  add column if not exists selected_segment text;

alter table if exists public.telegram_sessions
  add column if not exists selected_body_type text;

alter table if exists public.telegram_sessions
  add column if not exists customer_id uuid;

alter table if exists public.telegram_sessions
  add column if not exists customer_full_name text;

alter table if exists public.telegram_sessions
  add column if not exists customer_phone text;

create index if not exists telegram_sessions_updated_at_idx
  on public.telegram_sessions(updated_at desc);

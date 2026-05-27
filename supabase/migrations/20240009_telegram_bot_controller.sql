create table if not exists public.telegram_bot_settings (
  id text primary key default 'live',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.telegram_bot_settings enable row level security;

do $$
begin
  if to_regclass('public.telegram_bot_settings') is not null then
    execute 'drop policy if exists "Telegram bot settings public read" on public.telegram_bot_settings';
    execute 'drop policy if exists "Telegram bot settings admin write" on public.telegram_bot_settings';
    execute 'create policy "Telegram bot settings public read" on public.telegram_bot_settings for select using (true)';
    execute 'create policy "Telegram bot settings admin write" on public.telegram_bot_settings for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end
$$;

insert into public.telegram_bot_settings (id, settings)
values ('live', '{}'::jsonb)
on conflict (id) do nothing;
